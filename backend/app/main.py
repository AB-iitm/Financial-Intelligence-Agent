import os
import uuid
import csv
import io
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException, UploadFile, File, Form, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from dotenv import load_dotenv

load_dotenv()

from .models import Transaction, Statement, AuditRequest, ApprovalRequest, AuditSession
from .sample_data import sample_transactions
from .tools import detect_stealth_hikes, calculate_annual_leakage, generate_cancellation_script
from .ai_service import extract_statement, choose_next_step

app = FastAPI(title="Finance Intelligence Agent")

origins = [origin.strip() for origin in os.getenv("FRONTEND_ORIGIN", "http://localhost:5173").split(",")]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_methods=["*"], allow_headers=["*"])

SESSIONS = {}

def utc_now():
    return datetime.now(timezone.utc).isoformat()

def build_summary(findings):
    if not findings:
        return "No subscription price hikes above 10% were found in the provided data."
    return " ".join([f"{f['merchant']} increased from ${f['old_amount']:.2f} to ${f['new_amount']:.2f} (+{f['change_pct']:.1f}%). Current annualized cost: ${f['new_amount'] * 12:.2f}." for f in findings])

@app.get("/api/health")
def health_check():
    api_key = os.getenv("GEMINI_API_KEY")
    return {"status": "ok", "gemini_configured": bool(api_key and api_key != "replace_me")}

@app.get("/api/sample")
def get_sample_data():
    transactions = [t.model_dump(mode="json") for t in sample_transactions()]
    return {
        "transactions": transactions,
        "currency": "USD",
        "source": "fictional workshop sample"
    }
@app.post("/api/extract")
async def extract_data(text: Optional[str] = Form(None), file: Optional[UploadFile] = File(None)):
    if (not text or not text.strip()) and not file:
        raise HTTPException(status_code=400, detail="Paste transaction text or choose a file.")
    
    file_bytes = None
    mime_type = None
    if file:
        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="The selected file is empty.")
        if len(file_bytes) > 12 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Please use a file smaller than 12 MB for this classroom demo.")
        mime_type = file.content_type or "application/octet-stream"

        if mime_type == "text/csv" or file.filename.endswith(".csv"):
            try:
                decoded = file_bytes.decode('utf-8-sig')
                rows = list(csv.DictReader(io.StringIO(decoded)))
                if not rows:
                    raise HTTPException(status_code=400, detail="Could not read CSV: Empty rows")
                text = f"CSV rows (extract/normalize only; do not invent values):\n{repr(rows)}"
                file_bytes = None
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Could not read CSV: {str(e)}")

    if text and len(text) > 100000:
        text = text[:100000]

    try:
        statement = extract_statement(text=text, file_bytes=file_bytes, mime_type=mime_type)
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Gemini extraction failed: {str(e)}")

    valid_transactions = []
    validation_errors = []
    for i, t_data in enumerate(statement.transactions):
        try:
            valid_transactions.append(Transaction.model_validate(t_data.model_dump()))
        except Exception as e:
            validation_errors.append({"row": i + 1, "error": str(e)})

    return {
        "transactions": [t.model_dump(mode="json") for t in valid_transactions],
        "notes": statement.notes,
        "validation_errors": validation_errors,
        "count": len(valid_transactions)
    }

@app.post("/api/audits")
def create_audit(req: AuditRequest):
    if not req.transactions:
        raise HTTPException(status_code=400, detail="Add transactions before starting an audit.")
    
    session_id = str(uuid.uuid4())
    session = AuditSession(session_id=session_id, goal=req.goal)
    session.audit_log.append({"time": utc_now(), "type": "started", "message": f"Audit started with {len(req.transactions)} transactions.", "details": {}})
    SESSIONS[session_id] = session

    allowlist = ["detect_stealth_hikes", "calculate_annual_leakage", "generate_cancellation_script", "finish"]
    tool_results = []

    try:
        for _ in range(6):
            session.steps += 1
            decision = choose_next_step(session.goal, session.findings, tool_results, allowlist)
            session.audit_log.append({"time": utc_now(), "type": "plan", "message": decision.message or f"Selected {decision.tool_name}.", "details": {"tool": decision.tool_name, "arguments": decision.arguments}})

            if decision.tool_name == "finish":
                break
            
            if decision.tool_name not in allowlist:
                raise ValueError(f"Tool {decision.tool_name} is not allowed.")

            result = {}
            if decision.tool_name == "detect_stealth_hikes":
                result = detect_stealth_hikes(req.transactions)
                session.findings = result
                
            elif decision.tool_name == "calculate_annual_leakage":
                matched = next((f for f in session.findings if f['merchant'] == decision.arguments.get('merchant') and abs(f['new_amount'] - decision.arguments.get('monthly_amount', 0)) < 0.001), None)
                if not matched and session.findings: matched = session.findings[0]
                
                if matched:
                    result = calculate_annual_leakage(matched['merchant'], matched['new_amount'])
                else:
                    result = {"skipped": "No price hike found."}
                    
            elif decision.tool_name == "generate_cancellation_script":
                matched = next((f for f in session.findings if f['merchant'] == decision.arguments.get('merchant')), None)
                if not matched and session.findings: matched = session.findings[0]
                
                if matched:
                    result = generate_cancellation_script(matched['merchant'], matched['old_amount'], matched['new_amount'])
                    session.pending_action = {
                        "type": "review_subscription_change",
                        "merchant": matched['merchant'],
                        "old_amount": matched['old_amount'],
                        "new_amount": matched['new_amount'],
                        "change_pct": matched['change_pct'],
                        "date": matched['date'],
                        "annual_cost": round(matched['new_amount'] * 12, 2),
                        "monthly_increase": matched['monthly_increase'],
                        "draft": result['draft'],
                        "sent": False
                    }
                    tool_results.append({"tool": decision.tool_name, "result": result})
                    session.audit_log.append({"time": utc_now(), "type": "tool", "message": f"Executed {decision.tool_name}.", "details": result})
                    
                    session.status = "awaiting_approval"
                    session.summary = build_summary(session.findings)
                    session.audit_log.append({"time": utc_now(), "type": "approval_required", "message": "Draft ready. Waiting for human approval; nothing has been sent.", "details": {}})
                    return session
                else:
                    result = {"skipped": "No price hike found."}

            tool_results.append({"tool": decision.tool_name, "result": result})
            session.audit_log.append({"time": utc_now(), "type": "tool", "message": f"Executed {decision.tool_name}.", "details": result})

        session.status = "done"
        session.summary = build_summary(session.findings)
        session.audit_log.append({"time": utc_now(), "type": "completed", "message": "Audit completed safely.", "details": {"steps": session.steps}})
        
    except Exception as e:
        session.status = "failed"
        session.summary = f"Audit stopped safely: {str(e)}"
        session.audit_log.append({"time": utc_now(), "type": "error", "message": session.summary, "details": {}})
        
    return session

@app.get("/api/audits/{session_id}")
def get_audit(session_id: str):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Audit session not found.")
    return SESSIONS[session_id]

@app.post("/api/audits/{session_id}/approval")
def approve_audit(session_id: str, req: ApprovalRequest):
    if session_id not in SESSIONS:
        raise HTTPException(status_code=404, detail="Audit session not found. Start a new audit.")
    session = SESSIONS[session_id]
    
    if session.status != "awaiting_approval" or not session.pending_action:
        raise HTTPException(status_code=409, detail="This audit has no pending approval.")
        
    if req.decision == "approve":
        session.status = "executing"
        session.pending_action["simulated_execution"] = "Approved and recorded locally; no external message was sent."
        session.pending_action["approved"] = True
        session.audit_log.append({"time": utc_now(), "type": "approved_simulation", "message": "Human approved the proposed action (simulated).", "details": {"merchant": session.pending_action['merchant'], "reason": req.reason}})
        session.summary += " Demo action approved and simulated; no message was sent."
    else:
        session.pending_action["approved"] = False
        session.audit_log.append({"time": utc_now(), "type": "rejected", "message": "Human rejected the proposed action. Nothing was sent.", "details": {}})
        session.summary += " Proposed action rejected; nothing was sent."
        
    session.status = "done"
    return session