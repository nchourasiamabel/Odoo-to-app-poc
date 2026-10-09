"""Minimal client for Odoo's JSON-2 external API (Odoo 19+/20).

POST {url}/json/2/<model>/<method> with a bearer API key and the
X-Odoo-Database header; the body is a JSON object of method arguments.
"""
import httpx

from .config import settings

TICKET_FIELDS = [
    "name", "ticket_ref", "description", "priority", "stage_id", "team_id",
    "user_id", "partner_id", "partner_email", "tag_ids", "create_date", "write_date",
]


class OdooError(Exception):
    pass


async def call(model: str, method: str, **kwargs):
    if not (settings.odoo_url and settings.odoo_api_key):
        raise OdooError("Odoo is not configured (ODOO_URL / ODOO_API_KEY)")
    headers = {"Authorization": f"bearer {settings.odoo_api_key}"}
    if settings.odoo_db:
        headers["X-Odoo-Database"] = settings.odoo_db
    async with httpx.AsyncClient(timeout=30) as client:
        r = await client.post(
            f"{settings.odoo_url.rstrip('/')}/json/2/{model}/{method}",
            json=kwargs, headers=headers,
        )
    if r.status_code != 200:
        raise OdooError(f"Odoo {r.status_code}: {r.text[:300]}")
    return r.json()


async def search_tickets(domain=None, limit=80, offset=0):
    return await call(
        "helpdesk.ticket", "search_read",
        domain=domain or [], fields=TICKET_FIELDS,
        limit=limit, offset=offset, order="write_date desc",
    )


async def get_ticket(ticket_id: int):
    rows = await call("helpdesk.ticket", "read", ids=[ticket_id], fields=TICKET_FIELDS)
    return rows[0] if rows else None
