"""Application configuration using environment variables."""

import os
from pathlib import Path

from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()


class Settings(BaseModel):
    """Application settings loaded from environment."""

    api_key: str = os.getenv("API_KEY", "")

    imap_host: str = os.getenv("IMAP_HOST", "")
    imap_user: str = os.getenv("IMAP_USER", "")
    imap_password: str = os.getenv("IMAP_PASSWORD", "")
    imap_folder: str = os.getenv("IMAP_FOLDER", "INBOX")

    exchange_rate_api_key: str = os.getenv("EXCHANGE_RATE_API_KEY", "")

    data_dir: Path = Path(os.getenv("DATA_DIR", "data"))
    ledger_file: str = os.getenv("LEDGER_FILE", "ledger.csv")

    @property
    def ledger_path(self) -> Path:
        return self.data_dir / self.ledger_file


settings = Settings()
