import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { expect, test } from "vitest";

process.env.WEBHOOK_TOKEN = "s3";
process.env.CACHE_PATH = join(mkdtempSync(join(tmpdir(), "odoo-")), "cache.json");

const { createApp } = await import("../src/app.js");
const app = createApp();
const URL = "/webhooks/odoo/helpdesk";

test("rejects bad token", async () => {
  await request(app).post(`${URL}?token=x`).send({ _id: 1 }).expect(401);
});

test("updates cache on stage change", async () => {
  await request(app).post(`${URL}?token=s3`).send({ _id: 7, name: "Printer", stage_id: 1 }).expect(200);
  await request(app).post(`${URL}?token=s3`).send({ _id: 7, stage_id: 3 }).expect(200);
  const r = await request(app).get("/cache/tickets/7").expect(200);
  expect(r.body).toMatchObject({ id: 7, name: "Printer", stage_id: 3 });
});

test("missing id", async () => {
  await request(app).post(`${URL}?token=s3`).send({ x: 1 }).expect(400);
});
