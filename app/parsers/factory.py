"""Parser factory for selecting appropriate parsing strategy."""

from app.adapters.imap_client import EmailMessage
from app.parsers.strategies.bac import BACParserStrategy
from app.parsers.strategies.base import ParserStrategy
from app.parsers.strategies.davibank import DavibankParserStrategy


class ParserFactory:
    """Factory for obtaining the appropriate parser strategy for an email."""

    def __init__(self):
        self._strategies: list[ParserStrategy] = [
            BACParserStrategy(),
            DavibankParserStrategy(),
        ]

    def get_strategy(self, email: EmailMessage) -> ParserStrategy | None:
        """Get the appropriate parser strategy for the given email.

        Args:
            email: The email message to find a parser for.

        Returns:
            The matching ParserStrategy, or None if no strategy matches.
        """
        for strategy in self._strategies:
            if strategy.can_parse(email):
                return strategy
        return None

    def register_strategy(self, strategy: ParserStrategy) -> None:
        """Register a new parsing strategy.

        Args:
            strategy: The strategy to register.
        """
        self._strategies.append(strategy)

    @property
    def supported_institutions(self) -> list[str]:
        """List all supported financial institutions."""
        return [s.institution for s in self._strategies]
