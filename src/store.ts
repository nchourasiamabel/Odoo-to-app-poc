/** SQLite cache of tickets, kept current by the webhook. */
import Database from "better-sqlite3";
import { config } from "./config.js";
import type { Ticket } from "./odoo.js";

let db: Database.Database | undefined;

function conn() {
  if (!db) {
    db = new Database(config.dbPath);
    db.exec(
      "CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY, data TEXT NOT NULL, updated_at TEXT NOT NULL)",
    );
  }
  return db;
}

/** Merge `fields` into the cached ticket (partial payloads are fine). */
export function upsert(id: number, fields: Record<string, unknown>): Ticket {
  const c = conn();
  const row = c.prepare("SELECT data FROM tickets WHERE id=?").get(id) as { data: string } | undefined;
  const data: Ticket = { ...(row ? JSON.parse(row.data) : {}), ...fields, id };
  c.prepare(
    "INSERT INTO tickets(id,data,updated_at) VALUES(?,?,?) " +
      "ON CONFLICT(id) DO UPDATE SET data=excluded.data, updated_at=excluded.updated_at",
  ).run(id, JSON.stringify(data), new Date().toISOString());
  return data;
}

export function get(id: number): Ticket | null {
  const row = conn().prepare("SELECT data FROM tickets WHERE id=?").get(id) as { data: string } | undefined;
  return row ? JSON.parse(row.data) : null;
}

export function listAll(): Ticket[] {
  const rows = conn().prepare("SELECT data FROM tickets ORDER BY id DESC").all() as { data: string }[];
  return rows.map((r) => JSON.parse(r.data));
}
