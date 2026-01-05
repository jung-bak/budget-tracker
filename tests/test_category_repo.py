"""Tests for CategoryRepository."""

import tempfile
from pathlib import Path

import pytest

from app.repositories.category_repo import CategoryRepository


@pytest.fixture
def temp_repo():
    """Create a CategoryRepository with a temporary file."""
    temp_dir = tempfile.mkdtemp()
    temp_path = Path(temp_dir) / "test_merchant_categories.csv"

    repo = CategoryRepository(mappings_path=temp_path)
    yield repo

    # Cleanup
    if temp_path.exists():
        temp_path.unlink()
    Path(temp_dir).rmdir()


class TestCategoryRepository:
    """Tests for CategoryRepository."""

    def test_get_category_not_found(self, temp_repo):
        """Should return None for unknown merchant."""
        result = temp_repo.get_category("Unknown Merchant")
        assert result is None

    def test_set_and_get_category(self, temp_repo):
        """Should save and retrieve merchant-category mapping."""
        temp_repo.set_category("Walmart", "Groceries")

        result = temp_repo.get_category("Walmart")
        assert result == "Groceries"

    def test_category_lookup_case_insensitive(self, temp_repo):
        """Should lookup categories case-insensitively."""
        temp_repo.set_category("Starbucks", "Coffee")

        assert temp_repo.get_category("starbucks") == "Coffee"
        assert temp_repo.get_category("STARBUCKS") == "Coffee"
        assert temp_repo.get_category("StarBucks") == "Coffee"

    def test_update_existing_category(self, temp_repo):
        """Should update category for existing merchant."""
        temp_repo.set_category("Target", "Shopping")
        temp_repo.set_category("Target", "Groceries")

        result = temp_repo.get_category("Target")
        assert result == "Groceries"

    def test_category_persists_across_reload(self, temp_repo):
        """Should persist categories to CSV and reload correctly."""
        temp_repo.set_category("Amazon", "Shopping")
        temp_repo.set_category("Shell Gas", "Transportation")

        # Create new repo instance with same path
        new_repo = CategoryRepository(mappings_path=temp_repo.mappings_path)

        assert new_repo.get_category("Amazon") == "Shopping"
        assert new_repo.get_category("Shell Gas") == "Transportation"

    def test_empty_merchant_ignored(self, temp_repo):
        """Should ignore empty merchant names."""
        temp_repo.set_category("", "Groceries")
        temp_repo.set_category("   ", "Groceries")

        assert temp_repo.get_all_mappings() == {}

    def test_empty_category_ignored(self, temp_repo):
        """Should ignore empty category values."""
        temp_repo.set_category("Costco", "")
        temp_repo.set_category("Costco", "   ")

        assert temp_repo.get_category("Costco") is None

    def test_get_all_mappings(self, temp_repo):
        """Should return all mappings."""
        temp_repo.set_category("Store A", "Category A")
        temp_repo.set_category("Store B", "Category B")

        mappings = temp_repo.get_all_mappings()
        assert len(mappings) == 2
        assert mappings["store a"] == "Category A"
        assert mappings["store b"] == "Category B"

    def test_whitespace_trimmed(self, temp_repo):
        """Should trim whitespace from merchant and category."""
        temp_repo.set_category("  Walmart  ", "  Groceries  ")

        result = temp_repo.get_category("Walmart")
        assert result == "Groceries"
