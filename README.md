# Linearr

A Linear-style project management app with Jira-depth issues and a Trello-style kanban board.
Next.js App Router · TypeScript · PostgreSQL + Drizzle · Tailwind + shadcn/ui · dnd-kit · Auth.js · Octokit · Tiptap.

## Quick start

```bash
# 1. Postgres (any Postgres works; a docker one-liner:)
docker run -d --name linearr-postgres -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=linearr -p 5434:5432 postgres:16-alpine

# 2. Install, push schema, seed demo data
npm install
npm run db:push
npm run db:seed

# 3. Run
npm run dev
```

Open http://localhost:3000 and sign in with a **demo user** (dev-only, no OAuth needed).
The seed gives you the `acme` workspace, two projects (ENG, WEB), 21 issues, cycles,
labels, comments with @mentions, notifications, and a fake GitHub connection so every
surface has data.

## Features

- **Workspaces → Projects → Issues**, plus cycles (sprints) and epics (`issues.type`,
  sub-tasks and epic children via `parent_id`)
- **Three views of the same data**: list grouped by status, kanban board
  (drag-and-drop persists status + manual order), full issue page with activity feed
- **Issues**: rich Tiptap description with autosave, status/priority/assignee/labels/
  cycle/due date/estimate, sub-tasks, comments
- **@mentions**: typeahead in comments & descriptions → notification for the mentioned
  user (deduped, never notifies the actor) → notifications inbox with unread badge
- **Command palette** (⌘K): fuzzy issue search, navigation, create issue, chained
  "set status" action
- **Keyboard**: `C` new issue · `⌘K` palette · `g i` inbox · `g e` issues · `g b` board
- **GitHub integration** (GitHub App, multiple orgs/repos per workspace):
  - auto-link branches/PRs/commits containing an issue key (`ENG-12`)
  - PR opened → issue moves to In Progress · PR merged → Done
  - linked branches/PRs with live state on the issue page, activity + notifications

## GitHub App setup (optional — the UI works without it)

1. Create a GitHub App: Settings → Developer settings → GitHub Apps → New.
   - Permissions: Contents (read), Pull requests (read), Metadata (read)
   - Events: `create`, `push`, `pull_request`, `installation`, `installation_repositories`
   - Webhook URL: `https://<your-host>/api/github/webhook` (use a tunnel in dev)
   - Setup URL: `https://<your-host>/api/github/setup` (check "Redirect on update")
2. Fill in `.env`: `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_PRIVATE_KEY`,
   `GITHUB_WEBHOOK_SECRET`.
3. In workspace Settings → "Connect GitHub" installs the app; repos sync automatically.

For GitHub **login** (instead of demo users), create an OAuth app with callback
`http://localhost:3000/api/auth/callback/github` and set `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET`.

## Scripts

- `npm run dev` / `build` / `start`
- `npm run db:push` — sync Drizzle schema to Postgres
- `npm run db:seed` — reset + seed demo data
- `npm run db:studio` — Drizzle Studio
