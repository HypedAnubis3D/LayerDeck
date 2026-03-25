import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

export const etsyConnectionsTable = pgTable("etsy_connections", {
  id: serial("id").primaryKey(),
  shopName: text("shop_name").notNull(),
  shopId: text("shop_id").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  tokenExpiry: timestamp("token_expiry"),
  installedAt: timestamp("installed_at").defaultNow(),
});

/** Stores the Etsy OAuth app Client ID (no secret — PKCE flow). */
export const etsyAppConfigTable = pgTable("etsy_app_config", {
  id: serial("id").primaryKey(),
  clientId: text("client_id").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});
