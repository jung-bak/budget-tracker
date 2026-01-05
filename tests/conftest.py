import os

import pytest
from fastapi.testclient import TestClient

# Set environment variables for testing before importing app
os.environ["API_KEY"] = "test-api-key"
os.environ["IMAP_HOST"] = "imap.test.com"
os.environ["IMAP_USER"] = "test@test.com"
os.environ["IMAP_PASSWORD"] = "test-pass"

from app.main import app


@pytest.fixture
def client():
    """Test client with API key authentication header."""
    return TestClient(app, headers={"X-API-Key": "test-api-key"})
