"""CSV-based category repository for merchant-to-category mappings."""

import csv
from pathlib import Path

from app.core.config import settings


class CategoryRepository:
    """Repository for persisting merchant-category mappings to CSV."""

    FIELDNAMES = ["merchant", "category"]

    def __init__(self, mappings_path: Path | None = None):
        self.mappings_path = mappings_path or (settings.data_dir / "merchant_categories.csv")
        self._ensure_file_exists()
        self._cache: dict[str, str] = {}
        self._load_cache()

    def _ensure_file_exists(self) -> None:
        """Create mappings file with headers if it doesn't exist."""
        self.mappings_path.parent.mkdir(parents=True, exist_ok=True)
        if not self.mappings_path.exists():
            with open(self.mappings_path, "w", newline="", encoding="utf-8") as f:
                writer = csv.DictWriter(f, fieldnames=self.FIELDNAMES)
                writer.writeheader()

    def _load_cache(self) -> None:
        """Load all mappings into memory cache."""
        self._cache.clear()
        try:
            with open(self.mappings_path, "r", newline="", encoding="utf-8") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    merchant = row.get("merchant", "").strip().lower()
                    category = row.get("category", "").strip()
                    if merchant and category:
                        self._cache[merchant] = category
        except FileNotFoundError:
            pass

    def get_category(self, merchant: str) -> str | None:
        """Look up category for a merchant.

        Args:
            merchant: The merchant name to look up.

        Returns:
            Category string if found, None otherwise.
        """
        return self._cache.get(merchant.strip().lower())

    def set_category(self, merchant: str, category: str) -> None:
        """Set or update the category for a merchant.

        Args:
            merchant: The merchant name.
            category: The category to assign.
        """
        normalized_merchant = merchant.strip().lower()
        if not normalized_merchant or not category.strip():
            return

        self._cache[normalized_merchant] = category.strip()
        self._write_all()

    def _write_all(self) -> None:
        """Rewrite the entire mappings file from cache."""
        with open(self.mappings_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=self.FIELDNAMES)
            writer.writeheader()
            for merchant, category in sorted(self._cache.items()):
                writer.writerow({"merchant": merchant, "category": category})

    def get_all_mappings(self) -> dict[str, str]:
        """Get all merchant-category mappings.

        Returns:
            Dictionary of merchant (lowercase) to category.
        """
        return dict(self._cache)
