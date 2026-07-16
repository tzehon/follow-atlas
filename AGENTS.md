# AGENTS.md

Guidance for coding agents working on Follow Atlas. Keep this repository a
reusable, privacy-safe example; the owner's real atlas belongs only in runtime
storage.

## Architecture

- `app/follow-atlas-app.tsx` is the client UI and parses selected Instagram
  `following.json`/`following.html` files into normalized records.
- `app/api/` contains the state, complete-snapshot import, tag-management, and
  tag-assignment routes. They are dynamic and return non-cacheable private data.
- `db/store.ts` owns validation, runtime D1 schema initialization, demo seeding,
  snapshot promotion, auto-tagging, and tag mutations. `db/schema.ts` and
  `drizzle/` describe the same persisted model for migrations.
- `worker/index.ts` is the vinext Cloudflare Worker entry point. `vite.config.ts`
  supplies the local D1 binding, and `build/sites-vite-plugin.ts` packages Sites
  metadata and migrations.
- `.openai/hosting.json` must remain a deployment-neutral logical binding only:
  `DB` for D1 and no live Sites project identity.

## Commands

Use Node.js 22.13 or later.

```bash
npm install
npm run dev
npm run lint
npm test
npm run audit:repo
npm run check
npm run db:generate
```

`npm test` builds the production bundle before running the HTML checks.
`npm run check` is the normal pre-commit gate: lint, build/tests, then the
repository privacy audit. Run `db:generate` only when the persisted schema
changes, and review the generated migration before keeping it.

## Privacy and security invariants

- Never commit real Instagram exports, ZIPs, account lists, profile evidence,
  classification outputs, screenshots, or any other real-account snapshot.
- Never commit `.wrangler/`, local D1/SQLite files, `dist/`, `node_modules/`,
  `.env*`, `.dev.vars*`, keys, cookies, access/bypass tokens, or browser state.
- Never add a live Sites project ID, deployment URL, D1 database ID, personal
  filesystem path, email address, or other owner identifier to tracked files.
- Keep demo records and preview assets fictional. Do not replace them with
  redacted-looking copies of real data.
- Deployments containing real data must remain private and owner-only. The API
  trusts the Sites access gate; a public or multi-user deployment requires
  application authorization, tenancy, and a separate security review.
- Do not add Instagram credential collection, session persistence, scraping, or
  export-retrieval automation to this example. Authorized external refresh
  automation is intentionally out of tree.
- Run `npm run audit:repo` before staging, but also review changes manually; the
  audit is a guardrail, not proof that a commit contains no PII or secrets.

## Snapshot and tag semantics

- `POST /api/import` accepts an authoritative **complete snapshot**, never a
  partial update. An account omitted from the payload becomes inactive and is
  retained in removal history; a later appearance reactivates it.
- Imports are staged before atomic promotion. Do not mutate the live list until
  every staging chunk succeeds. The first real import removes fictional demo
  accounts and demo sync history.
- Usernames are the stable account identity. Preserve normalization, validation,
  de-duplication, and the distinction between active and inactive accounts.
- Auto-tags are explainable keyword suggestions (up to three). Refreshes may
  recompute auto-tags, but manual assignments must survive. Removing a suggested
  tag records an exclusion so it is not silently restored on the next refresh.
- Do not label an import as incremental or claim that the app retrieves exports
  or profile metadata itself. Scheduled jobs must submit the same complete
  snapshot contract through an authorized external workflow.

## Editing and testing expectations

- Preserve request validation, structured `StoreError` responses, and
  `Cache-Control: no-store` on private API responses. Do not log payloads or
  account data.
- Keep `db/store.ts`, `db/schema.ts`, and `drizzle/` aligned for schema changes;
  make migrations additive and safe for existing owner data.
- Add focused tests for behavior changes, especially snapshot reconciliation,
  tag preservation/exclusions, validation, and privacy boundaries.
- Update `README.md` whenever behavior, API contracts, setup, privacy posture,
  or deployment requirements change.
- Run the narrowest relevant check while iterating, then `npm run check` before
  handing off. Report any check that could not be run.

## Git hygiene

- Inspect `git status` and diffs first; preserve unrelated user work and keep
  commits focused. Never use destructive reset/checkout or force-push without
  explicit authorization.
- Do not stage ignored runtime artifacts. Before committing, inspect both
  `git diff` and `git diff --cached`, then run `npm run audit:repo` against the
  exact tracked snapshot.
- Do not commit deployment linkage or credentials merely to make deployment
  convenient. Keep the source history anonymous and reusable, and use the
  deployment platform's private configuration for owner-specific values.
