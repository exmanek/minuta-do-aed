import pytest
from app import create_app


@pytest.fixture
def client(tmp_path):
    app = create_app({"TESTING": True, "DB_PATH": str(tmp_path / "t.db"), "FRONTEND_DIST": str(tmp_path / "nodist")})
    return app.test_client()
