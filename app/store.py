"""SQLite cache of tickets, updated by the webhook."""
import json
import sqlite3
from datetime import datetime, timezone

from .config import settings


def _conn():
    c = sqlite3.connect(settings.db_path)
    c.row_factory = sqlite3.Row
    c.execute(
        "CREATE TABLE IF NOT EXISTS tickets ("
        "id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)"
    )
    return c


def upsert(ticket_id: int, fields: dict) -> dict:
    """Merge `fields` into the cached ticket (partial payloads are fine)."""
    with _conn() as c:
        row = c.execute("SELECT data FROM tickets WHERE id=?", (ticket_id,)).fetchone()
        data = json.loads(row["data"]) if row else {}
        data.update(fields)
        data["id"] = ticket_id
        c.execute(
            "INSERT INTO tickets(id,data,updated_at) VALUES(?,?,?) "
            "ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
            (ticket_id, json.dumps(data), datetime.now(timezone.utc).isoformat()),
        )
    return data


def get(ticket_id: int):
    with _conn() as c:
        row = c.execute("SELECT data FROM tickets WHERE id=?", (ticket_id,)).fetchone()
    return json.loads(row["data"]) if row else None


def list_all():
    with _conn() as c:
        return [json.loads(r["data"]) for r in c.execute("SELECT data FROM tickets ORDER BY id DESC")]
