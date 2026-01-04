"""Utility functions for normalization and formatting."""

from datetime import date, datetime


def parse_date(date_str: str) -> date:
    """Parse date string in YYYY-MM-DD format.

    Args:
        date_str: Date string in YYYY-MM-DD format.

    Returns:
        Parsed date object.

    Raises:
        ValueError: If the date string is invalid.
    """
    return datetime.strptime(date_str, "%Y-%m-%d").date()


def format_amount(amount_cents: int, currency: str) -> str:
    """Format amount from cents to human-readable string.

    Args:
        amount_cents: Amount in minor units (cents).
        currency: Currency code (USD, CRC).

    Returns:
        Formatted amount string (e.g., "USD 12.34").
    """
    amount = amount_cents / 100
    if currency == "CRC":
        # CRC typically shown without decimals for large amounts
        return f"₡{amount:,.0f}" if amount >= 100 else f"₡{amount:,.2f}"
    return f"${amount:,.2f}"


def normalize_merchant_name(merchant: str) -> str:
    """Normalize merchant name for consistency.

    Args:
        merchant: Raw merchant name.

    Returns:
        Normalized merchant name.
    """
    # Strip whitespace and normalize
    merchant = " ".join(merchant.split())

    # Remove common prefixes/suffixes
    prefixes = ["COMPRA EN ", "PAGO A ", "PURCHASE AT "]
    for prefix in prefixes:
        if merchant.upper().startswith(prefix):
            merchant = merchant[len(prefix) :]

    return merchant.strip()


def amount_to_cents(amount: float) -> int:
    """Convert float amount to cents.

    Args:
        amount: Amount as float (e.g., 12.34).

    Returns:
        Amount in cents (e.g., 1234).
    """
    return int(round(amount * 100))


def cents_to_amount(cents: int) -> float:
    """Convert cents to float amount.

    Args:
        cents: Amount in cents (e.g., 1234).

    Returns:
        Amount as float (e.g., 12.34).
    """
    return cents / 100
