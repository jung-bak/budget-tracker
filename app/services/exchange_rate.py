import httpx
from app.core.config import settings

class ExchangeRateService:
    BASE_URL = "https://v6.exchangerate-api.com/v6"

    async def get_usd_to_crc_rate(self) -> float:
        """Fetch the current USD to CRC exchange rate."""
        if not settings.exchange_rate_api_key:
             return 515.0 # Fallback default

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.BASE_URL}/{settings.exchange_rate_api_key}/pair/USD/CRC"
                )
                response.raise_for_status()
                data = response.json()
                return data.get("conversion_rate", 515.0)
        except Exception as e:
            print(f"Error fetching exchange rate: {e}")
            return 515.0
