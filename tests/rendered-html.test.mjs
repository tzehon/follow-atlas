import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);

test("ships the Follow Atlas product shell", async () => {
  const [page, layout, app, css, packageJson] = await Promise.all([
    readFile(new URL("app/page.tsx", root), "utf8"),
    readFile(new URL("app/layout.tsx", root), "utf8"),
    readFile(new URL("app/follow-atlas-app.tsx", root), "utf8"),
    readFile(new URL("app/globals.css", root), "utf8"),
    readFile(new URL("package.json", root), "utf8"),
  ]);

  assert.match(page, /<FollowAtlasApp \/>/);
  assert.match(page, /title:\s*"Follow Atlas"/);
  assert.match(layout, /openGraph/);
  assert.match(layout, /\/og\.png/);
  assert.match(app, /Following atlas/);
  assert.match(app, /Refresh list/);
  assert.match(app, /\/api\/state/);
  assert.match(app, /\/api\/import/);
  assert.match(css, /\.account-grid/);
  assert.doesNotMatch(page + layout, /codex-preview|Your site is taking shape/);
  assert.doesNotMatch(packageJson, /react-loading-skeleton/);
  assert.match(packageJson, /"name": "follow-atlas"/);
  await access(new URL("public/og.png", root));
});

test("keeps deployment identity and private imports out of the reusable snapshot", async () => {
  const [hosting, ignore] = await Promise.all([
    readFile(new URL(".openai/hosting.json", root), "utf8"),
    readFile(new URL(".gitignore", root), "utf8"),
  ]);

  assert.doesNotMatch(hosting, /project_id|appgprj_/);
  assert.match(hosting, /"d1": "DB"/);
  assert.match(ignore, /\.wrangler\//);
  assert.match(ignore, /followers_and_following/);
  assert.match(ignore, /\.sqlite/);
});

test("routes sidebar quick tags into the account filter", async () => {
  const app = await readFile(new URL("app/follow-atlas-app.tsx", root), "utf8");
  const filterHandler = app.slice(
    app.indexOf("function filterByTag"),
    app.indexOf("async function deleteTag"),
  );
  const sidebarStart = app.indexOf("<Sidebar");
  const sidebarUsage = app.slice(sidebarStart, app.indexOf("/>", sidebarStart));
  const sidebarDefinition = app.slice(
    app.indexOf("function Sidebar"),
    app.indexOf("function DemoBanner"),
  );

  assert.match(filterHandler, /setSelectedTagIds\(\[tagId\]\)/);
  assert.match(filterHandler, /setUntaggedOnly\(false\)/);
  assert.match(filterHandler, /navigate\("accounts"\)/);
  assert.match(sidebarUsage, /onFilterTag=\{filterByTag\}/);
  assert.match(sidebarDefinition, /onFilterTag: \(tagId: number\) => void/);
  assert.match(sidebarDefinition, /onClick=\{\(\) => onFilterTag\(tag\.id\)\}/);
  assert.doesNotMatch(sidebarDefinition, /onClick=\{\(\) => onNavigate\("tags"\)\}/);
});
