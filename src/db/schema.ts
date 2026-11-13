import { bigint, boolean, customType, index, integer, jsonb, pgTable, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { SiteContent } from "@/lib/site-data";
const bytea = customType<{ data: Buffer; driverData: Buffer }>({ dataType() { return "bytea"; } });
export const siteSettings = pgTable("site_settings", {
  id: text("id").primaryKey().default("main"),
  content: jsonb("content").$type<SiteContent>().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const owners = pgTable("site_owners", {
  id: text("id").primaryKey().default("main"), passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const sessions = pgTable("owner_sessions", {
  tokenHash: text("token_hash").primaryKey(), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});
export const media = pgTable("media", {
  id: uuid("id").defaultRandom().primaryKey(), filename: text("filename").notNull(), mime: text("mime").notNull(),
  data: bytea("data").notNull(),
  size: bigint("size", { mode: "number" }).notNull().default(0),
  chunked: boolean("chunked").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
export const mediaUploads = pgTable("media_uploads", {
  id: uuid("id").defaultRandom().primaryKey(), filename: text("filename").notNull(),
  totalSize: bigint("total_size", { mode: "number" }).notNull(),
  chunkSize: integer("chunk_size").notNull(),
  mime: text("mime"), status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
}, table => [index("media_upload_expiry_idx").on(table.status, table.expiresAt)]);
export const mediaParts = pgTable("media_parts", {
  uploadId: uuid("upload_id").notNull().references(() => mediaUploads.id, { onDelete: "cascade" }),
  part: integer("part").notNull(), size: integer("size").notNull(), data: bytea("data").notNull(),
}, table => [primaryKey({ columns: [table.uploadId, table.part] })]);
export const inquiries = pgTable("inquiries", {
  id: uuid("id").defaultRandom().primaryKey(), name: text("name").notNull(), email: text("email").notNull(),
  phone: text("phone").notNull().default(""), interest: text("interest").notNull(), message: text("message").notNull(),
  isRead: boolean("is_read").notNull().default(false), createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
