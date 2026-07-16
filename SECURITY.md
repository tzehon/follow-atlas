# Security policy

Follow Atlas handles a private social graph. Security reports are welcome, but
please keep all reports and reproductions free of real Instagram exports,
account details, credentials, and deployed application data.

## Supported version

Security fixes target the current `main` branch. Older commits and private
forks are not maintained as separate release lines.

## Intended security model

Follow Atlas is designed for one trusted owner using a private Sites
deployment and one shared Cloudflare D1 database. The hosting access policy is
the primary authorization boundary. The application does not implement its own
login, tenant isolation, or row-level access control.

Consequently:

- every person admitted by the hosting policy should be treated as able to read
  and modify the atlas;
- API routes must remain behind the same owner-only access policy as the UI;
- a public deployment is unsafe without application-level authorization and a
  per-user data model; and
- export retrieval, browser sessions, scheduled automation, and third-party
  storage integrations are outside this repository's trust boundary.

The application never needs an Instagram password or session cookie. Do not
add scraping credentials or browser-session handling to the application.

## Sensitive-data boundaries

Source control should contain application code, documentation, schema files,
and unmistakably fictional demo records only. Treat all of the following as
sensitive, even when individual Instagram profiles are public:

- Instagram export JSON, HTML, ZIP files, and the list of followed accounts;
- real usernames, display names, bios, profile URLs, follow timestamps, tags,
  removed-account history, and classification evidence;
- local or hosted D1 contents, backups, staging tables, and database dumps;
- deployment identifiers and private deployment URLs;
- environment files, API keys, bearer tokens, cookies, session state, private
  keys, and automation or storage-provider credentials; and
- screenshots, logs, traces, fixtures, or test failures containing any of the
  above.

Keep those materials outside the repository. Use sanitized, synthetic data for
tests, bug reports, screenshots, and examples. An ignored file is still present
on disk and can be leaked by sharing the whole working directory.

If sensitive data or a secret is committed, stop sharing the branch. Rotate or
revoke the secret first, then remove the material from the complete Git history
and any open pull requests or artifacts. Deleting it in a later commit is not
sufficient.

## Reporting a vulnerability

If the repository has GitHub private vulnerability reporting enabled, use
**Security > Report a vulnerability**. Include:

- the affected commit and component;
- impact under the owner-only threat model;
- minimal reproduction steps using synthetic data; and
- any proposed mitigation.

Do not include credentials, a live deployment URL, real account data, or a
database copy. If private vulnerability reporting is unavailable, open a
minimal GitHub issue asking the maintainer to enable a private reporting channel
without disclosing exploit details. Ordinary, non-sensitive defects can be
reported in a normal issue.

Please do not test against another person's deployment or data. Use a local,
disposable environment you control.

## Repository and dependency checks

Run the project checks before proposing a change:

```bash
npm run check
npm audit --omit=dev
```

`npm run audit:repo` is a small, pattern-based check of files currently tracked
by Git. It does not inspect Git history, ignored or untracked files, deployed
resources, or binary assets deeply, and it cannot prove that a repository is
free of personal data or secrets. Review the staged diff and tracked-file list
manually as well.

`npm audit` reports matches from the npm advisory database. It can contain false
positives, miss unknown or ecosystem-specific issues, and does not establish
that the application is secure. Evaluate advisories in the actual Cloudflare
worker and build-time context, update the lockfile deliberately, and re-run the
full test suite. Do not apply automated force upgrades without reviewing the
resulting dependency and behavior changes.
