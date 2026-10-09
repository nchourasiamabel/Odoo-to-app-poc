import "dotenv/config";

export const config = {
  odooUrl: process.env.ODOO_URL ?? "",
  odooDb: process.env.ODOO_DB ?? "",
  odooApiKey: process.env.ODOO_API_KEY ?? "",
  webhookToken: process.env.WEBHOOK_TOKEN ?? "",
  dbPath: process.env.DB_PATH ?? "helpdesk.db",
  port: Number(process.env.PORT ?? 3000),
};
