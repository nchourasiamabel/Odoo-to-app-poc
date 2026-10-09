/** JSON-file cache of tickets, kept current by the webhook. No native dependencies. */
import { existsSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { config } from "./config.js";
import type { Ticket } from "./odoo.js";

function load(): Record<string, Ticket> {
  return existsSync(config.cachePath) ? JSON.parse(readFileSync(config.cachePath, "utf8")) : {};
}

function save(all: Record<string, Ticket>) {
  const tmp = `${config.cachePath}.tmp`;
  writeFileSync(tmp, JSON.stringify(all, null, 2));
  renameSync(tmp, config.cachePath); // atomic replace
}

/** Merge `fields` into the cached ticket (partial payloads are fine). */
export function upsert(id: number, fields: Record<string, unknown>): Ticket {
  const all = load();
  const data: Ticket = { ...all[id], ...fields, id };
  all[id] = data;
  save(all);
  return data;
}

export function get(id: number): Ticket | null {
  return load()[id] ?? null;
}

export function listAll(): Ticket[] {
  return Object.values(load()).sort((a, b) => b.id - a.id);
}
