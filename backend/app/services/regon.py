"""Tylko składnia REGON (9 lub 14 cyfr + suma kontrolna). NIE potwierdza tożsamości podmiotu."""
_W9 = (8, 9, 2, 3, 4, 5, 6, 7)
_W14 = (2, 4, 8, 5, 0, 9, 7, 3, 6, 1, 2, 4, 8)


def is_valid_regon_format(regon):
    if not isinstance(regon, str) or not regon.isdigit() or len(regon) not in (9, 14):
        return False
    d = [int(c) for c in regon]
    s = sum(a * b for a, b in zip(d, _W9)) % 11 % 10
    if d[8] != s:
        return False
    if len(regon) == 14:
        s14 = sum(a * b for a, b in zip(d, _W14)) % 11 % 10
        return d[13] == s14
    return True


def make_regon9(first8):
    """Pomocnicze (seed/testy): dopisuje cyfrę kontrolną do 8 cyfr. Wynik ma poprawny FORMAT, nie jest prawdziwym podmiotem."""
    d = [int(c) for c in first8]
    return first8 + str(sum(a * b for a, b in zip(d, _W9)) % 11 % 10)
