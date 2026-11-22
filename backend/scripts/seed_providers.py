"""Konta demo dostawców (status 'zweryfikowany' nadaje ten skrypt – symulacja administratora).
REGON-y mają poprawny FORMAT, nie należą do prawdziwych podmiotów. Hasło demo: demo-haslo-1"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import create_app
from app.auth import hash_password
from app.services.regon import make_regon9
from app.storage import repo
from app.storage.db import get_db

DEMO_PASSWORD = "demo-haslo-1"
ACCOUNTS = [("123456785", "Dostawca Demo 1", "zweryfikowany"),
            (make_regon9("22222222"), "Dostawca Demo 2", "zweryfikowany"),
            (make_regon9("33333333"), "Dostawca Demo (niezweryfikowany)", "zalozony")]

if __name__ == "__main__":
    app = create_app()
    with app.app_context(), get_db():
        for regon, nazwa, status in ACCOUNTS:
            repo.create_provider(regon, nazwa, hash_password(DEMO_PASSWORD), status)
            print(f"{regon}  {nazwa}  [{status}]")
    print("Hasło demo:", DEMO_PASSWORD)
