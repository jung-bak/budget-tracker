"""Core domain models."""

import hashlib
from datetime import date, datetime

from pydantic import BaseModel, Field, computed_field


class Transaction(BaseModel):
    """A normalized financial transaction."""

    timestamp: datetime = Field(description="Transaction timestamp in ISO 8601")
    merchant: str = Field(description="Merchant or payee name")
    amount: int = Field(description="Amount in minor units (cents)")
    currency: str = Field(description="Currency code (CRC, USD)")
    institution: str = Field(description="Financial institution (BAC, Davivienda)")
    payment_instrument: str = Field(description="Last 4 digits of card/account")
    raw_reference: str = Field(description="Original reference from email")

    @computed_field
    @property
    def global_id(self) -> str:
        """Generate unique SHA-256 hash for deduplication."""
        unique_str = (
            f"{self.timestamp.isoformat()}"
            f"{self.merchant}"
            f"{self.amount}"
            f"{self.currency}"
            f"{self.institution}"
            f"{self.payment_instrument}"
        )
        return hashlib.sha256(unique_str.encode()).hexdigest()


class SyncResult(BaseModel):
    """Result of a sync operation."""

    processed: int = 0
    errors: int = 0
    skipped: int = 0


class BackfillRequest(BaseModel):
    """Request body for backfill endpoint."""

    start_date: date = Field(description="Start date in YYYY-MM-DD format")
    end_date: date = Field(description="End date in YYYY-MM-DD format")
