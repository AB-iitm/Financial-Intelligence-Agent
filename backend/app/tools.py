from typing import List, Dict, Any
import datetime

def detect_stealth_hikes(transactions: List[Any], threshold: float = 0.10) -> List[Dict[str, Any]]:
    findings = []
    subs = [t for t in transactions if t.category == "Subscriptions" and t.amount > 0]
    
    grouped = {}
    for t in subs:
        key = t.merchant.strip().casefold()
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(t)
        
    for merchant_key, group in grouped.items():
        group.sort(key=lambda x: x.date or datetime.date.min)
        for i in range(1, len(group)):
            prev = group[i-1]
            cur = group[i]
            if prev.amount <= 0:
                continue
            change = (cur.amount - prev.amount) / prev.amount
            if change > threshold:
                findings.append({
                    "merchant": cur.merchant,
                    "old_amount": round(prev.amount, 2),
                    "new_amount": round(cur.amount, 2),
                    "change_pct": round(change * 100, 1),
                    "date": cur.date.isoformat() if cur.date else None,
                    "monthly_increase": round(cur.amount - prev.amount, 2)
                })
    return findings

def calculate_annual_leakage(merchant: str, monthly_amount: float) -> Dict[str, Any]:
    if monthly_amount < 0:
        raise ValueError("monthly_amount cannot be negative")
    return {
        "merchant": merchant,
        "monthly_amount": round(monthly_amount, 2),
        "annual_cost": round(monthly_amount * 12, 2)
    }

def generate_cancellation_script(merchant: str, old_amount: float, new_amount: float) -> Dict[str, Any]:
    increase = round(new_amount - old_amount, 2)
    draft = f"""Subject: Request to review subscription price change

Hello {merchant} Support,

I noticed my recurring subscription changed from ${old_amount:.2f} to ${new_amount:.2f}. Please confirm when and how this price change was communicated. I request a review of the ${increase:.2f} increase and information about cancellation options and any applicable refund policy.

Thank you."""
    return {
        "merchant": merchant,
        "draft": draft,
        "sent": False
    }