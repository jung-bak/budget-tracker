"""Base parser strategy interface."""

from abc import ABC, abstractmethod

from app.adapters.imap_client import EmailMessage
from app.core.models import Transaction


class ParserStrategy(ABC):
    """Abstract base class for bank-specific email parsers."""

    @property
    @abstractmethod
    def institution(self) -> str:
        """Return the institution identifier (e.g., 'BAC', 'Davivienda')."""
        pass

    @abstractmethod
    def can_parse(self, email: EmailMessage) -> bool:
        """Check if this strategy can parse the given email."""
        pass

    @abstractmethod
    def parse(self, email: EmailMessage) -> Transaction | None:
        """Parse email and return Transaction, or None if parsing fails."""
        pass
