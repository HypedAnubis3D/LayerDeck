import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const shopifyConnectionsTable = pgTable("shopify_connections", {
  id: serial("id").primaryKey(),
  shopDomain: text("shop_domain").notNull().unique(),
  accessToken: text("access_token").notNull(),
  scopes: text("scopes"),
  installedAt: timestamp("installed_at").defaultNow(),
  webhookSecret: text("webhook_secret"),
});

export const insertShopifyConnectionSchema = createInsertSchema(
  shopifyConnectionsTable,
).omit({ id: true, installedAt: true });

export type InsertShopifyConnection = z.infer<
  typeof insertShopifyConnectionSchema
>;
export type ShopifyConnection = typeof shopifyConnectionsTable.$inferSelect;

/** Stores the Shopify Dev Dashboard OAuth app credentials (Client ID + Secret).
 *  Only ever has one row (upserted by id=1). */
export const shopifyAppConfigTable = pgTable("shopify_app_config", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
