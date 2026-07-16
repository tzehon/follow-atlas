import { sql } from "drizzle-orm";
import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestampDefault = sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`;

export const accounts = sqliteTable(
  "accounts",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    username: text("username").notNull(),
    displayName: text("display_name").notNull().default(""),
    bio: text("bio").notNull().default(""),
    profileUrl: text("profile_url").notNull().default(""),
    followedAt: text("followed_at"),
    firstSeenAt: text("first_seen_at").notNull().default(timestampDefault),
    lastSeenAt: text("last_seen_at").notNull().default(timestampDefault),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    isDemo: integer("is_demo", { mode: "boolean" }).notNull().default(false),
  },
  (table) => [
    uniqueIndex("accounts_username_unique").on(table.username),
    index("accounts_active_idx").on(table.isActive),
  ],
);

export const tags = sqliteTable(
  "tags",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    color: text("color").notNull(),
    kind: text("kind", { enum: ["system", "custom"] }).notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at").notNull().default(timestampDefault),
  },
  (table) => [
    uniqueIndex("tags_slug_unique").on(table.slug),
    uniqueIndex("tags_name_unique").on(table.name),
  ],
);

export const accountTags = sqliteTable(
  "account_tags",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    assignedBy: text("assigned_by", { enum: ["auto", "manual"] }).notNull(),
    confidence: real("confidence").notNull().default(1),
    rationale: text("rationale").notNull().default(""),
    isPrimary: integer("is_primary", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(timestampDefault),
  },
  (table) => [
    primaryKey({ columns: [table.accountId, table.tagId] }),
    index("account_tags_tag_idx").on(table.tagId),
  ],
);

export const autoTagExclusions = sqliteTable(
  "auto_tag_exclusions",
  {
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    tagId: integer("tag_id")
      .notNull()
      .references(() => tags.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(timestampDefault),
  },
  (table) => [primaryKey({ columns: [table.accountId, table.tagId] })],
);

export const syncRuns = sqliteTable(
  "sync_runs",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    status: text("status", { enum: ["completed", "failed"] }).notNull(),
    source: text("source", { enum: ["demo", "manual", "daily"] }).notNull(),
    startedAt: text("started_at").notNull().default(timestampDefault),
    finishedAt: text("finished_at"),
    added: integer("added").notNull().default(0),
    removed: integer("removed").notNull().default(0),
    retagged: integer("retagged").notNull().default(0),
    importedCount: integer("imported_count").notNull().default(0),
    message: text("message").notNull().default(""),
  },
  (table) => [index("sync_runs_finished_idx").on(table.finishedAt)],
);

export const importStaging = sqliteTable(
  "import_staging",
  {
    runId: text("run_id").notNull(),
    username: text("username").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull(),
    profileUrl: text("profile_url").notNull(),
    followedAt: text("followed_at"),
    createdAt: text("created_at").notNull().default(timestampDefault),
  },
  (table) => [
    primaryKey({ columns: [table.runId, table.username] }),
    index("import_staging_run_idx").on(table.runId),
  ],
);

export const appMeta = sqliteTable("app_meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});
