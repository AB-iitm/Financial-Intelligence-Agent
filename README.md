# Financial-Intelligence-Agent
# Finance Intelligence Agent (Finwise)

A classroom-friendly full-stack web application (React + Vite, Python FastAPI) demonstrating GenAI extraction and an autonomous AI agent audit workflow over personal finance data. 

**Note: This is an educational demo. It uses fictional sample data, simulates approvals, and never sends actual messages or moves money.**

## Features
- **Layer 1:** AI extraction of transaction data from raw text/images/PDFs into a validated Pydantic schema.
- **Layer 2:** An autonomous ReAct-style agent loop with deterministic tools (`detect_stealth_hikes`, `calculate_annual_leakage`, `generate_cancellation_script`).
- **Human-in-the-Loop:** All consequential actions wait for local simulation approval.
- **Demo Mode:** Fully functional offline deterministic planner and fallback when no API key is provided.

## Prerequisites
- Node.js 20+
- Python 3.11+ (3.12 recommended)

## Setup and Run

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```
Optionally, edit `.env` to add your `GEMINI_API_KEY`. If left as `replace_me`, the app runs in demo-safe mode.

Start the backend:
```bash
uvicorn app.main:app --reload --port 8000
```
Interactive API docs available at: http://localhost:8000/docs

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Open http://localhost:5173 in your browser.

## Demo Flow
1. **Load data:** On first visit, fictional transactions load automatically. Click "Load sample data" anytime.
2. **Review dashboard:** Observe the metrics, chart, and transaction list updating instantly.
3. **Extract (GenAI):** If configured, paste text or upload an image and click "Extract transactions" to test structured extraction.
4. **Agent Audit:** Click "Run agent audit" on the Day 2 panel.
5. **Trace:** Read the agent trace to see its step-by-step thinking, bounded loop, and grounded arguments.
6. **Approval:** Click "Approve simulation" or "Reject" on the drafted cancellation message.

## Tests
```bash
cd backend
pytest
```

## Known Limitations and Teaching Notes
- **Do not upload real financial statements.** This is an educational sandbox.
- State is kept in-memory and resets when the backend server restarts.
- Duplicate transactions are not explicitly deduplicated.
- Currency display is hardcoded to USD.
