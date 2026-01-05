"""FastAPI application entry point."""

from pathlib import Path

from fastapi import Depends, FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.security import APIKeyHeader
from fastapi.staticfiles import StaticFiles

from app.adapters.imap_client import ImapAdapter
from app.core.config import settings
from app.core.models import BackfillRequest, SyncResult, Transaction, TransactionUpdate
from app.parsers.factory import ParserFactory
from app.repositories.csv_repo import CSVRepository

api_key_header = APIKeyHeader(name="X-API-Key", auto_error=False)


async def get_api_key(api_key: str | None = Depends(api_key_header)) -> str:
    """Validate API key from request header."""
    if not settings.api_key:
        raise HTTPException(
            status_code=500,
            detail="API_KEY not configured on server",
        )
    if api_key != settings.api_key:
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing API key",
        )
    return api_key

app = FastAPI(
    title="Email-to-Ledger API",
    description="Universal Transaction Gateway - Ingest bank transaction emails",
    version="0.1.0",
)

# Initialize components
imap_adapter = ImapAdapter()
parser_factory = ParserFactory()
csv_repo = CSVRepository()


@app.get("/")
def root():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "Email-to-Ledger API",
        "supported_institutions": parser_factory.supported_institutions,
    }


@app.post("/sync", response_model=SyncResult)
def sync_emails(_: str = Depends(get_api_key)):
    """Fetch unseen emails, parse transactions, and save to ledger.

    Returns:
        SyncResult with counts of processed, errors, and skipped transactions.
    """
    result = SyncResult()

    try:
        for email in imap_adapter.fetch_unseen():
            strategy = parser_factory.get_strategy(email)
            if not strategy:
                result.skipped += 1
                continue

            transaction = strategy.parse(email)
            if transaction:
                if csv_repo.save(transaction):
                    result.processed += 1
                else:
                    result.skipped += 1  # Duplicate
            else:
                result.errors += 1
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sync failed: {str(e)}")

    return result


@app.post("/backfill", response_model=SyncResult)
def backfill_emails(request: BackfillRequest, _: str = Depends(get_api_key)):
    """Fetch emails within a date range and process them.

    Args:
        request: BackfillRequest with start_date and end_date.

    Returns:
        SyncResult with counts of processed, errors, and skipped transactions.
    """
    result = SyncResult()

    try:
        for email in imap_adapter.fetch_by_date_range(request.start_date, request.end_date):
            strategy = parser_factory.get_strategy(email)
            if not strategy:
                result.skipped += 1
                continue

            transaction = strategy.parse(email)
            if transaction:
                if csv_repo.save(transaction):
                    result.processed += 1
                else:
                    result.skipped += 1  # Duplicate
            else:
                result.errors += 1
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Backfill failed: {str(e)}")

    return result


@app.get("/transactions", response_model=list[Transaction])
def get_transactions(_: str = Depends(get_api_key)):
    """Retrieve all transactions from the ledger.

    Returns:
        List of all stored Transaction objects.
    """
    return csv_repo.get_all()


@app.get("/transactions/summary")
def get_summary():
    """Get summary statistics of stored transactions.

    Returns:
        Summary including total count, by institution, and by currency.
    """
    transactions = csv_repo.get_all()

    by_institution: dict[str, int] = {}
    by_currency: dict[str, int] = {}
    total_by_currency: dict[str, int] = {}

    for txn in transactions:
        by_institution[txn.institution] = by_institution.get(txn.institution, 0) + 1
        by_currency[txn.currency] = by_currency.get(txn.currency, 0) + 1
        total_by_currency[txn.currency] = (
            total_by_currency.get(txn.currency, 0) + txn.amount
        )

    return {
        "total_transactions": len(transactions),
        "by_institution": by_institution,
        "by_currency": by_currency,
        "total_amount_by_currency": {
            curr: amt / 100 for curr, amt in total_by_currency.items()
        },
    }


@app.delete("/transactions/{global_id}")
def delete_transaction(global_id: str, _: str = Depends(get_api_key)):
    """Delete a transaction by its global_id.

    Args:
        global_id: The unique identifier of the transaction to delete.

    Returns:
        Success message or 404 if not found.
    """
    if csv_repo.delete(global_id):
        return {"message": "Transaction deleted", "global_id": global_id}
    raise HTTPException(status_code=404, detail="Transaction not found")


@app.put("/transactions/{global_id}", response_model=Transaction)
def update_transaction(
    global_id: str,
    update: TransactionUpdate,
    _: str = Depends(get_api_key),
):
    """Update a transaction by its global_id.

    Args:
        global_id: The unique identifier of the transaction to update.
        update: The new transaction data.

    Returns:
        The updated Transaction or 404 if not found.
    """
    transaction = update.to_transaction()
    if csv_repo.update(global_id, transaction):
        return transaction
    raise HTTPException(status_code=404, detail="Transaction not found")


# Static files directory
static_dir = Path(__file__).parent.parent / "static"
static_dir.mkdir(exist_ok=True)


@app.get("/ui")
def serve_ui():
    """Serve the web UI."""
    index_path = static_dir / "index.html"
    if index_path.exists():
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="UI not found")


# Mount static files for assets
app.mount("/static", StaticFiles(directory=static_dir), name="static")
