import { timingSafeEqual } from "node:crypto";
import express, { type NextFunction, type Request, type Response } from "express";
import { config } from "./config.js";
import * as odoo from "./odoo.js";
import * as store from "./store.js";

type Handler = (req: Request, res: Response) => Promise<unknown> | unknown;

/** Wrap async handlers: Odoo failures become 502, everything else 500. */
const wrap = (fn: Handler) => (req: Request, res: Response, next: NextFunction) =>
  Promise.resolve(fn(req, res)).catch((e) =>
    e instanceof odoo.OdooError ? res.status(502).json({ error: e.message }) : next(e),
  );

const intParam = (v: unknown) => {
  const n = Number(v);
  return v !== undefined && v !== "" && Number.isInteger(n) ? n : undefined;
};

function tokenOk(given: unknown): boolean {
  if (!config.webhookToken || typeof given !== "string") return false;
  const a = Buffer.from(given);
  const b = Buffer.from(config.webhookToken);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: "1mb" }));

  // Live fetch from Odoo Helpdesk
  app.get("/tickets", wrap(async (req, res) => {
    const domain = (["stage_id", "team_id", "partner_id"] as const)
      .map((k) => [k, intParam(req.query[k])] as const)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, "=", v]);
    const limit = Math.min(intParam(req.query.limit) ?? 80, 500);
    const offset = intParam(req.query.offset) ?? 0;
    res.json(await odoo.searchTickets(domain, limit, offset));
  }));

  app.get("/tickets/:id", wrap(async (req, res) => {
    const id = intParam(req.params.id);
    const t = id === undefined ? null : await odoo.getTicket(id);
    if (!t) return res.status(404).json({ error: "Ticket not found" });
    res.json(t);
  }));

  // Pull all tickets from Odoo into the local cache
  app.post("/tickets/sync", wrap(async (_req, res) => {
    let synced = 0;
    for (let offset = 0; ; offset += 200) {
      const rows = await odoo.searchTickets([], 200, offset);
      rows.forEach((r) => store.upsert(r.id, r));
      synced += rows.length;
      if (rows.length < 200) break;
    }
    res.json({ synced });
  }));

  app.get("/cache/tickets", (_req, res) => res.json(store.listAll()));
  app.get("/cache/tickets/:id", (req, res) => {
    const id = intParam(req.params.id);
    const t = id === undefined ? null : store.get(id);
    if (!t) return res.status(404).json({ error: "Ticket not in cache" });
    res.json(t);
  });

  /**
   * Target of an Odoo automation rule "Send Webhook Notification" on helpdesk.ticket.
   * Odoo posts {_model, _id, _name, <selected fields>}. We merge the payload into the
   * cache and, if Odoo is configured, refresh the full record (the payload only holds
   * the fields chosen in the rule).
   */
  app.post("/webhooks/odoo/helpdesk", wrap(async (req, res) => {
    if (!tokenOk(req.query.token)) return res.status(401).json({ error: "Invalid webhook token" });
    const payload = (req.body ?? {}) as Record<string, unknown>;
    const id = payload._id ?? payload.id;
    if (typeof id !== "number" || !Number.isInteger(id)) {
      return res.status(400).json({ error: "Missing ticket id (_id)" });
    }
    const fields = Object.fromEntries(Object.entries(payload).filter(([k]) => !k.startsWith("_")));
    let data = store.upsert(id, fields);
    if (odoo.odooConfigured()) {
      try {
        const full = await odoo.getTicket(id);
        if (full) data = store.upsert(id, full);
      } catch (e) {
        if (!(e instanceof odoo.OdooError)) throw e; // keep payload data; /tickets/sync reconciles
      }
    }
    res.json({ status: "ok", ticket: data });
  }));

  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error(err);
    res.status(500).json({ error: "Internal error" });
  });

  return app;
}
