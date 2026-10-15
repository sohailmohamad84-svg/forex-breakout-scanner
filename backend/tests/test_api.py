import pytest
from fastapi.testclient import TestClient
from app.main import app, seed_initial_data
from app.database import Base, engine


@pytest.fixture(scope="module", autouse=True)
def setup_test_db():
    seed_initial_data()
    yield


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def test_health_endpoint(client):
    resp = client.get("/api/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] in ["online", "degraded"]
    assert data["database_connected"] is True


def test_pairs_list_and_toggle(client):
    resp = client.get("/api/pairs")
    assert resp.status_code == 200
    pairs = resp.json()
    assert len(pairs) > 0
    first_sym = pairs[0]["symbol"]

    # Toggle pair
    resp_toggle = client.post("/api/pairs/toggle", json={"symbol": first_sym, "is_active": False})
    assert resp_toggle.status_code == 200
    assert resp_toggle.json()["is_active"] is False

    # Toggle back
    resp_toggle_back = client.post("/api/pairs/toggle", json={"symbol": first_sym, "is_active": True})
    assert resp_toggle_back.status_code == 200
    assert resp_toggle_back.json()["is_active"] is True


def test_scanner_status_endpoint(client):
    resp = client.get("/api/scanner/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "data_provider" in data
    assert "active_threshold" in data


def test_settings_get_and_put(client):
    resp = client.get("/api/settings")
    assert resp.status_code == 200
    settings_data = resp.json()
    assert "probability_threshold" in settings_data

    # Update threshold to 72.5
    settings_data["probability_threshold"] = 72.5
    resp_put = client.put("/api/settings", json=settings_data)
    assert resp_put.status_code == 200
    assert resp_put.json()["probability_threshold"] == 72.5

    # Verify updated value persists
    resp_get2 = client.get("/api/settings")
    assert resp_get2.json()["probability_threshold"] == 72.5


def test_market_candles_endpoint(client):
    resp = client.get("/api/market/candles/EUR/USD?timeframe=1h&count=30")
    assert resp.status_code in [200, 500]  # Depends on internet / yfinance
    if resp.status_code == 200:
        data = resp.json()
        assert data["pair"] == "EUR/USD"
        assert len(data["candles"]) > 0
        assert "indicator" in data
