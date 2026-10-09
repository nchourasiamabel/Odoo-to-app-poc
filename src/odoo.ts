/**
 * Minimal client for Odoo's JSON-2 external API (Odoo 19+/20).
 * POST {url}/json/2/<model>/<method> with a bearer API key and the
 * X-Odoo-Database header; the body is a JSON object of method arguments.
 */
import { config } from "./config.js";

export const TICKET_FIELDS = [
  "name", "ticket_ref", "description", "priority", "stage_id", "team_id",
  "user_id", "partner_id", "partner_email", "tag_ids", "create_date", "write_date",
];

export class OdooError extends Error {}

export const odooConfigured = () => Boolean(config.odooUrl && config.odooApiKey);

export async function call<T = unknown>(
  model: string,
  method: string,
  args: Record<string, unknown>,
): Promise<T> {
  if (!odooConfigured()) {
    throw new OdooError("Odoo is not configured (ODOO_URL / ODOO_API_KEY)");
  }
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `bearer ${config.odooApiKey}`,
  };
  if (config.odooDb) headers["X-Odoo-Database"] = config.odooDb;

  const res = await fetch(`${config.odooUrl.replace(/\/$/, "")}/json/2/${model}/${method}`, {
    method: "POST",
    headers,
    body: JSON.stringify(args),
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) {
    throw new OdooError(`Odoo ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }
  return (await res.json()) as T;
}

export type Ticket = { id: number; [field: string]: unknown };

export function searchTickets(domain: unknown[] = [], limit = 80, offset = 0) {
  return call<Ticket[]>("helpdesk.ticket", "search_read", {
    domain, fields: TICKET_FIELDS, limit, offset, order: "write_date desc",
  });
}

export async function getTicket(id: number): Promise<Ticket | null> {
  const rows = await call<Ticket[]>("helpdesk.ticket", "read", { ids: [id], fields: TICKET_FIELDS });
  return rows[0] ?? null;
}
