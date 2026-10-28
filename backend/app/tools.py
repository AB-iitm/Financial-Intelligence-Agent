from typing import Any, List, Dict

def _get_field(tx: Any, key: str) -> Any:
    """Safely retrieves a field whether tx is a dict or a Pydantic object."""
    if isinstance(tx, dict):
        return tx.get(key)
    return getattr(tx, key, None)

def detect_stealth_hikes(transactions: List[Any]) -> List[Dict[str, Any]]:
    """Detects recurring merchant charges where the price increased by > 10% over time."""
    merchant_charges: Dict[str, List[Dict[str, Any]]] = {}

    for tx in transactions:
        merchant = _get_field(tx, "merchant")
        amount = _get_field(tx, "amount")
        tx_date = _get_field(tx, "date")
        category = _get_field(tx, "category")

        if not merchant or amount is None:
            continue

        if merchant not in merchant_charges:
            merchant_charges[merchant] = []
        
        merchant_charges[merchant].append({
            "amount": float(amount),
            "date": str(tx_date) if tx_date else "",
            "category": category or "Other"
        })

    stealth_hikes = []

    for merchant, charges in merchant_charges.items():
        if len(charges) < 2:
            continue

        # Sort charges by date if available
        charges.sort(key=lambda x: x["date"])

        old_amount = charges[0]["amount"]
        new_amount = charges[-1]["amount"]

        if old_amount > 0 and new_amount > old_amount:
            monthly_increase = new_amount - old_amount
            change_pct = (monthly_increase / old_amount) * 100

            # Trigger detection on stealth price increases (> 10%)
            if change_pct >= 10.0:
                stealth_hikes.append({
                    "merchant": merchant,
                    "old_amount": round(old_amount, 2),
                    "new_amount": round(new_amount, 2),
                    "monthly_increase": round(monthly_increase, 2),
                    "change_pct": round(change_pct, 1),
                    "date": charges[-1]["date"]
                })

    return stealth_hikes

def calculate_annual_leakage(merchant: str, monthly_amount: float) -> Dict[str, Any]:
    """Calculates the annualized spending leak for a recurring monthly cost."""
    annual_cost = monthly_amount * 12
    return {
        "merchant": merchant,
        "monthly_amount": round(monthly_amount, 2),
        "annual_leakage": round(annual_cost, 2)
    }

def generate_cancellation_script(merchant: str, old_amount: float, new_amount: float) -> Dict[str, Any]:
    """Generates a draft cancellation / dispute email template for the user."""
    draft = (
        f"Subject: Price Increase Dispute & Account Cancellation Request - {merchant}\n\n"
        f"Dear {merchant} Support Team,\n\n"
        f"I noticed my monthly subscription rate recently increased from ${old_amount:.2f} to ${new_amount:.2f} "
        f"without prior notice. I request a price match back to my previous rate of ${old_amount:.2f}/month.\n\n"
        f"If this price match cannot be honored, please consider this email formal notice to cancel my subscription "
        f"effective immediately.\n\n"
        f"Thank you,\nAccount Holder"
    )
    return {
        "merchant": merchant,
        "draft": draft
    }