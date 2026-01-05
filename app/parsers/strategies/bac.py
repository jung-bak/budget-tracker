"""BAC bank email parser using BeautifulSoup."""

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
        """Parse BAC transaction email using BeautifulSoup."""
        if not email.html_body:
            return None

        soup = BeautifulSoup(email.html_body, "html.parser")

        try:
            merchant = self._extract_merchant(soup)
            amount, currency = self._extract_amount(soup)
            card_last4 = self._extract_card(soup)
            timestamp = self._extract_timestamp(soup, email)

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

    def _extract_merchant(self, soup: BeautifulSoup) -> str:
        """Extract merchant name from HTML."""
        # Look for common patterns in BAC emails
        # Pattern 1: Table cell with "Comercio" label
        for td in soup.find_all("td"):
            text = td.get_text(strip=True)
            if "Comercio" in text or "Merchant" in text:
                next_td = td.find_next_sibling("td")
                if next_td:
                    return next_td.get_text(strip=True)

        # Pattern 2: Look for merchant in bold or specific class
        for strong in soup.find_all(["strong", "b"]):
            text = strong.get_text(strip=True)
            if text and len(text) > 3 and not any(
                x in text.lower() for x in ["bac", "monto", "tarjeta", "fecha"]
            ):
                return text

        return ""

    def _extract_amount(self, soup: BeautifulSoup) -> tuple[float, str]:
        """Extract amount in dollars with cents and currency."""
        amount_pattern = re.compile(
            r"(?:USD|CRC|₡|\$)\s*([\d,]+\.?\d*)|"
            r"([\d,]+\.?\d*)\s*(?:USD|CRC|colones|dólares)"
        )

        for td in soup.find_all("td"):
            text = td.get_text(strip=True)
            if "Monto" in text or "Amount" in text:
                next_td = td.find_next_sibling("td")
                if next_td:
                    return self._parse_amount_string(next_td.get_text(strip=True))

        # Fallback: search entire text
        full_text = soup.get_text()
        match = amount_pattern.search(full_text)
        if match:
            return self._parse_amount_string(match.group(0))

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

    def _extract_card(self, soup: BeautifulSoup) -> str:
        """Extract last 4 digits of card."""
        card_pattern = re.compile(r"\*{4,}(\d{4})|[Xx]{4,}(\d{4})|(\d{4})$")

        for td in soup.find_all("td"):
            text = td.get_text(strip=True)
            if "Tarjeta" in text or "Card" in text:
                next_td = td.find_next_sibling("td")
                if next_td:
                    match = card_pattern.search(next_td.get_text(strip=True))
                    if match:
                        return match.group(1) or match.group(2) or match.group(3)

        # Fallback: search entire text
        full_text = soup.get_text()
        match = card_pattern.search(full_text)
        if match:
            return match.group(1) or match.group(2) or match.group(3)

        return ""

    def _extract_timestamp(
        self, soup: BeautifulSoup, email: EmailMessage
    ) -> datetime:
        """Extract transaction timestamp or fall back to email date."""
        date_pattern = re.compile(
            r"(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\s*"
            r"(?:(\d{1,2}:\d{2}(?::\d{2})?)\s*(?:AM|PM|a\.?m\.?|p\.?m\.?)?)?"
        )

        for td in soup.find_all("td"):
            text = td.get_text(strip=True)
            if "Fecha" in text or "Date" in text:
                next_td = td.find_next_sibling("td")
                if next_td:
                    match = date_pattern.search(next_td.get_text(strip=True))
                    if match:
                        return self._parse_date(match.group(0))

        return datetime.combine(email.date, datetime.min.time())

    def _parse_date(self, date_str: str) -> datetime:
        """Parse various date formats."""
        formats = [
            "%d/%m/%Y %H:%M:%S",
            "%d/%m/%Y %H:%M",
            "%d/%m/%Y",
            "%d-%m-%Y %H:%M:%S",
            "%d-%m-%Y %H:%M",
            "%d-%m-%Y",
            "%m/%d/%Y %H:%M:%S",
            "%m/%d/%Y",
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str.strip(), fmt)
            except ValueError:
                continue
        return datetime.now()
