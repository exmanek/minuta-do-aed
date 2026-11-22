#!/usr/bin/env bash
# Uruchamia backend (Flask :5000) i frontend (Vite :5173) jedną komendą. Zatrzymanie: Ctrl+C.
# Użycie: ./start.sh           (dev: dwa serwery, proxy /api)
#         ./start.sh --build   (buduje frontend i uruchamia tylko Flaska na :5000, jeden adres)
set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"
BACK="$ROOT/backend"; FRONT="$ROOT/frontend"
PORT="${PORT:-5000}"; export PORT API_PORT="$PORT"

# --- backend: venv + zależności (tylko gdy trzeba) ---
if [ ! -d "$BACK/venv" ]; then
  echo ">> Tworzę venv i instaluję zależności backendu..."
  python3 -m venv "$BACK/venv"
  "$BACK/venv/bin/pip" install -q -r "$BACK/requirements.txt"
fi
PY="$BACK/venv/bin/python"
"$BACK/venv/bin/pip" install -q -r "$BACK/requirements.txt"   # idempotentne; dociąga nowe zależności (np. certifi)

# --- dane demo (idempotentne; konta + 15 fikcyjnych punktów) ---
( cd "$BACK" && "$PY" scripts/seed_providers.py >/dev/null && "$PY" scripts/seed_demo.py >/dev/null )
echo ">> Konta demo: REGON 123456785, hasło: demo-haslo-1"

# --- frontend ---
if [ ! -d "$FRONT/node_modules" ]; then
  echo ">> Instaluję zależności frontendu (npm install)..."
  ( cd "$FRONT" && npm install --silent )
fi

if [ "$1" = "--build" ]; then
  ( cd "$FRONT" && npm run build --silent )
  echo ">> Aplikacja: http://127.0.0.1:$PORT"
  cd "$BACK" && exec "$PY" run.py
fi

cleanup() { echo; echo ">> Zatrzymuję..."; kill $BPID $FPID 2>/dev/null || true; }
trap cleanup EXIT INT TERM
( cd "$BACK" && exec "$PY" run.py ) & BPID=$!
( cd "$FRONT" && exec npm run dev --silent ) & FPID=$!
echo ">> Backend:  http://127.0.0.1:$PORT/api/v1/health"
echo ">> Frontend: http://localhost:5173   (Ctrl+C zatrzymuje oba)"
wait
