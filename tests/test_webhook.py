import os, tempfile
os.environ["WEBHOOK_TOKEN"] = "s3"
os.environ["DB_PATH"] = os.path.join(tempfile.mkdtemp(), "t.db")

from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
URL = "/webhooks/odoo/helpdesk"


def test_rejects_bad_token():
    assert c.post(URL + "?token=x", json={"_id": 1}).status_code == 401


def test_updates_cache_on_stage_change():
    c.post(URL + "?token=s3", json={"_id": 7, "name": "Printer", "stage_id": 1})
    r = c.post(URL + "?token=s3", json={"_id": 7, "stage_id": 3})
    assert r.status_code == 200
    t = c.get("/cache/tickets/7").json()
    assert t["stage_id"] == 3 and t["name"] == "Printer"


def test_missing_id():
    assert c.post(URL + "?token=s3", json={"x": 1}).status_code == 400
