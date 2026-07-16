"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type ViewKey = "accounts" | "tags" | "changes" | "settings";
type ViewMode = "list" | "grid";
type GroupMode = "none" | "primary" | "type";
type SortMode = "recent" | "name" | "newest" | "tags";

type AccountTag = {
  id: number;
  name: string;
  color: string;
  kind: "auto" | "custom";
  assignedBy?: "auto" | "manual";
  confidence?: number | null;
  rationale?: string | null;
  isPrimary?: boolean;
};

type Account = {
  id: number;
  username: string;
  displayName: string;
  bio: string;
  profileUrl: string;
  firstSeenAt: string;
  lastSeenAt: string;
  tags: AccountTag[];
};

type Tag = {
  id: number;
  name: string;
  color: string;
  kind: "auto" | "custom";
  count: number;
};

type SyncRun = {
  id: number;
  status: string;
  source: string;
  startedAt: string;
  finishedAt?: string | null;
  added: number;
  removed: number;
  retagged: number;
  importedCount: number;
  message?: string | null;
};

type AtlasState = {
  accounts: Account[];
  tags: Tag[];
  syncRuns: SyncRun[];
  removedAccounts: Account[];
  meta: {
    demoMode: boolean;
    lastSyncedAt?: string | null;
  };
};

type ImportedAccount = {
  username: string;
  displayName?: string;
  bio?: string;
  profileUrl?: string;
  followedAt?: string;
};

const TAG_COLORS = [
  "violet",
  "lime",
  "coral",
  "sky",
  "butter",
  "rose",
  "mint",
] as const;

const COLOR_HEX: Record<(typeof TAG_COLORS)[number], string> = {
  violet: "#7C3AED",
  lime: "#65A30D",
  coral: "#DC2626",
  sky: "#2563EB",
  butter: "#D97706",
  rose: "#DB2777",
  mint: "#0F766E",
};

const HEX_TONES: Record<string, (typeof TAG_COLORS)[number]> = {
  "#7667E8": "violet",
  "#7C3AED": "violet",
  "#A855F7": "violet",
  "#3B82F6": "sky",
  "#2563EB": "sky",
  "#06B6D4": "sky",
  "#0891B2": "sky",
  "#F97316": "coral",
  "#DC2626": "coral",
  "#14B8A6": "mint",
  "#22C55E": "mint",
  "#0F766E": "mint",
  "#65A30D": "lime",
  "#EAB308": "butter",
  "#D97706": "butter",
  "#EC4899": "rose",
  "#DB2777": "rose",
};

const ACCOUNT_TYPE_TAGS = new Set([
  "Creator",
  "Brand",
  "Studio",
  "Publication",
  "Community",
]);

const NAV_ITEMS: Array<{ id: ViewKey; index: string; label: string }> = [
  { id: "accounts", index: "01", label: "Accounts" },
  { id: "tags", index: "02", label: "Tags" },
  { id: "changes", index: "03", label: "Recent changes" },
  { id: "settings", index: "04", label: "Settings" },
];

const VIEW_TITLES: Record<ViewKey, { eyebrow: string; title: string }> = {
  accounts: { eyebrow: "Your directory", title: "Following atlas" },
  tags: { eyebrow: "Taxonomy", title: "Tag library" },
  changes: { eyebrow: "Activity", title: "Recent changes" },
  settings: { eyebrow: "Connection", title: "Sync settings" },
};

function initials(name: string) {
  return name
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "Not yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not yet";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    ...(date.getFullYear() !== new Date().getFullYear()
      ? { year: "numeric" as const }
      : {}),
    ...(includeTime
      ? { hour: "2-digit" as const, minute: "2-digit" as const }
      : {}),
  }).format(date);
}

function titleFromUsername(username: string) {
  return username
    .replace(/[._-]+/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function toneFor(color: string) {
  if ((TAG_COLORS as readonly string[]).includes(color)) {
    return color as (typeof TAG_COLORS)[number];
  }
  return HEX_TONES[color.toUpperCase()] ?? "violet";
}

function profileUsername(value: unknown, href?: unknown) {
  const direct = typeof value === "string" ? value.trim().replace(/^@/, "") : "";
  if (/^[a-zA-Z0-9._]{1,30}$/.test(direct)) return direct.toLowerCase();

  if (typeof href === "string") {
    try {
      const url = new URL(href);
      const pathParts = url.pathname.split("/").filter(Boolean);
      const candidate = pathParts[0] === "_u" ? (pathParts[1] ?? "") : (pathParts[0] ?? "");
      if (/^[a-zA-Z0-9._]{1,30}$/.test(candidate)) {
        return candidate.toLowerCase();
      }
    } catch {
      return null;
    }
  }
  return null;
}

function parseInstagramJson(payload: unknown): ImportedAccount[] {
  const found = new Map<string, ImportedAccount>();

  function remember(value: unknown, href: unknown, timestamp?: unknown) {
    const username = profileUsername(value, href);
    if (!username) return;
    const time = typeof timestamp === "number" ? new Date(timestamp * 1000) : null;
    found.set(username, {
      username,
      displayName: titleFromUsername(username),
      profileUrl:
        typeof href === "string" && href.startsWith("http")
          ? href
          : `https://www.instagram.com/${username}/`,
      followedAt: time && !Number.isNaN(time.getTime()) ? time.toISOString() : undefined,
    });
  }

  function walk(node: unknown) {
    if (Array.isArray(node)) {
      node.forEach(walk);
      return;
    }
    if (!node || typeof node !== "object") return;

    const record = node as Record<string, unknown>;
    if (Array.isArray(record.string_list_data)) {
      for (const item of record.string_list_data) {
        if (!item || typeof item !== "object") continue;
        const entry = item as Record<string, unknown>;
        remember(entry.value ?? record.title, entry.href, entry.timestamp);
      }
    } else if ("value" in record && "href" in record) {
      remember(record.value, record.href, record.timestamp);
    }

    Object.values(record).forEach(walk);
  }

  walk(payload);
  return [...found.values()];
}

function parseInstagramHtml(html: string): ImportedAccount[] {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const found = new Map<string, ImportedAccount>();
  doc.querySelectorAll<HTMLAnchorElement>('a[href*="instagram.com"]').forEach((link) => {
    const username = profileUsername(link.textContent, link.href);
    if (!username) return;
    found.set(username, {
      username,
      displayName: titleFromUsername(username),
      profileUrl: `https://www.instagram.com/${username}/`,
    });
  });
  return [...found.values()];
}

async function parseInstagramFile(file: File) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".zip")) {
    throw new Error(
      "Open the ZIP and choose following.json or following.html from the followers_and_following folder.",
    );
  }
  const text = await file.text();
  if (name.endsWith(".json") || text.trim().startsWith("{") || text.trim().startsWith("[")) {
    try {
      return parseInstagramJson(JSON.parse(text));
    } catch {
      throw new Error("This JSON file could not be read. Try Instagram’s following.json file.");
    }
  }
  if (name.endsWith(".html") || /<html|<a\s/i.test(text)) {
    return parseInstagramHtml(text);
  }
  throw new Error("Choose Instagram’s following.json or following.html file.");
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  const body = (await response.json().catch(() => null)) as
    | (T & { error?: string })
    | null;
  if (!response.ok) {
    throw new Error(body?.error || "Something went wrong. Please try again.");
  }
  return body as T;
}

export function FollowAtlasApp() {
  const [data, setData] = useState<AtlasState | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [activeView, setActiveView] = useState<ViewKey>("accounts");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([]);
  const [untaggedOnly, setUntaggedOnly] = useState(false);
  const [groupMode, setGroupMode] = useState<GroupMode>("none");
  const [sortMode, setSortMode] = useState<SortMode>("recent");
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [detailAccountId, setDetailAccountId] = useState<number | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [tagModalOpen, setTagModalOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const refreshState = useCallback(async () => {
    try {
      setLoadError(null);
      const next = await api<AtlasState>("/api/state", { cache: "no-store" });
      setData(next);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load the atlas.");
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void api<AtlasState>("/api/state", { cache: "no-store" })
      .then((next) => {
        if (cancelled) return;
        setLoadError(null);
        setData(next);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : "Could not load the atlas.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const activeAccount = useMemo(
    () => data?.accounts.find((account) => account.id === detailAccountId) ?? null,
    [data, detailAccountId],
  );

  const filteredAccounts = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = query.trim().toLowerCase();
    const accounts = data.accounts.filter((account) => {
      const matchesQuery =
        !normalizedQuery ||
        [
          account.username,
          account.displayName,
          account.bio,
          ...account.tags.map((tag) => tag.name),
        ]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery);
      const matchesTags = untaggedOnly
        ? account.tags.length === 0
        : selectedTagIds.length === 0 ||
          selectedTagIds.every((tagId) => account.tags.some((tag) => tag.id === tagId));
      return matchesQuery && matchesTags;
    });

    return [...accounts].sort((left, right) => {
      if (sortMode === "name") return left.displayName.localeCompare(right.displayName);
      if (sortMode === "newest") {
        return new Date(right.firstSeenAt).getTime() - new Date(left.firstSeenAt).getTime();
      }
      if (sortMode === "tags") return right.tags.length - left.tags.length;
      return new Date(right.lastSeenAt).getTime() - new Date(left.lastSeenAt).getTime();
    });
  }, [data, query, selectedTagIds, sortMode, untaggedOnly]);

  const groupedAccounts = useMemo(() => {
    if (groupMode === "none") return [["All accounts", filteredAccounts]] as Array<
      [string, Account[]]
    >;

    const groups = new Map<string, Account[]>();
    for (const account of filteredAccounts) {
      let label = "Needs review";
      if (groupMode === "type") {
        label = account.tags.find((tag) => ACCOUNT_TYPE_TAGS.has(tag.name))?.name ?? "Other";
      } else {
        label =
          account.tags.find((tag) => tag.isPrimary)?.name ??
          account.tags.find((tag) => !ACCOUNT_TYPE_TAGS.has(tag.name))?.name ??
          "Needs review";
      }
      groups.set(label, [...(groups.get(label) ?? []), account]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [filteredAccounts, groupMode]);

  const needsReview = data?.accounts.filter(
    (account) =>
      account.tags.length === 0 ||
      account.tags.some((tag) => tag.name === "Needs review"),
  ).length;
  const title = VIEW_TITLES[activeView];

  function navigate(view: ViewKey) {
    setActiveView(view);
    setMobileNavOpen(false);
  }

  function filterByTag(tagId: number) {
    setSelectedTagIds([tagId]);
    setUntaggedOnly(false);
    navigate("accounts");
  }

  async function deleteTag(tag: Tag) {
    if (tag.kind !== "custom") return;
    const confirmed = window.confirm(
      `Delete “${tag.name}”? It will be removed from ${tag.count} account${tag.count === 1 ? "" : "s"}.`,
    );
    if (!confirmed) return;
    try {
      await api<{ ok: true }>("/api/tags", {
        method: "DELETE",
        body: JSON.stringify({ id: tag.id }),
      });
      await refreshState();
      setToast(`Deleted ${tag.name}`);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not delete the tag.");
    }
  }

  async function assignTag(accountId: number, tagId: number) {
    try {
      await api<{ ok: true }>("/api/tag-assignment", {
        method: "POST",
        body: JSON.stringify({ accountId, tagId }),
      });
      await refreshState();
      setToast("Tag added");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not add the tag.");
    }
  }

  async function removeTag(accountId: number, tagId: number) {
    try {
      await api<{ ok: true }>("/api/tag-assignment", {
        method: "DELETE",
        body: JSON.stringify({ accountId, tagId }),
      });
      await refreshState();
      setToast("Tag removed");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "Could not remove the tag.");
    }
  }

  return (
    <div className="atlas-app">
      <div
        className={`mobile-scrim ${mobileNavOpen ? "is-visible" : ""}`}
        onClick={() => setMobileNavOpen(false)}
        aria-hidden="true"
      />
      <Sidebar
        activeView={activeView}
        open={mobileNavOpen}
        data={data}
        onNavigate={navigate}
        onFilterTag={filterByTag}
        onNewTag={() => setTagModalOpen(true)}
      />

      <main className="main-shell">
        <header className="topbar">
          <button
            className="mobile-menu-button"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation"
          >
            <span />
            <span />
          </button>
          <div>
            <p className="eyebrow">{title.eyebrow}</p>
            <h1>{title.title}</h1>
          </div>
          <div className="topbar-actions">
            <div className="sync-stamp">
              <span className="status-dot" />
              <span>
                Last update <strong>{formatDate(data?.meta.lastSyncedAt, true)}</strong>
              </span>
            </div>
            <button className="primary-button" onClick={() => setImportOpen(true)}>
              <span aria-hidden="true">↻</span>
              Refresh list
            </button>
          </div>
        </header>

        {loadError ? (
          <ErrorState message={loadError} onRetry={() => void refreshState()} />
        ) : !data ? (
          <LoadingState />
        ) : (
          <div className="content-wrap">
            {data.meta.demoMode && activeView === "accounts" ? (
              <DemoBanner onImport={() => setImportOpen(true)} />
            ) : null}

            {activeView === "accounts" ? (
              <AccountsView
                data={data}
                accounts={filteredAccounts}
                groups={groupedAccounts}
                query={query}
                selectedTagIds={selectedTagIds}
                untaggedOnly={untaggedOnly}
                groupMode={groupMode}
                sortMode={sortMode}
                viewMode={viewMode}
                needsReview={needsReview ?? 0}
                onQuery={setQuery}
                onToggleTag={(tagId) => {
                  setUntaggedOnly(false);
                  setSelectedTagIds((current) =>
                    current.includes(tagId)
                      ? current.filter((id) => id !== tagId)
                      : [...current, tagId],
                  );
                }}
                onShowUntagged={() => {
                  setSelectedTagIds([]);
                  setUntaggedOnly(true);
                }}
                onClearTags={() => {
                  setSelectedTagIds([]);
                  setUntaggedOnly(false);
                }}
                onGroupMode={setGroupMode}
                onSortMode={setSortMode}
                onViewMode={setViewMode}
                onOpenAccount={setDetailAccountId}
              />
            ) : null}

            {activeView === "tags" ? (
              <TagsView
                tags={data.tags}
                onNewTag={() => setTagModalOpen(true)}
                onDeleteTag={(tag) => void deleteTag(tag)}
                onFilterTag={filterByTag}
              />
            ) : null}

            {activeView === "changes" ? (
              <ChangesView syncRuns={data.syncRuns} removedAccounts={data.removedAccounts} />
            ) : null}

            {activeView === "settings" ? (
              <SettingsView data={data} onImport={() => setImportOpen(true)} />
            ) : null}
          </div>
        )}
      </main>

      {activeAccount && data ? (
        <AccountDrawer
          account={activeAccount}
          allTags={data.tags}
          onClose={() => setDetailAccountId(null)}
          onAssign={(tagId) => void assignTag(activeAccount.id, tagId)}
          onRemove={(tagId) => void removeTag(activeAccount.id, tagId)}
          onCreateTag={() => setTagModalOpen(true)}
        />
      ) : null}

      {importOpen ? (
        <ImportModal
          onClose={() => setImportOpen(false)}
          onImported={async (message) => {
            await refreshState();
            setImportOpen(false);
            setToast(message);
          }}
        />
      ) : null}

      {tagModalOpen ? (
        <NewTagModal
          onClose={() => setTagModalOpen(false)}
          onCreated={async (name) => {
            await refreshState();
            setTagModalOpen(false);
            setToast(`Created ${name}`);
          }}
        />
      ) : null}

      {toast ? <div className="toast">{toast}</div> : null}
    </div>
  );
}

function Sidebar({
  activeView,
  open,
  data,
  onNavigate,
  onFilterTag,
  onNewTag,
}: {
  activeView: ViewKey;
  open: boolean;
  data: AtlasState | null;
  onNavigate: (view: ViewKey) => void;
  onFilterTag: (tagId: number) => void;
  onNewTag: () => void;
}) {
  const favoriteTags = data?.tags.filter((tag) => tag.count > 0).slice(0, 5) ?? [];
  return (
    <aside className={`sidebar ${open ? "is-open" : ""}`}>
      <div className="brand-lockup">
        <span className="brand-mark" aria-hidden="true">
          <span>F</span>
          <span>A</span>
        </span>
        <div>
          <strong>Follow Atlas</strong>
          <span>Personal directory</span>
        </div>
      </div>

      <nav className="main-nav" aria-label="Main navigation">
        <p className="sidebar-label">Library</p>
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            className={activeView === item.id ? "is-active" : ""}
            onClick={() => onNavigate(item.id)}
          >
            <span>{item.index}</span>
            {item.label}
            {item.id === "accounts" && data ? <em>{data.accounts.length}</em> : null}
          </button>
        ))}
      </nav>

      <div className="saved-filters">
        <p className="sidebar-label">Quick tags</p>
        {favoriteTags.length ? (
          favoriteTags.map((tag) => (
            <button key={tag.id} onClick={() => onFilterTag(tag.id)}>
              <span className={`mini-swatch tone-${toneFor(tag.color)}`} />
              {tag.name}
              <em>{tag.count}</em>
            </button>
          ))
        ) : (
          <p className="sidebar-empty">Your most-used tags will live here.</p>
        )}
        <button className="new-tag-side" onClick={onNewTag}>
          <span>+</span> New tag
        </button>
      </div>

      <div className="sidebar-sync-card">
        <div className="sync-card-title">
          <span className="status-dot warning" />
          <strong>Import mode</strong>
        </div>
        <p>Automatic Instagram access is unavailable. Your atlas stays private here.</p>
        <button onClick={() => onNavigate("settings")}>View connection →</button>
      </div>
    </aside>
  );
}

function DemoBanner({ onImport }: { onImport: () => void }) {
  return (
    <section className="demo-banner">
      <div className="demo-stamp">DEMO</div>
      <div>
        <p className="eyebrow">A populated first look</p>
        <h2>Explore with sample accounts, then make it yours.</h2>
        <p>
          Import Instagram’s following file when you’re ready. The sample list will be
          replaced, while the organization tools stay exactly the same.
        </p>
      </div>
      <button className="text-button" onClick={onImport}>
        Import my list <span>→</span>
      </button>
    </section>
  );
}

function AccountsView({
  data,
  accounts,
  groups,
  query,
  selectedTagIds,
  untaggedOnly,
  groupMode,
  sortMode,
  viewMode,
  needsReview,
  onQuery,
  onToggleTag,
  onShowUntagged,
  onClearTags,
  onGroupMode,
  onSortMode,
  onViewMode,
  onOpenAccount,
}: {
  data: AtlasState;
  accounts: Account[];
  groups: Array<[string, Account[]]>;
  query: string;
  selectedTagIds: number[];
  untaggedOnly: boolean;
  groupMode: GroupMode;
  sortMode: SortMode;
  viewMode: ViewMode;
  needsReview: number;
  onQuery: (value: string) => void;
  onToggleTag: (tagId: number) => void;
  onShowUntagged: () => void;
  onClearTags: () => void;
  onGroupMode: (mode: GroupMode) => void;
  onSortMode: (mode: SortMode) => void;
  onViewMode: (mode: ViewMode) => void;
  onOpenAccount: (id: number) => void;
}) {
  const tagged = data.accounts.filter((account) => account.tags.length > 0).length;
  const untagged = data.accounts.length - tagged;
  const latestRun = data.syncRuns[0];
  const changed = (latestRun?.added ?? 0) + (latestRun?.removed ?? 0);

  return (
    <section className="accounts-view">
      <div className="accounts-intro">
        <div>
          <p className="eyebrow">A calmer way through your feed</p>
          <h2>Your following, finally findable.</h2>
        </div>
        <p>
          Search the people and ideas behind your feed. Auto-tags give you a head start;
          your own tags make the atlas personal.
        </p>
      </div>

      <div className="stat-strip">
        <Stat value={data.accounts.length} label="following" note="active accounts" />
        <Stat value={tagged} label="tagged" note={`${data.tags.length} tags in use`} />
        <Stat value={needsReview} label="need review" note="low-confidence matches" />
        <Stat value={changed} label="changed" note="in latest import" accent />
      </div>

      <div className="account-tools">
        <label className="search-box">
          <span aria-hidden="true">⌕</span>
          <span className="sr-only">Search accounts</span>
          <input
            type="search"
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            placeholder="Search names, handles, bios or tags"
          />
          {query ? (
            <button onClick={() => onQuery("")} type="button" aria-label="Clear search">
              ×
            </button>
          ) : null}
        </label>
        <div className="tool-selects">
          <label>
            <span>Group</span>
            <select
              value={groupMode}
              onChange={(event) => onGroupMode(event.target.value as GroupMode)}
            >
              <option value="none">None</option>
              <option value="primary">Primary tag</option>
              <option value="type">Account type</option>
            </select>
          </label>
          <label>
            <span>Sort</span>
            <select
              value={sortMode}
              onChange={(event) => onSortMode(event.target.value as SortMode)}
            >
              <option value="recent">Recently checked</option>
              <option value="name">Name A–Z</option>
              <option value="newest">Newest follows</option>
              <option value="tags">Most tagged</option>
            </select>
          </label>
          <div className="view-toggle" aria-label="Choose account view">
            <button
              className={viewMode === "list" ? "is-active" : ""}
              onClick={() => onViewMode("list")}
              aria-label="List view"
            >
              ≡
            </button>
            <button
              className={viewMode === "grid" ? "is-active" : ""}
              onClick={() => onViewMode("grid")}
              aria-label="Grid view"
            >
              ▦
            </button>
          </div>
        </div>
      </div>

      <div className="tag-filter-row">
        <button
          className={selectedTagIds.length === 0 && !untaggedOnly ? "is-active" : ""}
          onClick={onClearTags}
        >
          All accounts <span>{data.accounts.length}</span>
        </button>
        <button className={untaggedOnly ? "is-active" : ""} onClick={onShowUntagged}>
          Untagged <span>{untagged}</span>
        </button>
        {data.tags
          .filter((tag) => tag.count > 0)
          .slice(0, 10)
          .map((tag) => (
            <button
              key={tag.id}
              className={selectedTagIds.includes(tag.id) ? "is-active" : ""}
              onClick={() => onToggleTag(tag.id)}
            >
              <i className={`mini-swatch tone-${toneFor(tag.color)}`} />
              {tag.name} <span>{tag.count}</span>
            </button>
          ))}
      </div>

      <div className="result-heading">
        <p>
          Showing <strong>{accounts.length}</strong> of {data.accounts.length}
        </p>
        {selectedTagIds.length > 1 ? <span>Matching all selected tags</span> : null}
      </div>

      {accounts.length === 0 ? (
        <div className="empty-state">
          <span>0 results</span>
          <h3>No accounts match this view.</h3>
          <p>Try clearing a tag or using a shorter search.</p>
          <button
            className="secondary-button"
            onClick={() => {
              onQuery("");
              onClearTags();
            }}
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className={viewMode === "grid" ? "account-groups is-grid" : "account-groups"}>
          {groups.map(([label, groupAccounts]) => (
            <section className="account-group" key={label}>
              {groupMode !== "none" ? (
                <div className="group-title">
                  <h3>{label}</h3>
                  <span>{groupAccounts.length}</span>
                </div>
              ) : null}
              <div className={viewMode === "grid" ? "account-grid" : "account-list"}>
                {viewMode === "list" ? (
                  <div className="account-list-head" aria-hidden="true">
                    <span>Account</span>
                    <span>Tags</span>
                    <span>First seen</span>
                    <span />
                  </div>
                ) : null}
                {groupAccounts.map((account, index) =>
                  viewMode === "grid" ? (
                    <AccountCard
                      key={account.id}
                      account={account}
                      onOpen={() => onOpenAccount(account.id)}
                    />
                  ) : (
                    <AccountRow
                      key={account.id}
                      account={account}
                      index={index + 1}
                      onOpen={() => onOpenAccount(account.id)}
                    />
                  ),
                )}
              </div>
            </section>
          ))}
        </div>
      )}
    </section>
  );
}

function Stat({
  value,
  label,
  note,
  accent = false,
}: {
  value: number;
  label: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <div className={accent ? "stat-cell is-accent" : "stat-cell"}>
      <div>
        <strong>{String(value).padStart(2, "0")}</strong>
        <span>{label}</span>
      </div>
      <p>{note}</p>
    </div>
  );
}

function AccountRow({
  account,
  index,
  onOpen,
}: {
  account: Account;
  index: number;
  onOpen: () => void;
}) {
  return (
    <article className="account-row">
      <div className="account-main">
        <span className="row-index">{String(index).padStart(2, "0")}</span>
        <Avatar account={account} />
        <button className="account-identity" onClick={onOpen}>
          <strong>{account.displayName || titleFromUsername(account.username)}</strong>
          <span>@{account.username}</span>
          {account.bio ? <p>{account.bio}</p> : null}
        </button>
      </div>
      <div className="account-tags">
        {account.tags.slice(0, 3).map((tag) => (
          <TagChip tag={tag} key={tag.id} />
        ))}
        {account.tags.length > 3 ? <span className="more-tags">+{account.tags.length - 3}</span> : null}
        {account.tags.length === 0 ? <span className="untagged">Needs review</span> : null}
      </div>
      <time>{formatDate(account.firstSeenAt)}</time>
      <button className="row-open" onClick={onOpen} aria-label={`Open ${account.displayName}`}>
        ↗
      </button>
    </article>
  );
}

function AccountCard({ account, onOpen }: { account: Account; onOpen: () => void }) {
  return (
    <article className="account-card">
      <div className="card-topline">
        <Avatar account={account} large />
        <span>{formatDate(account.firstSeenAt)}</span>
      </div>
      <button className="card-identity" onClick={onOpen}>
        <strong>{account.displayName || titleFromUsername(account.username)}</strong>
        <span>@{account.username}</span>
      </button>
      <p className="card-bio">
        {account.bio || "Imported from your Instagram following list."}
      </p>
      <div className="card-tags">
        {account.tags.slice(0, 4).map((tag) => (
          <TagChip tag={tag} key={tag.id} />
        ))}
        {account.tags.length === 0 ? <span className="untagged">Needs review</span> : null}
      </div>
      <button className="card-open" onClick={onOpen}>
        View account <span>→</span>
      </button>
    </article>
  );
}

function Avatar({ account, large = false }: { account: Account; large?: boolean }) {
  const tone = Math.abs(
    [...account.username].reduce((total, character) => total + character.charCodeAt(0), 0),
  ) % 7;
  return (
    <span className={`avatar avatar-${tone} ${large ? "is-large" : ""}`} aria-hidden="true">
      {initials(account.displayName || account.username)}
      <i />
    </span>
  );
}

function TagChip({ tag }: { tag: AccountTag }) {
  return (
    <span
      className={`tag-chip tone-${toneFor(tag.color)} ${tag.kind === "auto" ? "is-auto" : ""}`}
      title={tag.rationale || undefined}
    >
      {tag.kind === "auto" ? <i aria-hidden="true">✦</i> : null}
      {tag.name}
    </span>
  );
}

function TagsView({
  tags,
  onNewTag,
  onDeleteTag,
  onFilterTag,
}: {
  tags: Tag[];
  onNewTag: () => void;
  onDeleteTag: (tag: Tag) => void;
  onFilterTag: (tagId: number) => void;
}) {
  const autoTags = tags.filter((tag) => tag.kind === "auto");
  const customTags = tags.filter((tag) => tag.kind === "custom");
  return (
    <section className="tag-library-view">
      <div className="section-lead">
        <div>
          <p className="eyebrow">Make the system yours</p>
          <h2>A useful vocabulary for your feed.</h2>
          <p>
            Automatic tags are explainable suggestions. Custom tags are entirely yours to
            create, use, and remove.
          </p>
        </div>
        <button className="primary-button" onClick={onNewTag}>
          <span>+</span> New custom tag
        </button>
      </div>

      <div className="tag-summary-cards">
        <div>
          <span className="summary-orb violet">✦</span>
          <strong>{autoTags.length}</strong>
          <p>auto tags</p>
          <small>Suggested from names and available profile text</small>
        </div>
        <div>
          <span className="summary-orb lime">+</span>
          <strong>{customTags.length}</strong>
          <p>custom tags</p>
          <small>Created and controlled by you</small>
        </div>
        <div>
          <span className="summary-orb coral">#</span>
          <strong>{tags.reduce((total, tag) => total + tag.count, 0)}</strong>
          <p>assignments</p>
          <small>Across your active following list</small>
        </div>
      </div>

      <div className="tag-table">
        <div className="tag-table-head" aria-hidden="true">
          <span>Tag</span>
          <span>Source</span>
          <span>Accounts</span>
          <span>Action</span>
        </div>
        {[...customTags, ...autoTags].map((tag) => (
          <article className="tag-table-row" key={tag.id}>
            <button className="tag-name-cell" onClick={() => onFilterTag(tag.id)}>
              <i className={`tag-color-block tone-${toneFor(tag.color)}`} />
              <span>
                <strong>{tag.name}</strong>
                <small>{tag.kind === "auto" ? "Explainable suggestion" : "Your tag"}</small>
              </span>
            </button>
            <span className={`source-pill ${tag.kind}`}>
              {tag.kind === "auto" ? "✦ Auto" : "Custom"}
            </span>
            <button className="tag-count" onClick={() => onFilterTag(tag.id)}>
              {tag.count} <span>view →</span>
            </button>
            {tag.kind === "custom" ? (
              <button className="delete-tag" onClick={() => onDeleteTag(tag)}>
                Delete
              </button>
            ) : (
              <span className="locked-tag">System</span>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function ChangesView({
  syncRuns,
  removedAccounts,
}: {
  syncRuns: SyncRun[];
  removedAccounts: Account[];
}) {
  return (
    <section className="changes-view">
      <div className="section-lead compact">
        <div>
          <p className="eyebrow">Nothing disappears without a trace</p>
          <h2>Your atlas, over time.</h2>
          <p>Each complete import is compared with the last one before anything changes.</p>
        </div>
      </div>

      <div className="changes-grid">
        <section className="timeline-panel">
          <div className="panel-heading">
            <h3>Import history</h3>
            <span>{syncRuns.length} runs</span>
          </div>
          {syncRuns.length ? (
            <div className="timeline">
              {syncRuns.map((run, index) => (
                <article className="timeline-entry" key={run.id}>
                  <div className="timeline-marker">
                    <span
                      className={
                        run.status === "succeeded" || run.status === "completed" ? "success" : ""
                      }
                    />
                    {index < syncRuns.length - 1 ? <i /> : null}
                  </div>
                  <div className="timeline-copy">
                    <div>
                      <strong>
                        {run.source === "demo" ? "Sample atlas created" : "Following list imported"}
                      </strong>
                      <time>{formatDate(run.finishedAt || run.startedAt, true)}</time>
                    </div>
                    <p>{run.message || `${run.importedCount} accounts checked against your atlas.`}</p>
                    <div className="change-badges">
                      <span className="added">+{run.added} added</span>
                      <span className="removed">−{run.removed} removed</span>
                      <span>{run.retagged} tagged</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel-empty">
              <span>↻</span>
              <h4>No imports yet</h4>
              <p>Your first completed import will appear here.</p>
            </div>
          )}
        </section>

        <section className="removed-panel">
          <div className="panel-heading">
            <h3>No longer followed</h3>
            <span>{removedAccounts.length}</span>
          </div>
          <p className="panel-note">
            Removed accounts stay here as a read-only record. Their custom tags are kept in
            case you follow them again.
          </p>
          {removedAccounts.length ? (
            <div className="removed-list">
              {removedAccounts.slice(0, 12).map((account) => (
                <article key={account.id}>
                  <Avatar account={account} />
                  <span>
                    <strong>{account.displayName}</strong>
                    <small>@{account.username}</small>
                  </span>
                  <time>{formatDate(account.lastSeenAt)}</time>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel-empty small">
              <span>✓</span>
              <h4>All clear</h4>
              <p>No accounts have left your atlas yet.</p>
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function SettingsView({ data, onImport }: { data: AtlasState; onImport: () => void }) {
  return (
    <section className="settings-view">
      <div className="section-lead compact">
        <div>
          <p className="eyebrow">A clear, compliant connection</p>
          <h2>Keep control of your Instagram data.</h2>
          <p>
            Follow Atlas never asks for your Instagram password or stores a browser session.
          </p>
        </div>
      </div>

      <div className="settings-stack">
        <article className="settings-card source-card">
          <div className="settings-card-index">01</div>
          <div className="settings-card-main">
            <div className="settings-card-title">
              <span className="source-logo">IG</span>
              <div>
                <p>Instagram source</p>
                <h3>Official data export</h3>
              </div>
              <span className="connection-pill">Manual · private</span>
            </div>
            <p>
              Instagram’s official API does not provide the full list of accounts you follow.
              The safe path is to import the “Followers and following” file from Accounts
              Center. A new complete import adds new follows and moves unfollowed accounts to
              your change log.
            </p>
            <div className="settings-actions">
              <button className="primary-button" onClick={onImport}>
                Import latest file
              </button>
              <a
                href="https://www.facebook.com/help/instagram/181231772500920"
                target="_blank"
                rel="noreferrer"
              >
                Instagram export help ↗
              </a>
            </div>
          </div>
        </article>

        <article className="settings-card schedule-card">
          <div className="settings-card-index">02</div>
          <div className="settings-card-main">
            <div className="settings-card-title">
              <span className="schedule-icon">24h</span>
              <div>
                <p>Daily refresh</p>
                <h3>Waiting for a supported source</h3>
              </div>
              <span className="connection-pill paused">Paused</span>
            </div>
            <p>
              The atlas is ready for complete-snapshot refreshes, but a daily job cannot see
              Instagram changes without a supported data source. It will never fake a sync or
              use brittle password-based scraping.
            </p>
            <div className="constraint-note">
              <span>!</span>
              <p>
                Manual imports are fully functional now. Daily automation can be connected
                later if Meta adds relationship access or you provide an approved source.
              </p>
            </div>
          </div>
        </article>

        <article className="settings-card data-card">
          <div className="settings-card-index">03</div>
          <div className="settings-card-main">
            <div className="settings-card-title">
              <span className="data-icon">•••</span>
              <div>
                <p>Your atlas</p>
                <h3>Durable, private organization</h3>
              </div>
              <span className="connection-pill good">Healthy</span>
            </div>
            <div className="data-facts">
              <div>
                <strong>{data.accounts.length}</strong>
                <span>active accounts</span>
              </div>
              <div>
                <strong>{data.tags.filter((tag) => tag.kind === "custom").length}</strong>
                <span>custom tags</span>
              </div>
              <div>
                <strong>{data.syncRuns.length}</strong>
                <span>saved imports</span>
              </div>
            </div>
            <p>
              Your tags, exclusions, and change history persist across sessions. Imported
              files are processed into structured account records; the source file itself is
              not retained.
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}

function AccountDrawer({
  account,
  allTags,
  onClose,
  onAssign,
  onRemove,
  onCreateTag,
}: {
  account: Account;
  allTags: Tag[];
  onClose: () => void;
  onAssign: (tagId: number) => void;
  onRemove: (tagId: number) => void;
  onCreateTag: () => void;
}) {
  const [tagToAdd, setTagToAdd] = useState("");
  const availableTags = allTags.filter(
    (tag) => !account.tags.some((accountTag) => accountTag.id === tag.id),
  );
  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-label={account.displayName}>
      <button className="drawer-scrim" onClick={onClose} aria-label="Close account details" />
      <aside className="account-drawer">
        <div className="drawer-topbar">
          <span>Account field note</span>
          <button onClick={onClose} aria-label="Close account details">
            ×
          </button>
        </div>
        <div className="drawer-profile">
          <Avatar account={account} large />
          <div>
            <h2>{account.displayName || titleFromUsername(account.username)}</h2>
            {account.profileUrl ? (
              <a href={account.profileUrl} target="_blank" rel="noreferrer">
                @{account.username} ↗
              </a>
            ) : (
              <span className="demo-handle">@{account.username} · fictional demo</span>
            )}
          </div>
        </div>
        <p className="drawer-bio">
          {account.bio ||
            "Instagram’s export includes the handle but not a profile bio. Tags are based on the information available in the file."}
        </p>

        <div className="drawer-facts">
          <div>
            <span>First seen</span>
            <strong>{formatDate(account.firstSeenAt)}</strong>
          </div>
          <div>
            <span>Last checked</span>
            <strong>{formatDate(account.lastSeenAt, true)}</strong>
          </div>
        </div>

        <section className="drawer-section">
          <div className="drawer-section-heading">
            <div>
              <p className="eyebrow">Organization</p>
              <h3>Tags</h3>
            </div>
            <span>{account.tags.length}</span>
          </div>
          <div className="drawer-tags">
            {account.tags.map((tag) => (
              <div className="drawer-tag" key={tag.id}>
                <TagChip tag={tag} />
                <span className="tag-origin">
                  {tag.kind === "auto" ? "Suggested" : "Added by you"}
                </span>
                <button onClick={() => onRemove(tag.id)} aria-label={`Remove ${tag.name}`}>
                  ×
                </button>
                {tag.rationale ? <p>{tag.rationale}</p> : null}
              </div>
            ))}
            {account.tags.length === 0 ? (
              <p className="drawer-empty">No tags yet. Add one below to start organizing.</p>
            ) : null}
          </div>

          <div className="tag-adder">
            <select value={tagToAdd} onChange={(event) => setTagToAdd(event.target.value)}>
              <option value="">Choose a tag…</option>
              {availableTags.map((tag) => (
                <option value={tag.id} key={tag.id}>
                  {tag.name} · {tag.kind === "auto" ? "auto" : "custom"}
                </option>
              ))}
            </select>
            <button
              className="secondary-button"
              disabled={!tagToAdd}
              onClick={() => {
                if (!tagToAdd) return;
                onAssign(Number(tagToAdd));
                setTagToAdd("");
              }}
            >
              Add tag
            </button>
          </div>
          <button className="inline-create-tag" onClick={onCreateTag}>
            + Create a new custom tag
          </button>
        </section>

        <div className="drawer-note">
          <span>✦</span>
          <p>
            Auto-tags are explainable and editable. Removing one records an exclusion so it
            stays removed on future imports.
          </p>
        </div>
      </aside>
    </div>
  );
}

function ImportModal({
  onClose,
  onImported,
}: {
  onClose: () => void;
  onImported: (message: string) => Promise<void>;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [accounts, setAccounts] = useState<ImportedAccount[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [parsing, setParsing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [dragging, setDragging] = useState(false);

  async function prepareFile(nextFile?: File) {
    if (!nextFile) return;
    setFile(nextFile);
    setError(null);
    setAccounts([]);
    setParsing(true);
    try {
      const parsed = await parseInstagramFile(nextFile);
      if (!parsed.length) {
        throw new Error(
          "No Instagram accounts were found. Choose following.json or following.html, not the followers file.",
        );
      }
      setAccounts(parsed);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The file could not be read.");
    } finally {
      setParsing(false);
    }
  }

  function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    void prepareFile(event.target.files?.[0]);
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    void prepareFile(event.dataTransfer.files?.[0]);
  }

  async function runImport() {
    if (!accounts.length) return;
    setImporting(true);
    setError(null);
    try {
      const result = await api<{
        added?: number;
        removed?: number;
        retagged?: number;
        importedCount?: number;
        syncRun?: {
          added: number;
          removed: number;
          retagged: number;
          importedCount: number;
        };
      }>("/api/import", {
        method: "POST",
        body: JSON.stringify({ accounts }),
      });
      const summary = result.syncRun ?? result;
      await onImported(
        `${summary.importedCount ?? accounts.length} checked · ${summary.added ?? 0} added · ${summary.removed ?? 0} removed`,
      );
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "The import could not finish.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="import-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close import" />
      <div className="modal import-modal">
        <div className="modal-topline">
          <span>Refresh your atlas</span>
          <button onClick={onClose} aria-label="Close import">
            ×
          </button>
        </div>
        <div className="modal-heading">
          <p className="eyebrow">Complete snapshot import</p>
          <h2 id="import-title">Update from Instagram.</h2>
          <p>
            Use your official Instagram export. Follow Atlas compares the full list before it
            adds new follows or archives accounts you no longer follow.
          </p>
        </div>

        <div className="import-steps">
          <div>
            <span>1</span>
            <p>
              In Accounts Center, export <strong>Followers and following</strong> for all time.
            </p>
          </div>
          <div>
            <span>2</span>
            <p>
              Choose <strong>JSON</strong> for the cleanest import, then open the downloaded ZIP.
            </p>
          </div>
          <div>
            <span>3</span>
            <p>
              Select <strong>following.json</strong> or <strong>following.html</strong> below.
            </p>
          </div>
        </div>

        <label
          className={`file-drop ${dragging ? "is-dragging" : ""} ${accounts.length ? "has-file" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
        >
          <input type="file" accept=".json,.html,.zip,application/json,text/html" onChange={onFileChange} />
          <span className="file-drop-icon">{accounts.length ? "✓" : "⇧"}</span>
          {parsing ? (
            <div>
              <strong>Reading your file…</strong>
              <p>This happens entirely before the account list is saved.</p>
            </div>
          ) : accounts.length ? (
            <div>
              <strong>{accounts.length} accounts ready</strong>
              <p>{file?.name} · choose another file to replace it</p>
            </div>
          ) : (
            <div>
              <strong>Drop your following file here</strong>
              <p>or click to choose JSON / HTML</p>
            </div>
          )}
        </label>

        {error ? <p className="form-error">{error}</p> : null}
        {accounts.length ? (
          <div className="import-preview">
            <span>Preview</span>
            <div>
              {accounts.slice(0, 5).map((account) => (
                <i key={account.username}>@{account.username}</i>
              ))}
              {accounts.length > 5 ? <i>+{accounts.length - 5} more</i> : null}
            </div>
          </div>
        ) : null}

        <div className="modal-actions">
          <a
            href="https://www.facebook.com/help/instagram/181231772500920"
            target="_blank"
            rel="noreferrer"
          >
            How to export ↗
          </a>
          <div>
            <button className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button
              className="primary-button"
              onClick={() => void runImport()}
              disabled={!accounts.length || importing}
            >
              {importing ? "Comparing accounts…" : `Import ${accounts.length || ""} accounts`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function NewTagModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<(typeof TAG_COLORS)[number]>("violet");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await api<{ ok: true }>("/api/tags", {
        method: "POST",
        body: JSON.stringify({ name: name.trim(), color: COLOR_HEX[color] }),
      });
      await onCreated(name.trim());
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Could not create the tag.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="modal-layer" role="dialog" aria-modal="true" aria-labelledby="new-tag-title">
      <button className="modal-scrim" onClick={onClose} aria-label="Close new tag form" />
      <form className="modal new-tag-modal" onSubmit={submit}>
        <div className="modal-topline">
          <span>Personal taxonomy</span>
          <button type="button" onClick={onClose} aria-label="Close new tag form">
            ×
          </button>
        </div>
        <div className="modal-heading">
          <p className="eyebrow">One word can change a view</p>
          <h2 id="new-tag-title">Create a custom tag.</h2>
          <p>Use it for anything that matters to you: favorites, research, clients, ideas.</p>
        </div>
        <label className="field-label">
          <span>Tag name</span>
          <input
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={32}
            placeholder="e.g. Potential collab"
          />
          <small>{name.length}/32</small>
        </label>
        <fieldset className="color-fieldset">
          <legend>Color</legend>
          <div>
            {TAG_COLORS.map((option) => (
              <label key={option} className={color === option ? "is-selected" : ""}>
                <input
                  type="radio"
                  name="tag-color"
                  value={option}
                  checked={color === option}
                  onChange={() => setColor(option)}
                />
                <span className={`tone-${option}`} />
                <i>{option}</i>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="tag-preview-box">
          <span>Preview</span>
          <span className={`tag-chip tone-${color}`}>{name.trim() || "Your tag"}</span>
        </div>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="modal-actions right">
          <div>
            <button type="button" className="secondary-button" onClick={onClose}>
              Cancel
            </button>
            <button className="primary-button" disabled={!name.trim() || saving}>
              {saving ? "Creating…" : "Create tag"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="loading-state" role="status">
      <div className="loading-line wide" />
      <div className="loading-line medium" />
      <div className="loading-stats">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="loading-table">
        <span />
        <span />
        <span />
        <span />
      </div>
      <p>Opening your atlas…</p>
    </div>
  );
}

function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="error-state">
      <span>!</span>
      <p className="eyebrow">The atlas stayed closed</p>
      <h2>We couldn’t load your accounts.</h2>
      <p>{message}</p>
      <button className="primary-button" onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}
