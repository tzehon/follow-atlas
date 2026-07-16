import { env } from "cloudflare:workers";

type SqlValue = string | number | null;

interface PreparedStatement {
  bind(...values: SqlValue[]): PreparedStatement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<{ results?: T[] }>;
  run(): Promise<unknown>;
}

interface DatabaseBinding {
  prepare(sql: string): PreparedStatement;
  batch(statements: PreparedStatement[]): Promise<unknown[]>;
}

export type TagKind = "auto" | "custom";
export type AssignmentSource = "auto" | "manual";
type StoredTagKind = "system" | "custom";

export interface AssignedTag {
  id: number;
  name: string;
  color: string;
  kind: TagKind;
  assignedBy: AssignmentSource;
  confidence: number;
  rationale: string;
  isPrimary: boolean;
}

export interface AccountView {
  id: number;
  username: string;
  displayName: string;
  bio: string;
  profileUrl: string;
  followedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  tags: AssignedTag[];
}

export interface TagView {
  id: number;
  name: string;
  color: string;
  kind: TagKind;
  count: number;
}

export interface SyncRunView {
  id: number;
  status: "completed" | "failed";
  source: "demo" | "manual" | "daily";
  startedAt: string;
  finishedAt: string | null;
  added: number;
  removed: number;
  retagged: number;
  importedCount: number;
  message: string;
}

export interface FollowAtlasState {
  accounts: AccountView[];
  tags: TagView[];
  syncRuns: SyncRunView[];
  removedAccounts: AccountView[];
  meta: {
    demoMode: boolean;
    lastSyncedAt: string | null;
  };
}

export interface ImportAccountInput {
  username: string;
  displayName?: string;
  bio?: string;
  profileUrl?: string;
  followedAt?: string;
}

export class StoreError extends Error {
  constructor(
    message: string,
    readonly status = 500,
    readonly code = "store_error",
  ) {
    super(message);
    this.name = "StoreError";
  }
}

type DefaultTag = {
  slug: string;
  name: string;
  color: string;
  keywords: string[];
};

const DEFAULT_TAGS: DefaultTag[] = [
  {
    slug: "design",
    name: "Design",
    color: "violet",
    keywords: ["design", "designer", "branding", "brand studio", "illustration", "typography", "creative director", "ceramics"],
  },
  {
    slug: "technology",
    name: "Technology",
    color: "sky",
    keywords: ["technology", "tech", "software", "developer", "engineering", "product", "startup", "ai", "artificial intelligence", "coding"],
  },
  {
    slug: "photography",
    name: "Photography",
    color: "rose",
    keywords: ["photography", "photographer", "photo", "portrait", "film camera", "street frames", "visual diary"],
  },
  {
    slug: "food-drink",
    name: "Food & Drink",
    color: "coral",
    keywords: ["food", "recipe", "chef", "cooking", "baking", "restaurant", "coffee", "supper", "kitchen"],
  },
  {
    slug: "travel",
    name: "Travel",
    color: "mint",
    keywords: ["travel", "traveler", "traveller", "city guide", "weekend guide", "hotel", "road trip", "places", "destination"],
  },
  {
    slug: "wellness",
    name: "Wellness",
    color: "lime",
    keywords: ["wellness", "fitness", "movement", "yoga", "running", "health", "mindfulness", "strength", "workout", "slow living"],
  },
  {
    slug: "fashion-beauty",
    name: "Fashion & Beauty",
    color: "rose",
    keywords: ["fashion", "style", "stylist", "beauty", "skincare", "wardrobe", "outfit", "makeup", "vintage"],
  },
  {
    slug: "business",
    name: "Business",
    color: "mint",
    keywords: ["business", "founder", "entrepreneur", "marketing", "growth", "leadership", "investing", "venture", "strategy"],
  },
  {
    slug: "culture",
    name: "Culture",
    color: "butter",
    keywords: ["culture", "music", "film", "cinema", "books", "artist", "podcast", "stories", "museum", "archive"],
  },
  {
    slug: "learning",
    name: "Learning",
    color: "sky",
    keywords: ["learning", "education", "educator", "research", "explainer", "science", "history", "tutorial", "curious"],
  },
];

const DEMO_ACCOUNTS: ImportAccountInput[] = [
  {
    username: "pixel.sunday",
    displayName: "Pixel Sunday",
    bio: "Independent brand studio sharing identity systems, typography and bright ideas.",
    followedAt: "2026-05-14T09:18:00.000Z",
  },
  {
    username: "signal.stack",
    displayName: "Signal Stack",
    bio: "Practical AI, thoughtful software and product notes for curious builders.",
    followedAt: "2026-05-19T14:32:00.000Z",
  },
  {
    username: "mira.frames",
    displayName: "Mira Frames",
    bio: "Street photographer. Quiet light, vivid corners and a visual diary from everyday cities.",
    followedAt: "2026-05-24T07:45:00.000Z",
  },
  {
    username: "fieldnotes.travel",
    displayName: "Field Notes Travel",
    bio: "Small hotels, long train rides and useful city guides from around Asia.",
    followedAt: "2026-06-01T12:11:00.000Z",
  },
  {
    username: "little.lemongrass",
    displayName: "Little Lemongrass Kitchen",
    bio: "Weeknight recipes, neighborhood restaurants and generous bowls from a tiny kitchen.",
    followedAt: "2026-06-03T18:04:00.000Z",
  },
  {
    username: "motion.ritual",
    displayName: "Motion Ritual",
    bio: "Friendly strength, mobility and mindful movement for real life.",
    followedAt: "2026-06-08T06:40:00.000Z",
  },
  {
    username: "the.capsule.edit",
    displayName: "The Capsule Edit",
    bio: "Personal style, considered wardrobes and vintage finds worth keeping.",
    followedAt: "2026-06-12T11:26:00.000Z",
  },
  {
    username: "founder.fieldnotes",
    displayName: "Founder Fieldnotes",
    bio: "Honest lessons on startups, leadership, marketing and sustainable growth.",
    followedAt: "2026-06-17T15:53:00.000Z",
  },
  {
    username: "clay.after.rain",
    displayName: "Clay After Rain",
    bio: "A small ceramics studio making useful objects and documenting the design process.",
    followedAt: "2026-06-21T08:16:00.000Z",
  },
  {
    username: "slow.weekend.club",
    displayName: "Slow Weekend Club",
    bio: "Weekend guides, restorative places and slow living rituals close to home.",
    followedAt: "2026-06-25T10:02:00.000Z",
  },
  {
    username: "sound.and.story",
    displayName: "Sound & Story",
    bio: "A culture podcast about independent music, memorable film and the people behind both.",
    followedAt: "2026-06-29T16:37:00.000Z",
  },
  {
    username: "curious.archive",
    displayName: "The Curious Archive",
    bio: "Short explainers on design history, science, books and overlooked ideas.",
    followedAt: "2026-07-02T13:09:00.000Z",
  },
];

const CUSTOM_TAG_COLORS = [
  "violet",
  "lime",
  "coral",
  "sky",
  "butter",
  "rose",
  "mint",
];

const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    bio TEXT NOT NULL DEFAULT '',
    profile_url TEXT NOT NULL DEFAULT '',
    followed_at TEXT,
    first_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_seen_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    is_active INTEGER NOT NULL DEFAULT 1,
    is_demo INTEGER NOT NULL DEFAULT 0
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS accounts_username_unique ON accounts (username)`,
  `CREATE INDEX IF NOT EXISTS accounts_active_idx ON accounts (is_active)`,
  `CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    slug TEXT NOT NULL,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    kind TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tags_slug_unique ON tags (slug)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS tags_name_unique ON tags (name)`,
  `CREATE TABLE IF NOT EXISTS account_tags (
    account_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    assigned_by TEXT NOT NULL,
    confidence REAL NOT NULL DEFAULT 1,
    rationale TEXT NOT NULL DEFAULT '',
    is_primary INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (account_id, tag_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  )`,
  `CREATE INDEX IF NOT EXISTS account_tags_tag_idx ON account_tags (tag_id)`,
  `CREATE TABLE IF NOT EXISTS auto_tag_exclusions (
    account_id INTEGER NOT NULL,
    tag_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (account_id, tag_id),
    FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE,
    FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS sync_runs (
    id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
    status TEXT NOT NULL,
    source TEXT NOT NULL,
    started_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    finished_at TEXT,
    added INTEGER NOT NULL DEFAULT 0,
    removed INTEGER NOT NULL DEFAULT 0,
    retagged INTEGER NOT NULL DEFAULT 0,
    imported_count INTEGER NOT NULL DEFAULT 0,
    message TEXT NOT NULL DEFAULT ''
  )`,
  `CREATE INDEX IF NOT EXISTS sync_runs_finished_idx ON sync_runs (finished_at)`,
  `CREATE TABLE IF NOT EXISTS import_staging (
    run_id TEXT NOT NULL,
    username TEXT NOT NULL,
    display_name TEXT NOT NULL,
    bio TEXT NOT NULL,
    profile_url TEXT NOT NULL,
    followed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (run_id, username)
  )`,
  `CREATE INDEX IF NOT EXISTS import_staging_run_idx ON import_staging (run_id)`,
  `CREATE TABLE IF NOT EXISTS app_meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  )`,
] as const;

function getDatabase(): DatabaseBinding {
  const database = (env as unknown as { DB?: DatabaseBinding }).DB;
  if (!database) {
    throw new StoreError(
      "Follow Atlas storage is not available yet. Configure the DB binding and try again.",
      503,
      "database_unavailable",
    );
  }
  return database;
}

async function all<T>(statement: PreparedStatement): Promise<T[]> {
  const result = await statement.all<T>();
  return result.results ?? [];
}

async function runInChunks(
  database: DatabaseBinding,
  statements: PreparedStatement[],
  chunkSize = 75,
): Promise<void> {
  for (let index = 0; index < statements.length; index += chunkSize) {
    await database.batch(statements.slice(index, index + chunkSize));
  }
}

async function ensureSchema(database: DatabaseBinding): Promise<void> {
  await runInChunks(
    database,
    SCHEMA_STATEMENTS.map((statement) => database.prepare(statement)),
  );
}

async function getMeta(database: DatabaseBinding, key: string): Promise<string | null> {
  const row = await database
    .prepare(`SELECT value FROM app_meta WHERE key = ?`)
    .bind(key)
    .first<{ value: string }>();
  return row?.value ?? null;
}

async function setMeta(database: DatabaseBinding, key: string, value: string): Promise<void> {
  await database
    .prepare(
      `INSERT INTO app_meta (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    )
    .bind(key, value)
    .run();
}

async function seedDefaultsIfNeeded(database: DatabaseBinding): Promise<void> {
  const tagCount = await database
    .prepare(`SELECT COUNT(*) AS count FROM tags`)
    .first<{ count: number }>();

  if (Number(tagCount?.count ?? 0) === 0) {
    const now = new Date().toISOString();
    await database.batch(
      DEFAULT_TAGS.map((tag, index) =>
        database
          .prepare(
            `INSERT OR IGNORE INTO tags (slug, name, color, kind, sort_order, created_at)
             VALUES (?, ?, ?, 'system', ?, ?)`,
          )
          .bind(tag.slug, tag.name, tag.color, index, now),
      ),
    );
  }

  const accountCount = await database
    .prepare(`SELECT COUNT(*) AS count FROM accounts`)
    .first<{ count: number }>();
  const hasRealImport = (await getMeta(database, "has_real_import")) === "1";

  if (Number(accountCount?.count ?? 0) === 0 && !hasRealImport) {
    const now = new Date().toISOString();
    const inserts = DEMO_ACCOUNTS.map((account) => {
      const normalized = normalizeImportedAccount(account, false);
      return database
        .prepare(
          `INSERT OR IGNORE INTO accounts (
             username, display_name, bio, profile_url, followed_at,
             first_seen_at, last_seen_at, is_active, is_demo
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, 1)`,
        )
        .bind(
          normalized.username,
          normalized.displayName,
          normalized.bio,
          normalized.profileUrl,
          normalized.followedAt,
          normalized.followedAt ?? now,
          now,
        );
    });
    await runInChunks(database, inserts);
    await retagAccounts(database, true);
    await database
      .prepare(
        `INSERT INTO sync_runs (
           status, source, started_at, finished_at, added, removed,
           retagged, imported_count, message
         ) VALUES ('completed', 'demo', ?, ?, ?, 0, ?, ?, ?)`,
      )
      .bind(
        now,
        now,
        DEMO_ACCOUNTS.length,
        DEMO_ACCOUNTS.length,
        DEMO_ACCOUNTS.length,
        "Demo library created. Import your following list to replace it.",
      )
      .run();
    await setMeta(database, "demo_mode", "1");
  }
}

async function readyDatabase(): Promise<DatabaseBinding> {
  const database = getDatabase();
  await ensureSchema(database);
  await seedDefaultsIfNeeded(database);
  return database;
}

type AccountRow = {
  id: number;
  username: string;
  display_name: string;
  bio: string;
  profile_url: string;
  followed_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
  is_active: number;
};

type AssignmentRow = {
  account_id: number;
  id: number;
  name: string;
  color: string;
  kind: StoredTagKind;
  assigned_by: AssignmentSource;
  confidence: number;
  rationale: string;
  is_primary: number;
};

function normalizeTimestamp(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)) {
    return `${value.replace(" ", "T")}Z`;
  }
  return value;
}

function publicTagKind(kind: StoredTagKind): TagKind {
  return kind === "system" ? "auto" : "custom";
}

function paletteColor(seed: string): string {
  const normalized = seed.trim().toLowerCase();
  if ((CUSTOM_TAG_COLORS as readonly string[]).includes(normalized)) {
    return normalized;
  }
  let hash = 0;
  for (const character of normalized) {
    hash = (hash * 31 + character.charCodeAt(0)) | 0;
  }
  return CUSTOM_TAG_COLORS[Math.abs(hash) % CUSTOM_TAG_COLORS.length];
}

function accountView(row: AccountRow, assignments: Map<number, AssignedTag[]>): AccountView {
  return {
    id: Number(row.id),
    username: row.username,
    displayName: row.display_name || row.username,
    bio: row.bio,
    profileUrl: row.profile_url,
    followedAt: normalizeTimestamp(row.followed_at),
    firstSeenAt: normalizeTimestamp(row.first_seen_at) ?? row.first_seen_at,
    lastSeenAt: normalizeTimestamp(row.last_seen_at) ?? row.last_seen_at,
    tags: assignments.get(Number(row.id)) ?? [],
  };
}

export async function getState(): Promise<FollowAtlasState> {
  const database = await readyDatabase();
  const [accountRows, assignmentRows, tagRows, syncRows, successfulSyncRows] =
    await Promise.all([
    all<AccountRow>(
      database.prepare(
        `SELECT id, username, display_name, bio, profile_url, followed_at,
                first_seen_at, last_seen_at, is_active
         FROM accounts
         ORDER BY lower(display_name), lower(username)`,
      ),
    ),
    all<AssignmentRow>(
      database.prepare(
        `SELECT at.account_id, t.id, t.name, t.color, t.kind,
                at.assigned_by, at.confidence, at.rationale, at.is_primary
         FROM account_tags at
         INNER JOIN tags t ON t.id = at.tag_id
         ORDER BY at.account_id, at.is_primary DESC,
                  CASE at.assigned_by WHEN 'manual' THEN 0 ELSE 1 END,
                  t.sort_order, lower(t.name)`,
      ),
    ),
    all<{
      id: number;
      name: string;
      color: string;
      kind: StoredTagKind;
      count: number;
      sort_order: number;
    }>(
      database.prepare(
        `SELECT t.id, t.name, t.color, t.kind, t.sort_order,
                COUNT(DISTINCT CASE WHEN a.is_active = 1 THEN at.account_id END) AS count
         FROM tags t
         LEFT JOIN account_tags at ON at.tag_id = t.id
         LEFT JOIN accounts a ON a.id = at.account_id
         GROUP BY t.id, t.name, t.color, t.kind, t.sort_order
         ORDER BY CASE t.kind WHEN 'system' THEN 0 ELSE 1 END,
                  t.sort_order, lower(t.name)`,
      ),
    ),
    all<{
      id: number;
      status: "completed" | "failed";
      source: "demo" | "manual" | "daily";
      started_at: string;
      finished_at: string | null;
      added: number;
      removed: number;
      retagged: number;
      imported_count: number;
      message: string;
    }>(
      database.prepare(
        `SELECT id, status, source, started_at, finished_at, added, removed,
                retagged, imported_count, message
         FROM sync_runs
         ORDER BY COALESCE(finished_at, started_at) DESC, id DESC
         LIMIT 20`,
      ),
    ),
    all<{ finished_at: string }>(
      database.prepare(
        `SELECT finished_at
         FROM sync_runs
         WHERE status = 'completed' AND finished_at IS NOT NULL
         ORDER BY finished_at DESC, id DESC
         LIMIT 1`,
      ),
    ),
  ]);

  const assignments = new Map<number, AssignedTag[]>();
  for (const row of assignmentRows) {
    const accountId = Number(row.account_id);
    const current = assignments.get(accountId) ?? [];
    current.push({
      id: Number(row.id),
      name: row.name,
      color: paletteColor(row.color),
      kind: publicTagKind(row.kind),
      assignedBy: row.assigned_by,
      confidence: Number(row.confidence),
      rationale: row.rationale,
      isPrimary: Boolean(row.is_primary),
    });
    assignments.set(accountId, current);
  }

  const accounts: AccountView[] = [];
  const removedAccounts: AccountView[] = [];
  for (const row of accountRows) {
    const value = accountView(row, assignments);
    if (Boolean(row.is_active)) accounts.push(value);
    else removedAccounts.push(value);
  }

  const syncRuns: SyncRunView[] = syncRows.map((row) => ({
    id: Number(row.id),
    status: row.status,
    source: row.source,
    startedAt: normalizeTimestamp(row.started_at) ?? row.started_at,
    finishedAt: normalizeTimestamp(row.finished_at),
    added: Number(row.added),
    removed: Number(row.removed),
    retagged: Number(row.retagged),
    importedCount: Number(row.imported_count),
    message: row.message,
  }));

  return {
    accounts,
    tags: tagRows.map((row) => ({
      id: Number(row.id),
      name: row.name,
      color: paletteColor(row.color),
      kind: publicTagKind(row.kind),
      count: Number(row.count),
    })),
    syncRuns,
    removedAccounts,
    meta: {
      demoMode: (await getMeta(database, "demo_mode")) === "1",
      lastSyncedAt: normalizeTimestamp(successfulSyncRows[0]?.finished_at ?? null),
    },
  };
}

type NormalizedImportAccount = {
  username: string;
  displayName: string;
  bio: string;
  profileUrl: string;
  followedAt: string | null;
};

function cleanText(value: string | undefined, maxLength: number): string {
  return (value ?? "").trim().slice(0, maxLength);
}

function normalizeImportedAccount(
  account: ImportAccountInput,
  addDefaultProfileUrl = true,
): NormalizedImportAccount {
  const username = account.username.trim().replace(/^@+/, "").toLowerCase();
  const followedAt = account.followedAt
    ? new Date(account.followedAt).toISOString()
    : null;

  return {
    username,
    displayName: cleanText(account.displayName, 100) || username,
    bio: cleanText(account.bio, 500),
    profileUrl:
      cleanText(account.profileUrl, 500) ||
      (addDefaultProfileUrl
        ? `https://www.instagram.com/${encodeURIComponent(username)}/`
        : ""),
    followedAt,
  };
}

export function validateImportAccounts(value: unknown): ImportAccountInput[] {
  if (!Array.isArray(value)) {
    throw new StoreError("accounts must be an array.", 400, "invalid_accounts");
  }
  if (value.length > 7500) {
    throw new StoreError(
      "An import can contain at most 7,500 accounts.",
      400,
      "too_many_accounts",
    );
  }

  const normalized = new Map<string, ImportAccountInput>();
  for (let index = 0; index < value.length; index += 1) {
    const candidate = value[index];
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new StoreError(
        `Account ${index + 1} must be an object.`,
        400,
        "invalid_account",
      );
    }
    const raw = candidate as Record<string, unknown>;
    if (typeof raw.username !== "string") {
      throw new StoreError(
        `Account ${index + 1} is missing a username.`,
        400,
        "invalid_username",
      );
    }
    const username = raw.username.trim().replace(/^@+/, "").toLowerCase();
    if (!/^[a-z0-9._]{1,30}$/.test(username)) {
      throw new StoreError(
        `“${raw.username}” is not a valid Instagram username.`,
        400,
        "invalid_username",
      );
    }

    for (const field of ["displayName", "bio", "profileUrl", "followedAt"] as const) {
      if (raw[field] !== undefined && typeof raw[field] !== "string") {
        throw new StoreError(
          `Account ${index + 1} has an invalid ${field}.`,
          400,
          "invalid_account",
        );
      }
    }

    if (typeof raw.followedAt === "string" && Number.isNaN(Date.parse(raw.followedAt))) {
      throw new StoreError(
        `Account ${index + 1} has an invalid followedAt date.`,
        400,
        "invalid_followed_at",
      );
    }
    if (typeof raw.profileUrl === "string" && raw.profileUrl.trim()) {
      let parsed: URL;
      try {
        parsed = new URL(raw.profileUrl);
      } catch {
        throw new StoreError(
          `Account ${index + 1} has an invalid profileUrl.`,
          400,
          "invalid_profile_url",
        );
      }
      if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
        throw new StoreError(
          `Account ${index + 1} has an invalid profileUrl.`,
          400,
          "invalid_profile_url",
        );
      }
    }

    normalized.set(username, {
      username,
      displayName: raw.displayName as string | undefined,
      bio: raw.bio as string | undefined,
      profileUrl: raw.profileUrl as string | undefined,
      followedAt: raw.followedAt as string | undefined,
    });
  }
  return [...normalized.values()];
}

type AutoTagAccountRow = {
  id: number;
  username: string;
  display_name: string;
  bio: string;
};

function escapedRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function keywordMatches(text: string, keyword: string): boolean {
  return new RegExp(
    `(^|[^a-z0-9])${escapedRegExp(keyword.toLowerCase())}([^a-z0-9]|$)`,
    "i",
  ).test(text);
}

function autoTagsFor(account: AutoTagAccountRow) {
  const haystack = `${account.username} ${account.display_name} ${account.bio}`.toLowerCase();
  return DEFAULT_TAGS.map((tag, ruleIndex) => {
    const matches = tag.keywords.filter((keyword) => keywordMatches(haystack, keyword));
    return {
      tag,
      ruleIndex,
      matches,
      confidence: Math.min(0.97, 0.72 + Math.max(0, matches.length - 1) * 0.07),
    };
  })
    .filter((result) => result.matches.length > 0)
    .sort(
      (left, right) =>
        right.matches.length - left.matches.length || left.ruleIndex - right.ruleIndex,
    )
    .slice(0, 3);
}

async function retagAccounts(database: DatabaseBinding, demo: boolean): Promise<number> {
  const accounts = await all<AutoTagAccountRow>(
    database
      .prepare(
        `SELECT id, username, display_name, bio
         FROM accounts
         WHERE is_active = 1 AND is_demo = ?
         ORDER BY id`,
      )
      .bind(demo ? 1 : 0),
  );
  if (accounts.length === 0) return 0;

  const [tagRows, exclusionRows, manualRows, priorAutoRows] = await Promise.all([
    all<{ id: number; slug: string }>(database.prepare(`SELECT id, slug FROM tags`)),
    all<{ account_id: number; tag_id: number }>(
      database
        .prepare(
          `SELECT e.account_id, e.tag_id
           FROM auto_tag_exclusions e
           INNER JOIN accounts a ON a.id = e.account_id
           WHERE a.is_active = 1 AND a.is_demo = ?`,
        )
        .bind(demo ? 1 : 0),
    ),
    all<{ account_id: number; tag_id: number; is_primary: number }>(
      database
        .prepare(
          `SELECT at.account_id, at.tag_id, at.is_primary
           FROM account_tags at
           INNER JOIN accounts a ON a.id = at.account_id
           WHERE at.assigned_by = 'manual'
             AND a.is_active = 1 AND a.is_demo = ?`,
        )
        .bind(demo ? 1 : 0),
    ),
    all<{ account_id: number; tag_id: number; slug: string }>(
      database
        .prepare(
          `SELECT at.account_id, at.tag_id, t.slug
           FROM account_tags at
           INNER JOIN tags t ON t.id = at.tag_id
           INNER JOIN accounts a ON a.id = at.account_id
           WHERE at.assigned_by = 'auto'
             AND a.is_active = 1 AND a.is_demo = ?`,
        )
        .bind(demo ? 1 : 0),
    ),
  ]);

  const tagIds = new Map(tagRows.map((tag) => [tag.slug, Number(tag.id)]));
  const exclusions = new Set(
    exclusionRows.map((row) => `${Number(row.account_id)}:${Number(row.tag_id)}`),
  );
  const manualAssignments = new Set(
    manualRows.map((row) => `${Number(row.account_id)}:${Number(row.tag_id)}`),
  );
  const manualPrimary = new Set(
    manualRows
      .filter((row) => Boolean(row.is_primary))
      .map((row) => Number(row.account_id)),
  );
  const prior = new Map<number, string[]>();
  for (const row of priorAutoRows) {
    const accountId = Number(row.account_id);
    const current = prior.get(accountId) ?? [];
    current.push(row.slug);
    prior.set(accountId, current);
  }

  let retagged = 0;
  const now = new Date().toISOString();
  const desiredRows: Array<{
    accountId: number;
    tagId: number;
    confidence: number;
    rationale: string;
    isPrimary: number;
    createdAt: string;
  }> = [];
  const desiredKeys = new Set<string>();
  for (const account of accounts) {
    const proposals = autoTagsFor(account)
      .map((proposal) => ({ ...proposal, tagId: tagIds.get(proposal.tag.slug) }))
      .filter(
        (proposal): proposal is typeof proposal & { tagId: number } =>
          proposal.tagId !== undefined &&
          !exclusions.has(`${Number(account.id)}:${proposal.tagId}`) &&
          !manualAssignments.has(`${Number(account.id)}:${proposal.tagId}`),
      );
    const previousSlugs = (prior.get(Number(account.id)) ?? []).sort().join(",");
    const nextSlugs = proposals.map((proposal) => proposal.tag.slug).sort().join(",");
    if (previousSlugs !== nextSlugs) retagged += 1;

    proposals.forEach((proposal, index) => {
      const quotedMatches = proposal.matches
        .slice(0, 3)
        .map((match) => `“${match}”`)
        .join(proposal.matches.length === 2 ? " and " : ", ");
      const accountId = Number(account.id);
      desiredKeys.add(`${accountId}:${proposal.tagId}`);
      desiredRows.push({
        accountId,
        tagId: proposal.tagId,
        confidence: proposal.confidence,
        rationale: `Matched ${quotedMatches} in the username, name or bio.`,
        isPrimary: !manualPrimary.has(accountId) && index === 0 ? 1 : 0,
        createdAt: now,
      });
    });
  }

  const insertStatements: PreparedStatement[] = [];
  for (let index = 0; index < desiredRows.length; index += 500) {
    insertStatements.push(
      database
        .prepare(
          `INSERT INTO account_tags (
             account_id, tag_id, assigned_by, confidence, rationale,
             is_primary, created_at
           )
           SELECT proposed.account_id, proposed.tag_id, 'auto',
                  proposed.confidence, proposed.rationale,
                  proposed.is_primary, proposed.created_at
           FROM (
             SELECT CAST(json_extract(value, '$.accountId') AS INTEGER) AS account_id,
                    CAST(json_extract(value, '$.tagId') AS INTEGER) AS tag_id,
                    CAST(json_extract(value, '$.confidence') AS REAL) AS confidence,
                    CAST(json_extract(value, '$.rationale') AS TEXT) AS rationale,
                    CAST(json_extract(value, '$.isPrimary') AS INTEGER) AS is_primary,
                    CAST(json_extract(value, '$.createdAt') AS TEXT) AS created_at
             FROM json_each(?)
           ) proposed
           WHERE NOT EXISTS (
             SELECT 1 FROM auto_tag_exclusions blocked
             WHERE blocked.account_id = proposed.account_id
               AND blocked.tag_id = proposed.tag_id
           )
             AND NOT EXISTS (
               SELECT 1 FROM account_tags existing
               WHERE existing.account_id = proposed.account_id
                 AND existing.tag_id = proposed.tag_id
                 AND existing.assigned_by = 'manual'
             )
           ON CONFLICT(account_id, tag_id) DO UPDATE SET
             assigned_by = 'auto',
             confidence = excluded.confidence,
             rationale = excluded.rationale,
             is_primary = excluded.is_primary`,
        )
        .bind(JSON.stringify(desiredRows.slice(index, index + 500))),
    );
  }
  await runInChunks(database, insertStatements, 10);

  // Remove obsolete auto-tags only after every desired suggestion is safely in
  // place. If a write fails, old suggestions remain instead of disappearing.
  const staleRows = priorAutoRows
    .filter(
      (row) =>
        !desiredKeys.has(`${Number(row.account_id)}:${Number(row.tag_id)}`),
    )
    .map((row) => ({
      accountId: Number(row.account_id),
      tagId: Number(row.tag_id),
    }));
  const deleteStatements: PreparedStatement[] = [];
  for (let index = 0; index < staleRows.length; index += 1000) {
    deleteStatements.push(
      database
        .prepare(
          `DELETE FROM account_tags
           WHERE assigned_by = 'auto'
             AND EXISTS (
               SELECT 1 FROM json_each(?) stale
               WHERE CAST(json_extract(stale.value, '$.accountId') AS INTEGER) = account_tags.account_id
                 AND CAST(json_extract(stale.value, '$.tagId') AS INTEGER) = account_tags.tag_id
             )`,
        )
        .bind(JSON.stringify(staleRows.slice(index, index + 1000))),
    );
  }
  await runInChunks(database, deleteStatements, 10);
  return retagged;
}

export async function importSnapshot(accounts: ImportAccountInput[]): Promise<{
  ok: true;
  syncRun: SyncRunView;
  added: number;
  removed: number;
  retagged: number;
  importedCount: number;
}> {
  const database = await readyDatabase();
  const startedAt = new Date().toISOString();
  const runId = crypto.randomUUID();
  try {
    const existingRows = await all<{
      username: string;
      is_active: number;
    }>(
      database.prepare(
        `SELECT username, is_active FROM accounts WHERE is_demo = 0`,
      ),
    );
    const existing = new Map(
      existingRows.map((row) => [row.username, Boolean(row.is_active)]),
    );
    const normalized = accounts.map((account) => normalizeImportedAccount(account));
    const incoming = new Set(normalized.map((account) => account.username));
    const added = normalized.filter(
      (account) => !existing.has(account.username) || !existing.get(account.username),
    ).length;
    const removed = existingRows.filter(
      (account) => Boolean(account.is_active) && !incoming.has(account.username),
    ).length;

    const stagingStatements: PreparedStatement[] = [];
    for (let index = 0; index < normalized.length; index += 500) {
      const payload = JSON.stringify(normalized.slice(index, index + 500));
      stagingStatements.push(
        database
          .prepare(
            `INSERT INTO import_staging (
               run_id, username, display_name, bio, profile_url, followed_at, created_at
             )
             SELECT ?,
                    CAST(json_extract(value, '$.username') AS TEXT),
                    CAST(json_extract(value, '$.displayName') AS TEXT),
                    CAST(json_extract(value, '$.bio') AS TEXT),
                    CAST(json_extract(value, '$.profileUrl') AS TEXT),
                    CAST(json_extract(value, '$.followedAt') AS TEXT),
                    ?
             FROM json_each(?)`,
          )
          .bind(runId, startedAt, payload),
      );
    }
    await runInChunks(database, stagingStatements, 10);

    // The staging rows are promoted in one atomic D1 batch. Until all staging
    // chunks succeed, the live account list remains completely untouched.
    await database.batch([
      database
        .prepare(
          `INSERT INTO accounts (
             username, display_name, bio, profile_url, followed_at,
             first_seen_at, last_seen_at, is_active, is_demo
           )
           SELECT username, display_name, bio, profile_url, followed_at,
                  COALESCE(followed_at, ?), ?, 1, 0
           FROM import_staging
           WHERE run_id = ?
           ON CONFLICT(username) DO UPDATE SET
             display_name = excluded.display_name,
             bio = excluded.bio,
             profile_url = excluded.profile_url,
             followed_at = COALESCE(excluded.followed_at, accounts.followed_at),
             last_seen_at = excluded.last_seen_at,
             is_active = 1,
             is_demo = 0`,
        )
        .bind(startedAt, startedAt, runId),
      database
        .prepare(
          `UPDATE accounts
           SET is_active = 0
           WHERE is_demo = 0 AND is_active = 1
             AND NOT EXISTS (
               SELECT 1 FROM import_staging staged
               WHERE staged.run_id = ? AND staged.username = accounts.username
             )`,
        )
        .bind(runId),
      database.prepare(`DELETE FROM accounts WHERE is_demo = 1`),
      database.prepare(`DELETE FROM sync_runs WHERE source = 'demo'`),
      database
        .prepare(
          `INSERT INTO app_meta (key, value) VALUES ('has_real_import', '1')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ),
      database
        .prepare(
          `INSERT INTO app_meta (key, value) VALUES ('demo_mode', '0')
           ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        ),
    ]);
    await database
      .prepare(`DELETE FROM import_staging WHERE run_id = ?`)
      .bind(runId)
      .run();

    const retagged = await retagAccounts(database, false);
    const finishedAt = new Date().toISOString();
    const message = `Imported ${normalized.length} account${normalized.length === 1 ? "" : "s"}; ${added} added or returned and ${removed} removed.`;
    await database
      .prepare(
        `INSERT INTO sync_runs (
           status, source, started_at, finished_at, added, removed,
           retagged, imported_count, message
         ) VALUES ('completed', 'manual', ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        startedAt,
        finishedAt,
        added,
        removed,
        retagged,
        normalized.length,
        message,
      )
      .run();

    const row = await database
      .prepare(
        `SELECT id, status, source, started_at, finished_at, added, removed,
                retagged, imported_count, message
         FROM sync_runs
         WHERE source = 'manual' AND started_at = ?
         ORDER BY id DESC
         LIMIT 1`,
      )
      .bind(startedAt)
      .first<{
        id: number;
        status: "completed";
        source: "manual";
        started_at: string;
        finished_at: string;
        added: number;
        removed: number;
        retagged: number;
        imported_count: number;
        message: string;
      }>();

    const syncRun: SyncRunView = row
      ? {
          id: Number(row.id),
          status: row.status,
          source: row.source,
          startedAt: row.started_at,
          finishedAt: row.finished_at,
          added: Number(row.added),
          removed: Number(row.removed),
          retagged: Number(row.retagged),
          importedCount: Number(row.imported_count),
          message: row.message,
        }
      : {
          id: 0,
          status: "completed",
          source: "manual",
          startedAt,
          finishedAt,
          added,
          removed,
          retagged,
          importedCount: normalized.length,
          message,
        };
    return {
      ok: true,
      syncRun,
      added: syncRun.added,
      removed: syncRun.removed,
      retagged: syncRun.retagged,
      importedCount: syncRun.importedCount,
    };
  } catch (error) {
    const finishedAt = new Date().toISOString();
    try {
      await database
        .prepare(`DELETE FROM import_staging WHERE run_id = ?`)
        .bind(runId)
        .run();
      await database
        .prepare(
          `INSERT INTO sync_runs (
             status, source, started_at, finished_at, message
           ) VALUES ('failed', 'manual', ?, ?, ?)`,
        )
        .bind(
          startedAt,
          finishedAt,
          error instanceof Error ? error.message.slice(0, 300) : "Import failed.",
        )
        .run();
    } catch {
      // Preserve the original import error when failure logging also fails.
    }
    throw error;
  }
}

function normalizeTagName(name: unknown): string {
  if (typeof name !== "string") {
    throw new StoreError("name is required.", 400, "invalid_tag_name");
  }
  const normalized = name.trim().replace(/\s+/g, " ");
  if (!normalized || normalized.length > 32) {
    throw new StoreError(
      "Tag names must be between 1 and 32 characters.",
      400,
      "invalid_tag_name",
    );
  }
  return normalized;
}

function normalizeColor(color: unknown, seed: string): string {
  if (color === undefined) return paletteColor(seed);
  if (typeof color !== "string") {
    throw new StoreError(
      `color must be one of: ${CUSTOM_TAG_COLORS.join(", ")}.`,
      400,
      "invalid_tag_color",
    );
  }
  const normalized = color.trim().toLowerCase();
  if (
    !(CUSTOM_TAG_COLORS as readonly string[]).includes(normalized) &&
    !/^#[0-9a-f]{6}$/i.test(normalized)
  ) {
    throw new StoreError(
      `color must be one of: ${CUSTOM_TAG_COLORS.join(", ")}.`,
      400,
      "invalid_tag_color",
    );
  }
  return paletteColor(normalized);
}

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "tag"
  );
}

async function assertUniqueTagName(
  database: DatabaseBinding,
  name: string,
  exceptId?: number,
): Promise<void> {
  const row = await database
    .prepare(
      exceptId === undefined
        ? `SELECT id FROM tags WHERE lower(name) = lower(?) LIMIT 1`
        : `SELECT id FROM tags WHERE lower(name) = lower(?) AND id <> ? LIMIT 1`,
    )
    .bind(...(exceptId === undefined ? [name] : [name, exceptId]))
    .first<{ id: number }>();
  if (row) {
    throw new StoreError("A tag with that name already exists.", 409, "tag_exists");
  }
}

async function uniqueSlug(database: DatabaseBinding, name: string): Promise<string> {
  const base = slugify(name);
  let candidate = base;
  let suffix = 2;
  while (
    await database
      .prepare(`SELECT id FROM tags WHERE slug = ? LIMIT 1`)
      .bind(candidate)
      .first<{ id: number }>()
  ) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function createCustomTag(input: {
  name: unknown;
  color?: unknown;
}): Promise<{ ok: true; tag: TagView }> {
  const database = await readyDatabase();
  const name = normalizeTagName(input.name);
  await assertUniqueTagName(database, name);
  const color = normalizeColor(input.color, name);
  const slug = await uniqueSlug(database, name);
  const orderRow = await database
    .prepare(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS next_order FROM tags`)
    .first<{ next_order: number }>();
  const createdAt = new Date().toISOString();
  await database
    .prepare(
      `INSERT INTO tags (slug, name, color, kind, sort_order, created_at)
       VALUES (?, ?, ?, 'custom', ?, ?)`,
    )
    .bind(slug, name, color, Number(orderRow?.next_order ?? 0), createdAt)
    .run();
  const row = await database
    .prepare(`SELECT id, name, color, kind FROM tags WHERE slug = ?`)
    .bind(slug)
    .first<{ id: number; name: string; color: string; kind: StoredTagKind }>();
  if (!row) throw new StoreError("The tag could not be created.");
  return {
    ok: true,
    tag: {
      id: Number(row.id),
      name: row.name,
      color: paletteColor(row.color),
      kind: "custom",
      count: 0,
    },
  };
}

async function customTag(database: DatabaseBinding, id: number) {
  const row = await database
    .prepare(`SELECT id, name, color, kind FROM tags WHERE id = ?`)
    .bind(id)
    .first<{ id: number; name: string; color: string; kind: StoredTagKind }>();
  if (!row) throw new StoreError("Tag not found.", 404, "tag_not_found");
  if (row.kind !== "custom") {
    throw new StoreError(
      "Built-in auto-tags cannot be edited or deleted.",
      400,
      "system_tag_read_only",
    );
  }
  return row;
}

export async function updateCustomTag(input: {
  id: number;
  name?: unknown;
  color?: unknown;
}): Promise<{ ok: true; tag: TagView }> {
  const database = await readyDatabase();
  const current = await customTag(database, input.id);
  if (input.name === undefined && input.color === undefined) {
    throw new StoreError("Provide a name or color to update.", 400, "empty_update");
  }
  const name = input.name === undefined ? current.name : normalizeTagName(input.name);
  if (name !== current.name) await assertUniqueTagName(database, name, input.id);
  const color =
    input.color === undefined ? paletteColor(current.color) : normalizeColor(input.color, name);
  await database
    .prepare(`UPDATE tags SET name = ?, color = ? WHERE id = ?`)
    .bind(name, color, input.id)
    .run();
  const countRow = await database
    .prepare(
      `SELECT COUNT(DISTINCT at.account_id) AS count
       FROM account_tags at
       INNER JOIN accounts a ON a.id = at.account_id
       WHERE at.tag_id = ? AND a.is_active = 1`,
    )
    .bind(input.id)
    .first<{ count: number }>();
  return {
    ok: true,
    tag: {
      id: input.id,
      name,
      color,
      kind: "custom",
      count: Number(countRow?.count ?? 0),
    },
  };
}

export async function deleteCustomTag(id: number): Promise<{ ok: true; deletedId: number }> {
  const database = await readyDatabase();
  await customTag(database, id);
  await database.prepare(`DELETE FROM tags WHERE id = ?`).bind(id).run();
  return { ok: true, deletedId: id };
}

async function assertAccountAndTag(
  database: DatabaseBinding,
  accountId: number,
  tagId: number,
): Promise<void> {
  const [account, tag] = await Promise.all([
    database
      .prepare(`SELECT id FROM accounts WHERE id = ? LIMIT 1`)
      .bind(accountId)
      .first<{ id: number }>(),
    database
      .prepare(`SELECT id FROM tags WHERE id = ? LIMIT 1`)
      .bind(tagId)
      .first<{ id: number }>(),
  ]);
  if (!account) throw new StoreError("Account not found.", 404, "account_not_found");
  if (!tag) throw new StoreError("Tag not found.", 404, "tag_not_found");
}

export async function assignTag(input: {
  accountId: number;
  tagId: number;
  isPrimary?: boolean;
}): Promise<{ ok: true; accountId: number; tagId: number }> {
  const database = await readyDatabase();
  await assertAccountAndTag(database, input.accountId, input.tagId);
  const now = new Date().toISOString();
  const statements: PreparedStatement[] = [
    database
      .prepare(`DELETE FROM auto_tag_exclusions WHERE account_id = ? AND tag_id = ?`)
      .bind(input.accountId, input.tagId),
  ];
  if (input.isPrimary) {
    statements.push(
      database
        .prepare(`UPDATE account_tags SET is_primary = 0 WHERE account_id = ?`)
        .bind(input.accountId),
    );
  }
  statements.push(
    database
      .prepare(
        `INSERT INTO account_tags (
           account_id, tag_id, assigned_by, confidence, rationale,
           is_primary, created_at
         ) VALUES (?, ?, 'manual', 1, 'Added by you.', ?, ?)
         ON CONFLICT(account_id, tag_id) DO UPDATE SET
           assigned_by = 'manual',
           confidence = 1,
           rationale = 'Added by you.',
           is_primary = excluded.is_primary`,
      )
      .bind(input.accountId, input.tagId, input.isPrimary ? 1 : 0, now),
  );
  await database.batch(statements);
  return { ok: true, accountId: input.accountId, tagId: input.tagId };
}

export async function unassignTag(input: {
  accountId: number;
  tagId: number;
}): Promise<{ ok: true; accountId: number; tagId: number }> {
  const database = await readyDatabase();
  await assertAccountAndTag(database, input.accountId, input.tagId);
  await database.batch([
    database
      .prepare(`DELETE FROM account_tags WHERE account_id = ? AND tag_id = ?`)
      .bind(input.accountId, input.tagId),
    database
      .prepare(
        `INSERT OR IGNORE INTO auto_tag_exclusions (account_id, tag_id, created_at)
         VALUES (?, ?, ?)`,
      )
      .bind(input.accountId, input.tagId, new Date().toISOString()),
  ]);
  return { ok: true, accountId: input.accountId, tagId: input.tagId };
}

export function positiveInteger(value: unknown, field: string): number {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new StoreError(`${field} must be a positive integer.`, 400, `invalid_${field}`);
  }
  return parsed;
}

export function errorResponse(error: unknown): Response {
  if (error instanceof StoreError) {
    return Response.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }
  console.error("Follow Atlas API error", error);
  return Response.json(
    { error: "Something went wrong. Please try again.", code: "internal_error" },
    { status: 500 },
  );
}
