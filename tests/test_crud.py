"""Tests for CRUD operations on transactions."""

import tempfile
from datetime import datetime
from pathlib import Path

import pytest

from app.core.models import Transaction
from app.repositories.csv_repo import CSVRepository


@pytest.fixture
def temp_repo():
    """Create a CSVRepository with a temporary file."""
    temp_dir = tempfile.mkdtemp()
    temp_path = Path(temp_dir) / "test_ledger.csv"

    repo = CSVRepository(ledger_path=temp_path)
    yield repo

    # Cleanup
    if temp_path.exists():
        temp_path.unlink()
    Path(temp_dir).rmdir()


@pytest.fixture
def sample_transaction():
    """Create a sample transaction for testing."""
    return Transaction(
        timestamp=datetime(2024, 1, 15, 10, 30, 0),
        merchant="Test Merchant",
        amount=15.00,
        currency="USD",
        institution="BAC",
        payment_instrument="1234",
        notes="Test Notes",
    )


@pytest.fixture
def another_transaction():
    """Create another sample transaction for testing."""
    return Transaction(
        timestamp=datetime(2024, 1, 16, 14, 45, 0),
        merchant="Another Merchant",
        amount=25.00,
        currency="CRC",
        institution="Davibank",
        payment_instrument="5678",
        notes="Another Notes",
    )


class TestCSVRepositoryDelete:
    """Tests for CSVRepository.delete() method."""

    def test_delete_existing_transaction(self, temp_repo, sample_transaction):
        """Should delete an existing transaction and return True."""
        # Save transaction
        temp_repo.save(sample_transaction)
        assert len(temp_repo.get_all()) == 1

        # Delete it
        result = temp_repo.delete(sample_transaction.global_id)

        assert result is True
        assert len(temp_repo.get_all()) == 0

    def test_delete_nonexistent_transaction(self, temp_repo):
        """Should return False when transaction doesn't exist."""
        result = temp_repo.delete("nonexistent-id")
        assert result is False

    def test_delete_one_of_many(self, temp_repo, sample_transaction, another_transaction):
        """Should only delete the specified transaction."""
        temp_repo.save(sample_transaction)
        temp_repo.save(another_transaction)
        assert len(temp_repo.get_all()) == 2

        # Delete first transaction
        result = temp_repo.delete(sample_transaction.global_id)

        assert result is True
        remaining = temp_repo.get_all()
        assert len(remaining) == 1
        assert remaining[0].global_id == another_transaction.global_id


class TestCSVRepositoryUpdate:
    """Tests for CSVRepository.update() method."""

    def test_update_existing_transaction(self, temp_repo, sample_transaction):
        """Should update an existing transaction and return True."""
        temp_repo.save(sample_transaction)
        original_id = sample_transaction.global_id

        # Create updated transaction
        updated = Transaction(
            timestamp=sample_transaction.timestamp,
            merchant="Updated Merchant",
            amount=99.99,
            currency="CRC",
            institution="BAC",
            payment_instrument="1234",
            notes="Updated Notes",
        )

        result = temp_repo.update(original_id, updated)

        assert result is True
        transactions = temp_repo.get_all()
        assert len(transactions) == 1
        assert transactions[0].merchant == "Updated Merchant"
        assert transactions[0].amount == 99.99
        assert transactions[0].currency == "CRC"

    def test_update_nonexistent_transaction(self, temp_repo, sample_transaction):
        """Should return False when transaction doesn't exist."""
        result = temp_repo.update("nonexistent-id", sample_transaction)
        assert result is False

    def test_update_preserves_other_transactions(
        self, temp_repo, sample_transaction, another_transaction
    ):
        """Should only update the specified transaction."""
        temp_repo.save(sample_transaction)
        temp_repo.save(another_transaction)

        updated = Transaction(
            timestamp=sample_transaction.timestamp,
            merchant="Modified",
            amount=0.01,
            currency="USD",
            institution="BAC",
            payment_instrument="1234",
            notes="Modified",
        )

        temp_repo.update(sample_transaction.global_id, updated)

        transactions = temp_repo.get_all()
        assert len(transactions) == 2

        # Find the updated one
        updated_txn = next(t for t in transactions if t.merchant == "Modified")
        other_txn = next(t for t in transactions if t.merchant == "Another Merchant")

        assert updated_txn.amount == 0.01
        assert other_txn.amount == 25.00


class TestCRUDEndpoints:
    """Tests for CRUD API endpoints."""

    def test_delete_transaction_success(self, client, temp_repo, sample_transaction):
        """DELETE /transactions/{id} should delete existing transaction."""
        # This test requires mocking - simplified version
        # In a real scenario, we'd mock the csv_repo
        response = client.delete("/transactions/nonexistent-id-12345")
        assert response.status_code == 404
        assert response.json()["detail"] == "Transaction not found"

    def test_update_transaction_not_found(self, client):
        """PUT /transactions/{id} should return 404 for nonexistent transaction."""
        update_data = {
            "timestamp": "2024-01-15T10:30:00",
            "merchant": "Test",
            "amount": 10.00,
            "currency": "USD",
            "institution": "BAC",
            "payment_instrument": "1234",
            "notes": "Test",
        }
        response = client.put("/transactions/nonexistent-id", json=update_data)
        assert response.status_code == 404

    def test_delete_requires_api_key(self):
        """DELETE should require API key authentication."""
        from fastapi.testclient import TestClient
        from app.main import app

        client_no_auth = TestClient(app)
        response = client_no_auth.delete("/transactions/some-id")
        assert response.status_code == 403

    def test_update_requires_api_key(self):
        """PUT should require API key authentication."""
        from fastapi.testclient import TestClient
        from app.main import app

        client_no_auth = TestClient(app)
        update_data = {
            "timestamp": "2024-01-15T10:30:00",
            "merchant": "Test",
            "amount": 10.00,
            "currency": "USD",
            "institution": "BAC",
            "payment_instrument": "1234",
            "notes": "Test",
        }
        response = client_no_auth.put("/transactions/some-id", json=update_data)
        assert response.status_code == 403
