import pytest
from app.tools import detect_stealth_hikes, calculate_annual_leakage, generate_cancellation_script
from app.sample_data import sample_transactions

def test_sample_contains_expected_price_hike():
    txs = sample_transactions()
    findings = detect_stealth_hikes(txs)
    assert len(findings) == 1
    hike = findings[0]
    assert hike["merchant"] == "StreamBox Premium"
    assert hike["old_amount"] == 37.69
    assert hike["new_amount"] == 49.00
    assert hike["change_pct"] == 30.0
    assert hike["monthly_increase"] == 11.31

def test_annual_cost():
    res = calculate_annual_leakage("StreamBox Premium", 49.0)
    assert res["annual_cost"] == 588.0

def test_draft_is_not_sent():
    res = generate_cancellation_script("StreamBox Premium", 37.69, 49.0)
    assert res["sent"] is False
    assert "$11.31" in res["draft"]

def test_negative_monthly_amount_raises():
    with pytest.raises(ValueError):
        calculate_annual_leakage("Test", -10.0)