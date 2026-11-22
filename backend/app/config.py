import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev-only-change-me")
    DB_PATH = os.environ.get("DB_PATH", str(BASE_DIR / "data" / "aed.db"))
    STANDARD_XLSX = os.environ.get(
        "STANDARD_XLSX", str(BASE_DIR / "data" / "standard" / "Wzorcowy_zakres_danych_AED.xlsx")
    )
    FRONTEND_DIST = os.environ.get("FRONTEND_DIST", str(BASE_DIR.parent / "frontend" / "dist"))
    PROG_AKTUALNOSCI_DNI = int(os.environ.get("PROG_AKTUALNOSCI_DNI", "365"))
    CSV_DELIMITER = os.environ.get("CSV_DELIMITER", ";")
    REPORT_LIMIT_PER_HOUR = 5
    # Metryczka robocza: wartości do ustalenia (decyzja D9)
    METADATA_LICENSE = os.environ.get("METADATA_LICENSE", "do-ustalenia (D9)")
    METADATA_CATEGORY = os.environ.get("METADATA_CATEGORY", "do-ustalenia")
    METADATA_UPDATE_FREQUENCY = os.environ.get("METADATA_UPDATE_FREQUENCY", "irregular")
    METADATA_REGIONS = []
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024
