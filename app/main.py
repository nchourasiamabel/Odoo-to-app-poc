import hmac
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query, Request

from . import odoo, store
from .config import settings

app = FastAPI(title="Odoo Helpdesk POC")


def _odoo_errors(fn):
    async def wrapper(*a, **kw):
        try:
            return await fn(*a, **kw)
        except odoo.OdooError as e:
            raise HTTPException(502, str(e))
    wrapper.__name__ = fn.__name__
    return wrapper


@app.get("/tickets")
@_odoo_errors
async def list_tickets(
    stage_id: Optional[int] = None,
    team_id: Optional[int] = None,
    partner_id: Optional[int] = None,
    limit: int = Query(80, le=500),
    offset: int = 0,
):
    """Fetch tickets live from Odoo Helpdesk."""
    domain = [(k, "=", v) for k, v in
              (("stage_id", stage_id), ("team_id", team_id), ("partner_id", partner_id)) if v is not None]
    return await odoo.search_tickets(domain, limit, offset)


@app.get("/tickets/{ticket_id}")
@_odoo_errors
async def get_ticket(ticket_id: int):
    t = await odoo.get_ticket(ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not found")
    return t


@app.post("/tickets/sync")
@_odoo_errors
async def sync_tickets():
    """Pull all tickets from Odoo into the local cache."""
    n, offset = 0, 0
    while True:
        rows = await odoo.search_tickets(limit=200, offset=offset)
        for r in rows:
            store.upsert(r["id"], r)
        n += len(rows)
        if len(rows) < 200:
            return {"synced": n}
        offset += 200


@app.get("/cache/tickets")
def cached_tickets():
    return store.list_all()


@app.get("/cache/tickets/{ticket_id}")
def cached_ticket(ticket_id: int):
    t = store.get(ticket_id)
    if not t:
        raise HTTPException(404, "Ticket not in cache")
    return t


def _check_token(token: str = Query("")):
    if not settings.webhook_token or not hmac.compare_digest(token, settings.webhook_token):
        raise HTTPException(401, "Invalid webhook token")


@app.post("/webhooks/odoo/helpdesk", dependencies=[Depends(_check_token)])
async def helpdesk_webhook(request: Request):
    """Target of an Odoo automation rule "Send Webhook Notification" on helpdesk.ticket.

    Odoo posts {"_model", "_id", "_name", <selected fields>...}. We update the
    cache from the payload and, if Odoo is configured, refresh the full record
    (the payload only holds the fields chosen in the rule; many2one values may
    arrive as plain ids/names).
    """
    payload = await request.json()
    ticket_id = payload.get("_id") or payload.get("id")
    if not isinstance(ticket_id, int):
        raise HTTPException(400, "Missing ticket id (_id)")
    fields = {k: v for k, v in payload.items() if not k.startswith("_")}
    data = store.upsert(ticket_id, fields)
    if settings.odoo_url and settings.odoo_api_key:
        try:
            full = await odoo.get_ticket(ticket_id)
            if full:
                data = store.upsert(ticket_id, full)
        except odoo.OdooError:
            pass  # keep payload data; a later /tickets/sync reconciles
    return {"status": "ok", "ticket": data}
