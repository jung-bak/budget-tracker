"""IMAP client adapter for fetching emails."""

from dataclasses import dataclass
from datetime import date
from typing import Iterator

from imap_tools import AND, MailBox, MailMessage

from app.core.config import settings


@dataclass
class EmailMessage:
    """Simplified email message for parsing."""

    uid: str
    sender: str
    subject: str
    date: date
    html_body: str
    text_body: str


class ImapAdapter:
    """Adapter for IMAP email fetching."""

    def __init__(
        self,
        host: str | None = None,
        user: str | None = None,
        password: str | None = None,
        folder: str | None = None,
    ):
        self.host = host or settings.imap_host
        self.user = user or settings.imap_user
        self.password = password or settings.imap_password
        self.folder = folder or settings.imap_folder

    def _to_email_message(self, msg: MailMessage) -> EmailMessage:
        """Convert imap_tools message to our simplified format."""
        return EmailMessage(
            uid=msg.uid,
            sender=msg.from_,
            subject=msg.subject,
            date=msg.date.date() if msg.date else date.today(),
            html_body=msg.html or "",
            text_body=msg.text or "",
        )

    def fetch_unseen(self) -> Iterator[EmailMessage]:
        """Fetch all unseen messages from the configured folder."""
        with MailBox(self.host).login(self.user, self.password, self.folder) as mailbox:
            for msg in mailbox.fetch(AND(seen=False)):
                yield self._to_email_message(msg)

    def fetch_by_date_range(
        self, start_date: date, end_date: date
    ) -> Iterator[EmailMessage]:
        """Fetch messages within a date range."""
        with MailBox(self.host).login(self.user, self.password, self.folder) as mailbox:
            for msg in mailbox.fetch(AND(date_gte=start_date, date_lt=end_date)):
                yield self._to_email_message(msg)

    def mark_as_seen(self, uids: list[str]) -> None:
        """Mark messages as seen by UID."""
        with MailBox(self.host).login(self.user, self.password, self.folder) as mailbox:
            mailbox.seen(uids, True)
