# Odoo Helpdesk POC

Node.js + TypeScript (Express) service that reads Helpdesk tickets from Odoo (JSON-2 external API,
`/json/2/helpdesk.ticket/search_read`) and exposes a webhook that keeps a local
SQLite cache current when a ticket changes.

## Run
```
npm install
cp .env.example .env   # fill in values (API key: Odoo > Preferences > Account Security)
npm run dev            # or: npm run build && npm start
```

## Endpoints
| Method | Path | Purpose |
|---|---|---|
| GET | `/tickets?stage_id=&team_id=&partner_id=&limit=&offset=` | Live fetch from Odoo |
| GET | `/tickets/{id}` | Live single ticket |
| POST | `/tickets/sync` | Pull all tickets into the cache |
| GET | `/cache/tickets`, `/cache/tickets/{id}` | Read cached tickets |
| POST | `/webhooks/odoo/helpdesk?token=…` | Odoo webhook receiver |

## Odoo webhook setup (needs Helpdesk + Automation Rules, developer mode)
1. Settings > Technical > Automation Rules > New, model **Ticket** (`helpdesk.ticket`).
2. Trigger: **Stage is set to** / **On save** (watch field `stage_id`) — or "On creation and update".
3. Action: **Send Webhook Notification**, URL
   `https://<your-host>/webhooks/odoo/helpdesk?token=<WEBHOOK_TOKEN>`, and pick the
   fields to send (e.g. name, stage_id, priority, user_id, partner_id).
4. Odoo must be able to reach the URL (use a tunnel such as ngrok for local dev).

Notes: Odoo's webhook action cannot add custom headers, so the shared secret is
passed as a query token (use HTTPS). The receiver also re-reads the full ticket
from Odoo so the cache is complete.

## Tests
`npm test`
