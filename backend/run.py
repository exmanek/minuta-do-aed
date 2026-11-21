import os

from app import create_app

app = create_app()

if __name__ == "__main__":
    # Uwaga macOS: AirPlay Receiver zajmuje localhost:5000 (IPv4/IPv6). Flask słucha na 127.0.0.1;
    # w razie problemów ustaw PORT=5001 oraz API_PORT=5001 dla Vite.
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=True)
