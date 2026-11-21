from datetime import date


def znacznik_aktualnosci(data_potwierdzenia, prog_dni=365, today=None):
    """Liczony wyłącznie z data_ostatniego_potwierdzenia."""
    if not data_potwierdzenia:
        return "niepotwierdzone"
    today = today or date.today()
    try:
        d = date.fromisoformat(data_potwierdzenia)
    except ValueError:
        return "niepotwierdzone"
    return "aktualne" if (today - d).days <= prog_dni else "do_odswiezenia"
