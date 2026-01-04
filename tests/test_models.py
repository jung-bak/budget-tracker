"""Tests for core domain models."""

from datetime import datetime

from app.core.models import Transaction


def test_transaction_global_id_deterministic():
    """Global ID should be deterministic for same inputs."""
    txn1 = Transaction(
        timestamp=datetime(2025, 1, 15, 10, 30, 0),
        merchant="Test Merchant",
        amount=1500,
        currency="USD",
        institution="BAC",
        payment_instrument="1234",
        raw_reference="Test Reference",
    )
    txn2 = Transaction(
        timestamp=datetime(2025, 1, 15, 10, 30, 0),
        merchant="Test Merchant",
        amount=1500,
        currency="USD",
        institution="BAC",
        payment_instrument="1234",
        raw_reference="Different Reference",  # Raw ref not in hash
    )
    assert txn1.global_id == txn2.global_id


def test_transaction_global_id_unique_for_different_data():
    """Global ID should differ for different transaction data."""
    txn1 = Transaction(
        timestamp=datetime(2025, 1, 15, 10, 30, 0),
        merchant="Test Merchant",
        amount=1500,
        currency="USD",
        institution="BAC",
        payment_instrument="1234",
        raw_reference="Test",
    )
    txn2 = Transaction(
        timestamp=datetime(2025, 1, 15, 10, 30, 0),
        merchant="Different Merchant",
        amount=1500,
        currency="USD",
        institution="BAC",
        payment_instrument="1234",
        raw_reference="Test",
    )
    assert txn1.global_id != txn2.global_id
