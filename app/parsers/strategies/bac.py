"""BAC bank email parser using regex."""

import re
from datetime import datetime

from bs4 import BeautifulSoup

from app.adapters.imap_client import EmailMessage
from app.core.models import Transaction
from app.parsers.strategies.base import ParserStrategy


class BACParserStrategy(ParserStrategy):
    """Parser for BAC Credomatic transaction notification emails."""

    SUBJECT_PATTERN = "Notificación de transacción"

    @property
    def institution(self) -> str:
        return "BAC"

    def can_parse(self, email: EmailMessage) -> bool:
        """Check if email is a BAC transaction notification by subject."""
        return self.SUBJECT_PATTERN in email.subject

    def parse(self, email: EmailMessage) -> Transaction | None:
        """Parse BAC transaction email using regex on text content."""
        # Get text content from HTML or plain text
        if email.html_body:
            soup = BeautifulSoup(email.html_body, "html.parser")
            text = soup.get_text(separator="\n")
        elif email.text_body:
            text = email.text_body
        else:
            return None

        try:
            merchant = self._extract_merchant(text)
            amount, currency = self._extract_amount(text)
            card_last4 = self._extract_card(text)
            timestamp = self._extract_timestamp(text, email)

            if not all([merchant, amount is not None, card_last4]):
                return None

            return Transaction(
                timestamp=timestamp,
                merchant=merchant,
                amount=amount,
                currency=currency,
                institution=self.institution,
                payment_instrument=card_last4,
                notes="",
            )
        except Exception:
            return None

    def _extract_merchant(self, text: str) -> str:
        """Extract merchant name from text."""
        # Pattern: "Comercio:" followed by merchant name on next line
        match = re.search(
            r"Comercio:\s*\n\s*(.+?)(?:\n|$)",
            text,
            re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        # Fallback: look for merchant after "Comercio:" on same line
        match = re.search(
            r"Comercio:\s*(.+?)(?:\n|$)",
            text,
            re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        return ""

    def _extract_amount(self, text: str) -> tuple[float, str]:
        """Extract amount in dollars with cents and currency."""
        # Pattern: "Monto:" followed by currency and amount
        match = re.search(
            r"Monto:\s*\n?\s*((?:USD|CRC|₡|\$)\s*[\d,]+\.?\d*)",
            text,
            re.IGNORECASE,
        )
        if match:
            return self._parse_amount_string(match.group(1))

        # Fallback: look for currency amount pattern anywhere
        match = re.search(
            r"((?:USD|CRC)\s*[\d,]+\.\d{2})",
            text,
        )
        if match:
            return self._parse_amount_string(match.group(1))

        return 0.0, "USD"

    def _parse_amount_string(self, amount_str: str) -> tuple[float, str]:
        """Parse amount string to dollars with cents and currency."""
        currency = "USD"
        if "CRC" in amount_str or "₡" in amount_str or "colones" in amount_str.lower():
            currency = "CRC"

        # Extract numeric value
        numeric = re.sub(r"[^\d.,]", "", amount_str)
        # Handle different decimal separators
        if "," in numeric and "." in numeric:
            # e.g., 1,234.56 or 1.234,56
            if numeric.rfind(",") > numeric.rfind("."):
                numeric = numeric.replace(".", "").replace(",", ".")
            else:
                numeric = numeric.replace(",", "")
        elif "," in numeric:
            # Could be decimal or thousands separator
            parts = numeric.split(",")
            if len(parts[-1]) == 2:
                numeric = numeric.replace(",", ".")
            else:
                numeric = numeric.replace(",", "")

        try:
            return round(float(numeric), 2), currency
        except ValueError:
            return 0.0, currency

    def _extract_card(self, text: str) -> str:
        """Extract last 4 digits of card."""
        # Pattern: asterisks followed by 4 digits
        match = re.search(r"\*{4,}(\d{4})", text)
        if match:
            return match.group(1)

        # Fallback: X's followed by 4 digits
        match = re.search(r"[Xx]{4,}(\d{4})", text)
        if match:
            return match.group(1)

        return ""

    def _extract_timestamp(self, text: str, email: EmailMessage) -> datetime:
        """Extract transaction timestamp or fall back to email date."""
        # Pattern: "Fecha:" followed by date like "Ene 3, 2026, 18:42"
        match = re.search(
            r"Fecha:\s*\n?\s*([A-Za-z]{3,4}\s+\d{1,2},\s*\d{4},?\s*\d{1,2}:\d{2})",
            text,
            re.IGNORECASE,
        )
        if match:
            return self._parse_spanish_date(match.group(1))

        # Fallback: numeric date format
        match = re.search(
            r"Fecha:\s*\n?\s*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*,?\s*(\d{1,2}:\d{2})?",
            text,
            re.IGNORECASE,
        )
        if match:
            date_str = match.group(1)
            time_str = match.group(2) if match.group(2) else "00:00"
            return self._parse_numeric_date(date_str, time_str)

        return datetime.combine(email.date, datetime.min.time())

    def _parse_spanish_date(self, date_str: str) -> datetime:
        """Parse Spanish date format like 'Ene 3, 2026, 18:42'."""
        months = {
            "ene": 1,
            "feb": 2,
            "mar": 3,
            "abr": 4,
            "may": 5,
            "jun": 6,
            "jul": 7,
            "ago": 8,
            "sep": 9,
            "oct": 10,
            "nov": 11,
            "dic": 12,
        }

        try:
            # Extract components
            match = re.match(
                r"([A-Za-z]{3,4})\s+(\d{1,2}),?\s*(\d{4}),?\s*(\d{1,2}):(\d{2})",
                date_str.strip(),
            )
            if match:
                month_str = match.group(1).lower()[:3]
                day = int(match.group(2))
                year = int(match.group(3))
                hour = int(match.group(4))
                minute = int(match.group(5))

                month = months.get(month_str, 1)
                return datetime(year, month, day, hour, minute)
        except (ValueError, AttributeError):
            pass

        return datetime.now()

    def _parse_numeric_date(self, date_str: str, time_str: str) -> datetime:
        """Parse numeric date format like '03/01/2026 18:42'."""
        try:
            # Try DD/MM/YYYY format
            parts = re.split(r"[/-]", date_str)
            if len(parts) == 3:
                day, month, year = int(parts[0]), int(parts[1]), int(parts[2])
                if year < 100:
                    year += 2000

                hour, minute = 0, 0
                if time_str:
                    time_parts = time_str.split(":")
                    hour = int(time_parts[0])
                    minute = int(time_parts[1]) if len(time_parts) > 1 else 0

                return datetime(year, month, day, hour, minute)
        except (ValueError, IndexError):
            pass

        return datetime.now()
