import os
import shutil
import tempfile
from pathlib import Path

_DATA = Path(tempfile.mkdtemp(prefix="rms-test-"))
os.environ["RMS_DATA_DIR"] = str(_DATA)
os.environ["RMS_SECRET_KEY"] = "test-secret-key-that-is-long-enough-for-hs256"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from backend.core import db, migrate  # noqa: E402
from backend.core.config import get_settings  # noqa: E402
from backend.core.security import throttle  # noqa: E402

_TEMPLATE = _DATA / "template.db"


@pytest.fixture(scope="session", autouse=True)
def _template_db():
    engine = db.make_engine(f"sqlite:///{_TEMPLATE}")
    migrate.upgrade(engine)
    engine.dispose()
    yield
    shutil.rmtree(_DATA, ignore_errors=True)


@pytest.fixture(autouse=True)
def fresh_db(tmp_path):
    path = tmp_path / "rms.db"
    shutil.copy(_TEMPLATE, path)
    shutil.rmtree(get_settings().backups_dir, ignore_errors=True)  # backups must not leak between tests
    db.rebind(db.make_engine(f"sqlite:///{path}"))
    throttle._failures.clear()
    yield path
    db.engine.dispose()


@pytest.fixture
def client():
    from backend.main import create_app

    with TestClient(create_app()) as c:
        yield c


SETUP = {
    "organization": "Northside Academy",
    "currency": "EUR",
    "name": "Ada Admin",
    "username": "admin",
    "password": "correct-horse",
}


@pytest.fixture
def admin(client):
    assert client.post("/api/auth/setup", json=SETUP).status_code == 201
    return client


from tests.fakes import smtp, twilio  # noqa: E402,F401
