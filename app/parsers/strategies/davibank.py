"""Davibank email parser using regex."""

import re
from datetime import datetime

from app.adapters.imap_client import EmailMessage
from app.core.models import Transaction
from app.parsers.strategies.base import ParserStrategy


class DavibankParserStrategy(ParserStrategy):
    """Parser for Davibank transaction notification emails."""

    SUBJECT_PATTERN = "Alerta Transacción Tarjeta de Crédito Titular"

    @property
    def institution(self) -> str:
        return "Davibank"

    def can_parse(self, email: EmailMessage) -> bool:
        """Check if email is a Davibank transaction notification by subject."""
        return self.SUBJECT_PATTERN in email.subject

    def parse(self, email: EmailMessage) -> Transaction | None:
        """Parse Davibank transaction email using regex on plain text."""
        text = email.text_body or email.html_body
        if not text:
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
        # Pattern for: "transacción realizada en MERCHANT, el día"
        match = re.search(
            r"transacci[óo]n\s+realizada\s+en\s+(.+?),\s*el\s+d[íi]a",
            text,
            re.IGNORECASE,
        )
        if match:
            return match.group(1).strip()

        # Fallback patterns
        patterns = [
            r"(?:Comercio|Establecimiento|Merchant)[:\s]+([A-Za-z0-9\s\-\.]+)",
            r"compra\s+(?:en|at)\s+([A-Za-z0-9\s\-\.]+)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1).strip()

        return ""

    def _extract_amount(self, text: str) -> tuple[float, str]:
        """Extract amount in dollars with cents and currency."""
        patterns = [
            r"(?:Monto|Amount|Total)[:\s]*(?:USD|CRC|₡|\$)?\s*([\d,]+\.?\d*)",
            r"(?:USD|CRC|₡|\$)\s*([\d,]+\.?\d*)",
            r"([\d,]+\.?\d*)\s*(?:USD|CRC|colones|dólares)",
        ]

        currency = "USD"
        if "CRC" in text or "₡" in text or "colones" in text.lower():
            currency = "CRC"

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                amount_str = match.group(1)
                return self._parse_amount(amount_str), currency

        return 0.0, currency

    def _parse_amount(self, amount_str: str) -> float:
        """Parse amount string to dollars with cents."""
        # Remove non-numeric except . and ,
        numeric = re.sub(r"[^\d.,]", "", amount_str)

        # Handle decimal separators
        if "," in numeric and "." in numeric:
            if numeric.rfind(",") > numeric.rfind("."):
                numeric = numeric.replace(".", "").replace(",", ".")
            else:
                numeric = numeric.replace(",", "")
        elif "," in numeric:
            parts = numeric.split(",")
            if len(parts[-1]) == 2:
                numeric = numeric.replace(",", ".")
            else:
                numeric = numeric.replace(",", "")

        try:
            return round(float(numeric), 2)
        except ValueError:
            return 0.0

    def _extract_card(self, text: str) -> str:
        """Extract last 4 digits of card."""
        patterns = [
            r"[Tt]arjeta[:\s]*\*+(\d{4})",
            r"[Cc]ard[:\s]*\*+(\d{4})",
            r"\*{4,}(\d{4})",
            r"[Xx]{4,}(\d{4})",
            r"terminada\s+en\s+(\d{4})",
            r"ending\s+in\s+(\d{4})",
        ]

        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)

        return ""

    def _extract_timestamp(self, text: str, email: EmailMessage) -> datetime:
        """Extract transaction timestamp or fall back to email date."""
        # Pattern for: "el día 02/01/2026 a las 08:54 PM"
        match = re.search(
            r"el\s+d[íi]a\s+(\d{1,2}/\d{1,2}/\d{4})\s+a\s+las?\s+(\d{1,2}:\d{2})\s*(AM|PM)?",
            text,
            re.IGNORECASE,
        )
        if match:
            date_str = match.group(1)
            time_str = match.group(2)
            am_pm = match.group(3)
            return self._parse_date(date_str, time_str, am_pm)

        # Fallback patterns
        patterns = [
            r"(?:Fecha|Date)[:\s]*(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})"
            r"(?:\s+(\d{1,2}:\d{2}(?::\d{2})?))?",
            r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s+(\d{1,2}:\d{2}(?::\d{2})?)",
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                date_str = match.group(1)
                time_str = match.group(2) if len(match.groups()) > 1 else None
                return self._parse_date(date_str, time_str)

        return datetime.combine(email.date, datetime.min.time())

    def _parse_date(
        self, date_str: str, time_str: str | None = None, am_pm: str | None = None
    ) -> datetime:
        """Parse date and optional time string with AM/PM support."""
        try:
            # Parse date (DD/MM/YYYY)
            day, month, year = date_str.split("/")
            parsed_date = datetime(int(year), int(month), int(day))

            # Parse time if provided
            if time_str:
                hour, minute = map(int, time_str.split(":"))

                # Handle AM/PM
                if am_pm:
                    if am_pm.upper() == "PM" and hour != 12:
                        hour += 12
                    elif am_pm.upper() == "AM" and hour == 12:
                        hour = 0

                parsed_date = parsed_date.replace(hour=hour, minute=minute)

            return parsed_date
        except (ValueError, AttributeError):
            pass

        # Fallback: try standard formats
        full_str = date_str
        if time_str:
            full_str = f"{date_str} {time_str}"

        formats = [
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y %H:%M",
            "%d-%m-%Y",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(full_str.strip(), fmt)
            except ValueError:
                continue

        return datetime.now()
