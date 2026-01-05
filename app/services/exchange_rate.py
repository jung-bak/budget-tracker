import httpx
from datetime import datetime, timedelta
from app.core.config import settings

class ExchangeRateService:
    BASE_URL = "https://v6.exchangerate-api.com/v6"
    CACHE_DURATION = timedelta(hours=24)

    def __init__(self):
        self._cached_rate: float | None = None
        self._last_fetched: datetime | None = None

    async def get_usd_to_crc_rate(self) -> float:
        """Fetch the current USD to CRC exchange rate."""
        # Check cache
        if (
            self._cached_rate is not None 
            and self._last_fetched is not None 
            and datetime.now() - self._last_fetched < self.CACHE_DURATION
        ):
            return self._cached_rate

        if not settings.exchange_rate_api_key:
             return 515.0 # Fallback default

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/{settings.exchange_rate_api_key}/pair/USD/CRC"
                )
                response.raise_for_status()
                data = response.json()
                rate = data.get("conversion_rate", 515.0)
                
                # Update cache
                self._cached_rate = rate
                self._last_fetched = datetime.now()
                
                return rate
        except Exception as e:
            print(f"Error fetching exchange rate: {e}")
            # serve stale cache if available? Or just default.
            # For now return default or stale if available could be an improvement, 
            # but simple fallback to default 515 is safer if cache is empty.
            if self._cached_rate:
                return self._cached_rate
            return 515.0
