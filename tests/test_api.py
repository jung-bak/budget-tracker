"""Tests for FastAPI endpoints."""

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root_endpoint():
    """Health check should return healthy status."""
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert "supported_institutions" in data


def test_get_transactions_empty():
    """Get transactions should return list (may be empty)."""
    response = client.get("/transactions")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_summary():
    """Summary endpoint should return valid structure."""
    response = client.get("/transactions/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_transactions" in data
    assert "by_institution" in data
    assert "by_currency" in data
