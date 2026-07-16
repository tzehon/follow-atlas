# Follow Atlas

Follow Atlas is a private, single-user directory for the Instagram accounts you
follow. It imports Instagram's official following export, keeps a complete
snapshot in Cloudflare D1, suggests explainable tags, and lets you search,
filter, group, sort, and add your own tags.

This repository is a reusable application example. It contains synthetic demo
records only. It does **not** contain an Instagram export, a deployed database,
browser session data, automation credentials, or a copy of a real atlas.

## What it does

- imports `following.json` or `following.html` from Instagram's official export;
- compares each import as a complete snapshot, adding newly followed accounts
  and moving unfollowed accounts into a read-only history;
- suggests keyword-based tags from the handle, display name, and bio when those
  fields are available;
- records why an automatic tag matched and remembers exclusions when a
  suggestion is removed;
- supports custom tags and manual account-tag assignments;
- searches names, handles, bios, and tags; and
- filters, groups, and sorts the account directory.

## Privacy and security model

Follow Atlas is designed for an **owner-only Sites deployment** backed by one
shared D1 database. The API routes assume that the hosting access policy has
already admitted the trusted owner. Do not publish the deployed app to the
open internet without adding application-level authorization and a per-user
data model.

The app never asks for an Instagram password or stores an Instagram browser
session. The imported following list is private data and lives in the local or
hosted D1 database, not in Git.

Never commit or share:

- Instagram export JSON, HTML, or ZIP files;
- `.wrangler/` or other local database state;
- `.env*`, `.dev.vars*`, keys, cookies, or bearer tokens; or
- classification evidence or account snapshots derived from a real profile.

The repository's ignore rules cover the common forms of those files. Use a Git
remote or `git archive` to share source code; do not zip the whole working
directory, because ignored runtime data can still be present locally.

## Local development

Requirements: Node.js 22.13 or later.

```bash
npm install
npm run dev
```

The first local run creates a project-local D1 database and seeds twelve
fictional demo accounts. Importing a real following snapshot removes the demo
records.

Useful checks:

```bash
npm run lint
npm test
npm run audit:repo
npm run check
```

`audit:repo` is a lightweight guard for common credential signatures,
machine-specific paths, deployment IDs, and accidentally tracked exports. It
does not replace a dedicated secret scanner or human privacy review.

## Importing an Instagram export

1. In Instagram Accounts Center, request **Followers and following** for all
   time. JSON is the cleanest format.
2. Download and unzip the export outside this repository.
3. In Follow Atlas, choose **Refresh list** and select `following.json` or
   `following.html`.

The browser parses the selected file and sends a normalized, complete account
snapshot to the app. The official export normally includes handles and links,
but not profile bios, so automatic tagging may be limited until richer metadata
is supplied by an authorized workflow.

## Scheduled refreshes

The source application accepts complete snapshots through `POST /api/import`,
so an external, authorized automation can refresh it. Export retrieval itself
is deliberately outside this repository: Instagram does not provide the full
following list through its supported API, and this example ships no browser
automation, Google Drive integration, credentials, or scheduler.

Profile-page review and one-off model classifications are also external to this
codebase. Newly followed accounts are not silently scraped by the deployed app.

## API surface

These routes are intended to remain behind the private Sites access gate:

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/state` | Read accounts, tags, removals, and sync history |
| `POST` | `/api/import` | Replace the active following snapshot |
| `POST/PATCH/DELETE` | `/api/tags` | Manage custom tags |
| `POST/DELETE` | `/api/tag-assignment` | Add or remove an account tag |

An import payload has this shape:

```json
{
  "accounts": [
    {
      "username": "example.account",
      "displayName": "Example Account",
      "bio": "Optional metadata",
      "profileUrl": "https://www.instagram.com/example.account/",
      "followedAt": "2026-01-01T00:00:00.000Z"
    }
  ]
}
```

Treat every import as a complete snapshot. Accounts absent from the payload are
marked inactive.

## Deploying with Sites

The project uses vinext and declares its logical D1 binding in
`.openai/hosting.json`. The checked-in manifest intentionally has no live
project identifier; Sites adds the identifier when a new deployment is linked.

Before using real data:

1. deploy the app as private/owner-only;
2. verify that the `DB` D1 binding is attached;
3. keep the deployment URL and automation credentials outside source code; and
4. confirm the access policy before importing an Instagram export.

## Project layout

- `app/` — interface and API routes
- `db/store.ts` — validation, D1 schema setup, snapshot syncing, and tags
- `drizzle/` — schema-only migrations
- `worker/` — Cloudflare worker entry point
- `tests/` — build and repository-safety checks
- `public/og.png` — synthetic social preview artwork

## Contributing and maintenance

- [CONTRIBUTING.md](CONTRIBUTING.md) covers setup, checks, migrations, and the
  privacy review expected for every change.
- [SECURITY.md](SECURITY.md) documents the owner-only threat model and private
  vulnerability-reporting guidance.
- [AGENTS.md](AGENTS.md) gives coding agents repository-specific constraints
  and validation steps.
- GitHub Actions runs the same project checks and a production dependency audit
  for pushes and pull requests. Dependabot checks npm and workflow dependencies
  monthly.

No license is included. Add the license you want before inviting third-party
reuse or contributions.
