# Budget Tracker

Universal Transaction Gateway - A FastAPI backend that ingests financial transaction emails via IMAP, parses them using bank-specific strategies, and stores normalized data in a CSV ledger.

## Features

- **Email Ingestion**: Fetch transaction notification emails via IMAP
- **Multi-Bank Support**: Extensible parser strategies for different financial institutions
  - BAC Credomatic (HTML parsing with BeautifulSoup)
  - Davivienda (Regex-based text parsing)
- **Deduplication**: SHA-256 based transaction IDs prevent duplicates
- **REST API**: FastAPI endpoints for sync, backfill, and querying transactions
- **Dockerized**: Ready for containerized deployment

## Project Structure

```
budget-tracker/
├── app/
│   ├── main.py              # FastAPI entry point & endpoints
│   ├── core/
│   │   ├── config.py        # Settings loaded from .env
│   │   ├── models.py        # Pydantic models (Transaction, etc.)
│   │   └── utils.py         # Date/currency utilities
│   ├── adapters/
│   │   └── imap_client.py   # IMAP email fetching adapter
│   ├── parsers/
│   │   ├── factory.py       # ParserFactory for strategies
│   │   └── strategies/
│   │       ├── base.py      # ParserStrategy abstract base
│   │       ├── bac.py       # BAC Credomatic parser
│   │       └── davivienda.py # Davivienda parser
│   └── repositories/
│       └── csv_repo.py      # CSV ledger persistence
├── static/                  # Frontend assets
│   ├── index.html           # Web UI
│   ├── styles.css           # Styles
│   └── app.js               # Frontend logic
├── tests/                   # Pytest test suite
├── data/                    # Ledger storage directory
├── Dockerfile
├── docker-compose.yml
├── pyproject.toml           # Dependencies & config
└── .env.example             # Environment template
```

## Quick Start

### Prerequisites

- Python 3.11+
- [uv](https://docs.astral.sh/uv/) package manager

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd budget-tracker

# Install dependencies
uv sync
```

### Configuration

1. Copy the environment template:

   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your credentials:

   ```env
   # API Security (required)
   API_KEY=your-secret-api-key

   # IMAP Configuration
   IMAP_HOST=imap.gmail.com
   IMAP_USER=your-email@gmail.com
   IMAP_PASSWORD=your-app-password
   IMAP_FOLDER=INBOX
   ```

   > **Note**: For Gmail, use an [App Password](https://support.google.com/accounts/answer/185833) rather than your account password.

### Running Locally

```bash
# Start the development server
uv run uvicorn app.main:app --reload

# Access the API at http://localhost:8000
# Swagger UI at http://localhost:8000/docs
```

### Running with Docker

```bash
# Build and start
docker-compose up --build

# The API will be available at http://localhost:8000
```

## API Endpoints

| Method   | Endpoint                    | Auth | Description                                    |
| -------- | --------------------------- | ---- | ---------------------------------------------- |
| `GET`    | `/`                         | No   | Serve Web UI                                   |
| `GET`    | `/health`                   | No   | Health check and supported institutions        |
| `POST`   | `/sync`                     | Yes  | Fetch unseen emails, parse, and save to ledger |
| `POST`   | `/backfill`                 | Yes  | Process emails within a date range             |
| `GET`    | `/transactions`             | Yes  | List all stored transactions                   |
| `GET`    | `/transactions/summary`     | No   | Get summary statistics                         |
| `PUT`    | `/transactions/{global_id}` | Yes  | Update a transaction                           |
| `DELETE` | `/transactions/{global_id}` | Yes  | Delete a transaction                           |

### Authentication

Protected endpoints require an API key via the `X-API-Key` header:

```bash
curl -H "X-API-Key: your-secret-api-key" http://localhost:8000/transactions
```

### Examples

**Sync new emails:**

```bash
curl -X POST http://localhost:8000/sync \
  -H "X-API-Key: your-secret-api-key"
```

**Backfill historical data:**

```bash
curl -X POST http://localhost:8000/backfill \
  -H "X-API-Key: your-secret-api-key" \
  -H "Content-Type: application/json" \
  -d '{"start_date": "2025-01-01", "end_date": "2025-01-31"}'
```

**Get all transactions:**

```bash
curl -H "X-API-Key: your-secret-api-key" http://localhost:8000/transactions
```

## Transaction Model

Each transaction is normalized to:

| Field                | Type     | Description                       |
| -------------------- | -------- | --------------------------------- |
| `global_id`          | string   | SHA-256 hash for deduplication    |
| `timestamp`          | datetime | Transaction timestamp (ISO 8601)  |
| `merchant`           | string   | Merchant/payee name               |
| `amount`             | float    | Amount in dollars (e.g. 10.99)    |
| `currency`           | string   | Currency code (USD, CRC)          |
| `institution`        | string   | Bank identifier (BAC, Davivienda) |
| `payment_instrument` | string   | Last 4 digits of card             |
| `notes`              | string   | User notes                        |
| `category`           | string   | Transaction category              |

## Development

### Running Tests

```bash
uv run pytest -v
```

### Linting

```bash
uv run ruff check .
uv run ruff format .
```

### Adding a New Bank Parser

1. Create a new strategy in `app/parsers/strategies/`:

   ```python
   from app.parsers.strategies.base import ParserStrategy

   class NewBankParserStrategy(ParserStrategy):
       @property
       def institution(self) -> str:
           return "NewBank"

       def can_parse(self, email: EmailMessage) -> bool:
           # Check if email is from this bank
           ...

       def parse(self, email: EmailMessage) -> Transaction | None:
           # Extract transaction data
           ...
   ```

2. Register it in `app/parsers/factory.py`:

   ```python
   from app.parsers.strategies.newbank import NewBankParserStrategy

   class ParserFactory:
       def __init__(self):
           self._strategies = [
               BACParserStrategy(),
               DaviviendaParserStrategy(),
               NewBankParserStrategy(),  # Add here
           ]
   ```

## License

MIT
