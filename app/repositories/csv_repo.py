"""CSV-based transaction repository."""

import csv
from datetime import datetime
from pathlib import Path

from app.core.config import settings
from app.core.models import Transaction


class CSVRepository:
    """Repository for persisting transactions to CSV."""

    FIELDNAMES = [
        "global_id",
        "timestamp",
        "merchant",
        "amount",
        "currency",
        "institution",
        "payment_instrument",
        "notes",
    ]

    def __init__(self, ledger_path: Path | None = None):
        self.ledger_path = ledger_path or settings.ledger_path
        self._ensure_file_exists()

    def _ensure_file_exists(self) -> None:
        """Create ledger file with headers if it doesn't exist."""
        self.ledger_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.ledger_path.exists():
            with open(self.ledger_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=self.FIELDNAMES)
                writer.writeheader()

    def exists(self, global_id: str) -> bool:
        """Check if a transaction with the given ID already exists."""
        existing_ids = self._get_existing_ids()
        return global_id in existing_ids

    def _get_existing_ids(self) -> set[str]:
        """Get set of all existing transaction IDs."""
        ids = set()
        try:
            with open(self.ledger_path, "r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    if "global_id" in row:
                        ids.add(row["global_id"])
        except FileNotFoundError:
            pass
        return ids

    def save(self, transaction: Transaction) -> bool:
        """Save a transaction to the ledger.

        Args:
            transaction: The transaction to save.

        Returns:
            True if saved, False if duplicate.
        """
        if self.exists(transaction.global_id):
            return False

        with open(self.ledger_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.FIELDNAMES)
            writer.writerow(self._transaction_to_row(transaction))

        return True

    def save_many(self, transactions: list[Transaction]) -> int:
        """Save multiple transactions, skipping duplicates.

        Args:
            transactions: List of transactions to save.

        Returns:
            Number of transactions saved.
        """
        existing_ids = self._get_existing_ids()
        saved = 0

        with open(self.ledger_path, "a", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.FIELDNAMES)
            for txn in transactions:
                if txn.global_id not in existing_ids:
                    writer.writerow(self._transaction_to_row(txn))
                    existing_ids.add(txn.global_id)
                    saved += 1

        return saved

    def get_all(self) -> list[Transaction]:
        """Retrieve all transactions from the ledger."""
        transactions = []
        try:
            with open(self.ledger_path, "r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    txn = self._row_to_transaction(row)
                    if txn:
                        transactions.append(txn)
        except FileNotFoundError:
            pass
        return transactions

    def delete(self, global_id: str) -> bool:
        """Delete a transaction by its global_id.

        Args:
            global_id: The unique identifier of the transaction to delete.

        Returns:
            True if deleted, False if not found.
        """
        transactions = self.get_all()
        original_count = len(transactions)
        filtered = [txn for txn in transactions if txn.global_id != global_id]

        if len(filtered) == original_count:
            return False

        self._write_all(filtered)
        return True

    def update(self, global_id: str, transaction: Transaction) -> bool:
        """Update a transaction by its global_id.

        Args:
            global_id: The unique identifier of the transaction to update.
            transaction: The new transaction data.

        Returns:
            True if updated, False if not found.
        """
        transactions = self.get_all()
        found = False

        for i, txn in enumerate(transactions):
            if txn.global_id == global_id:
                transactions[i] = transaction
                found = True
                break

        if not found:
            return False

        self._write_all(transactions)
        return True

    def _write_all(self, transactions: list[Transaction]) -> None:
        """Rewrite the entire ledger with the given transactions."""
        with open(self.ledger_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.FIELDNAMES)
            writer.writeheader()
            for txn in transactions:
                writer.writerow(self._transaction_to_row(txn))

    def _transaction_to_row(self, txn: Transaction) -> dict:
        """Convert Transaction to CSV row dict."""
        return {
            "global_id": txn.global_id,
            "timestamp": txn.timestamp.isoformat(),
            "merchant": txn.merchant,
            "amount": txn.amount,
            "currency": txn.currency,
            "institution": txn.institution,
            "payment_instrument": txn.payment_instrument,
            "notes": txn.notes,
        }

    def _row_to_transaction(self, row: dict) -> Transaction | None:
        """Convert CSV row dict to Transaction."""
        try:
            return Transaction(
                timestamp=datetime.fromisoformat(row["timestamp"]),
                merchant=row["merchant"],
                amount=float(row["amount"]),
                currency=row["currency"],
                institution=row["institution"],
                payment_instrument=row["payment_instrument"],
                notes=row.get("notes", ""),
            )
        except (KeyError, ValueError):
            return None
