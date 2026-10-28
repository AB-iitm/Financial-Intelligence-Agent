import datetime
from typing import Optional, Literal, Any
from pydantic import BaseModel

class Transaction(BaseModel):
    date: Optional[datetime.date] = None
    merchant: str
    amount: float
    category: str
    raw_line: str
    notes: Optional[str] = None

class Statement(BaseModel):
    transactions: list[Transaction] = []
    notes: Optional[str] = None

class AgentDecision(BaseModel):
    tool_name: Literal[
        "detect_stealth_hikes",
        "calculate_annual_leakage",
        "generate_cancellation_script",
        "finish"
    ]
    arguments: dict[str, Any] = {}
    message: str

class AuditRequest(BaseModel):
    goal: str = "Identify subscription price increases and calculate annual leakage"
    transactions: list[Transaction] = []

class ApprovalRequest(BaseModel):
    action: Optional[str] = None
    decision: Optional[str] = None
    reason: Optional[str] = ""

class AuditSession(BaseModel):
    session_id: str
    goal: str
    status: str = "running"
    findings: list[dict[str, Any]] = []
    tool_results: list[dict[str, Any]] = []
    pending_action: Optional[dict[str, Any]] = None
    history: list[dict[str, Any]] = []
    audit_log: list[dict[str, Any]] = []  # Required by main.py
    steps: int = 0                        # Required by main.py
    summary: str = ""                     # Required by main.py