# Contributing to Follow Atlas

Thank you for improving Follow Atlas. Contributions should preserve its simple
owner-only design and its strict separation between reusable source code and a
person's private Instagram data.

## Before you start

- Discuss large features, data-model changes, new integrations, or security
  boundary changes in an issue before investing in an implementation.
- Keep changes focused. Avoid unrelated formatting or dependency churn.
- Use fictional data everywhere: code, tests, screenshots, issue reports,
  commit messages, and pull-request descriptions.
- Read [SECURITY.md](SECURITY.md) before changing authentication, API routes,
  imports, storage, automation, or dependencies.

## Local setup

Follow Atlas requires Node.js 22.13 or later.

```bash
git clone <your-fork-url>
cd follow-atlas
npm ci
npm run dev
```

The local application uses a project-local D1 database and seeds fictional demo
accounts. Do not import a real Instagram export into a development directory
that you intend to archive, attach to an issue, or share with another person.

## Making a change

1. Create a short-lived branch from the current `main` branch.
2. Add or update tests for behavior that changes.
3. Keep fixtures unmistakably synthetic and small.
4. Update the README and other relevant documentation when behavior, setup,
   APIs, storage, or the security model changes.
5. Run the complete checks before opening a pull request.

```bash
npm run check
```

The combined check runs linting, a production build, rendered-HTML tests, and
the repository safety audit. For dependency changes, also run:

```bash
npm audit --omit=dev
```

Review audit findings in context; see [SECURITY.md](SECURITY.md) for the limits
of automated dependency and repository scanning.

## Privacy review

Never commit raw or derived user data. Prohibited material includes:

- Instagram exports or archives;
- real account handles, names, bios, URLs, follow times, tags, or unfollow
  history;
- classification evidence or model output derived from real profiles;
- D1 databases, dumps, backups, local Wrangler state, logs, or traces;
- credentials, cookies, session data, environment files, deployment IDs, or
  private deployment URLs; and
- screenshots or test artifacts that expose any of these values.

Before every commit:

```bash
git status --short
git diff --cached
git ls-files
npm run audit:repo
```

Inspect the output rather than relying only on `.gitignore` or the audit script.
The audit checks tracked text files for a limited set of patterns; it does not
scan prior commits, ignored files, or all binary content. If a test needs
account-like records, create clearly fictional examples rather than modifying
or redacting real records.

## Database and migrations

The schema has two representations that must remain aligned:

- `db/schema.ts` is the declarative Drizzle schema; and
- `SCHEMA_STATEMENTS` in `db/store.ts` initializes a fresh D1 database at
  runtime.

For a schema change:

1. update `db/schema.ts`;
2. update the runtime bootstrap statements in `db/store.ts`;
3. add an explicit, idempotent upgrade path for existing databases—`CREATE
   TABLE IF NOT EXISTS` does not alter an existing table;
4. run `npm run db:generate` and inspect the generated SQL and Drizzle metadata;
5. test both a fresh synthetic database and an upgrade from the previous
   synthetic schema; and
6. document backup, rollout, and rollback considerations in the pull request.

Do not edit generated Drizzle metadata merely to make a diff look cleaner. Do
not test migrations against the owner's production atlas. Generated migration
files are not automatically proof that the runtime deployment applies them.

## Commits and pull requests

Use concise, imperative commit subjects and keep each commit internally
coherent. A conventional prefix such as `feat:`, `fix:`, `docs:`, `test:`, or
`chore:` is encouraged.

A pull request should include:

- what changed and why;
- user-visible and security/privacy effects;
- tests run and their results;
- migration and rollback notes when storage changes; and
- screenshots for visual changes, containing synthetic data only.

Before requesting review, confirm that the PR contains no build output, local
database state, exports, secrets, personal data, or unrelated changes. Never
paste a secret into a commit, issue, review comment, or CI log. If one is
exposed, rotate it immediately and follow the history-cleanup guidance in
[SECURITY.md](SECURITY.md).
