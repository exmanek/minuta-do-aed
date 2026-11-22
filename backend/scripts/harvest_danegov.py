"""Pobiera dane o AED z portalu dane.gov.pl do bazy aplikacji (ten sam przepływ co w panelu dostawcy).

Przykłady (z katalogu backend/):
  python scripts/harvest_danegov.py --regon 123456785 --dry-run            # tylko pobierz i pokaż, nic nie zapisuj
  python scripts/harvest_danegov.py --regon 123456785                      # utwórz partię, zmapuj, zwaliduj (bez zatwierdzenia)
  python scripts/harvest_danegov.py --regon 123456785 --commit --accept-declarations --reject-invalid

Hasło: zmienna HARVEST_PASSWORD albo pytanie w terminalu. Zatwierdzenie (--commit) wymaga WYRAŹNEJ flagi
--accept-declarations: składasz w ten sposób oświadczenia dostawcy (prawdziwość danych i prawo do udostępniania).
Uruchomienie z crona = ponowny import aktualizuje te same rekordy (klucz: źródło + identyfikator rekordu)."""
import argparse
import getpass
import os
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
from app import create_app
from app.auth import check_password
from app.errors import ApiError
from app.services import danegov, declarations, ingest, pipeline
from app.storage import repo


def say(msg=""):
    print(msg, flush=True)


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--regon", required=True, help="REGON zweryfikowanego dostawcy (konto w aplikacji)")
    ap.add_argument("--datasets", nargs="*", help="identyfikatory zbiorów (domyślnie wszystkie możliwe do pobrania)")
    ap.add_argument("--dry-run", action="store_true", help="pobierz i sprawdź pliki, nie zapisuj nic w bazie")
    ap.add_argument("--commit", action="store_true", help="zatwierdź dane po walidacji (wymaga --accept-declarations)")
    ap.add_argument("--accept-declarations", action="store_true", help="składam oświadczenia dostawcy (prawdziwość, prawo do udostępniania)")
    ap.add_argument("--reject-invalid", action="store_true", help="przy zatwierdzaniu odrzuć rekordy z błędami blokującymi")
    ap.add_argument("--confirm-currency", action="store_true", help="dodatkowo potwierdzam aktualność danych (ustawia datę potwierdzenia)")
    args = ap.parse_args(argv)
    if args.commit and not args.accept_declarations:
        ap.error("--commit wymaga --accept-declarations (świadome złożenie oświadczeń)")

    app = create_app()
    with app.app_context():
        provider = repo.get_provider(args.regon)
        password = os.environ.get("HARVEST_PASSWORD") or getpass.getpass("Hasło dostawcy: ")
        if not provider or not check_password(provider, password):
            sys.exit("Błędny REGON lub hasło.")
        if provider["status_weryfikacji"] != "zweryfikowany":
            sys.exit("Konto dostawcy nie zostało zweryfikowane przez administratora.")
        try:
            catalog = danegov.discover(refresh=True)
        except ApiError as e:
            sys.exit(f"Portal dane.gov.pl: {e.message}")
        say(f"Katalog dane.gov.pl ({catalog['pobrano']}): {len(catalog['items'])} zbiorów AED")
        chosen = []
        for it in catalog["items"]:
            wanted = not args.datasets or it["dataset_id"] in args.datasets
            state = "POBIERZ" if wanted and it["mozna_importowac"] else ("pominięty" if not wanted else "NIEDOSTĘPNY")
            z = it["zasob"]
            say(f"  [{state:12}] {it['dataset_id']:>6} {it['tytul'][:50]:50} | {it['wydawca']['nazwa']} | {it['licencja']} | "
                f"{(z['format'] + ', ' + str(z['data'])) if z else it['powod_pominiecia']}")
            if wanted and it["mozna_importowac"]:
                chosen.append(it)
        if not chosen:
            sys.exit("Nic do pobrania.")

        files, metas = [], []
        for it in chosen:
            try:
                name, raw = danegov.download(it)
                parsed = ingest.parse_file(name, raw)
            except ApiError as e:
                say(f"  ! {it['dataset_id']}: pomijam – {e.message}")
                continue
            say(f"  ✓ {it['dataset_id']}: {parsed['liczba_wierszy']} wierszy ({parsed['format']}, kolumny: {', '.join(parsed['naglowki'][:6])}…)")
            for n in parsed["uwagi"]:
                say(f"      uwaga: {n}")
            files.append((name, raw)); metas.append(danegov.source_meta(it))
        if args.dry_run:
            say("Tryb --dry-run: nic nie zapisano.")
            return 0
        if not files:
            sys.exit("Żaden plik nie nadaje się do importu.")

        batch_id = pipeline.create_batch(provider, files, metas)
        batch = repo.get_batch(batch_id)
        view = pipeline.batch_view(batch)
        pipeline.approve_mapping(batch, {z["zrodlo_id"]: {m["kolumna"]: m["pole"] for m in z["proponowane_mapowanie"]} for z in view["zrodla"]})
        res = pipeline.process_batch(repo.get_batch(batch_id), provider)
        s = res["podsumowanie"]
        say(f"Partia {batch_id}: rekordów {s['rekordy']}, z błędami blokującymi {s['z_bledami']}, z ostrzeżeniami {s['z_ostrzezeniami']}, "
            f"duplikaty w partii {s['kandydaci_duplikatow']['w_partii']}, aktualizacje istniejących {s['zaktualizowane_istniejace']}")
        if not args.commit:
            say("Dane NIE są jeszcze zatwierdzone. Zatwierdź w panelu dostawcy albo uruchom ponownie z --commit --accept-declarations.")
            return 0
        out = pipeline.commit_batch(repo.get_batch(batch_id), provider, {
            "oswiadczenie_prawdziwosci": True, "oswiadczenie_prawa_do_udostepniania": True, "wersja_tresci": declarations.VERSION,
            "potwierdzam_aktualnosc": args.confirm_currency, "odrzuc_bledne": args.reject_invalid})
        say(f"Zatwierdzono: {out['zatwierdzone']}, odrzucono: {out['odrzucone']}, scalono: {out['scalone']}. "
            f"({out['publikacja_dane_gov_pl']}: to nie jest publikacja w dane.gov.pl)")
        return 0


if __name__ == "__main__":
    sys.exit(main())
