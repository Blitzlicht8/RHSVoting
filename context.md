# Project Context — Rizal High School Elections

> Read this at session start. Follow every rule here without being asked.

---

## What This Is

The Rizal High School electronic elections and feed platform built on Next.js 14. Originally a school voting app — fully de-schooled. Deployed on Vercel, DB on Turso (SQLite).

**Repo:** `https://github.com/Blitzlicht8/RHSVoting.git` · branch: `master`
**Deploy target:** Vercel (auto-deploys on master push)
**Current version:** check `package.json` → `"version"`

---

## Push / Commit Access

**Remote URL (with auth token embedded):**
```
https://<GITHUB_PAT>@github.com/Blitzlicht8/RHSVoting.git
```

**Verify current remote is set correctly:**
```bash
git remote get-url origin
```

**If remote is missing the token, set it:**
```bash
git remote set-url origin https://<GITHUB_PAT>@github.com/Blitzlicht8/RHSVoting.git
```

**Push command:**
```bash
git push origin master
```

Token type: GitHub Personal Access Token (PAT) — scope: `repo` (full).
If the token stops working, generate a new one at GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic). Update the remote URL with the new token.

---

## Tech Stack

| Layer | What |
|---|---|
| Framework | Next.js 14 App Router (`src/app/`) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS |
| Database | Turso / libsql (`@libsql/client`) |
| Auth | jose JWT — cookie `auth-token`, HttpOnly |
| File storage | Vercel Blob (`@vercel/blob`) |
| Email | Nodemailer |
| Runtime | Node.js (Edge middleware for auth redirect only) |

---

## Required Env Vars

```
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
JWT_SECRET=
BLOB_READ_WRITE_TOKEN=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASS=
NEXT_PUBLIC_APP_URL=
```

Lives in `.env.local`. Never commit this file.

---

## Roles

```
master_admin  (4) — full control
admin         (3) — manage users, settings
moderator     (2) — moderate content
staff         (1) — elevated member
member        (0) — base role
```

Legacy (display-only, no new assignment): `teacher_admin`, `student_admin`, `teacher`, `student`

`isAdmin` = level ≥ 2 (moderator and above).

---

## Design System

**Primary:** `#84050C` · **Hover:** `#6B0409` · **Tint bg:** `#FEE2E2`

| Combination | Text | Background |
|---|---|---|
| Primary button | `text-white` | `bg-[#84050C]` |
| Tint badge | `text-[#6B0409]` | `bg-[#FEE2E2]` |
| Amber warning | `text-amber-700` | `bg-amber-50 border-amber-200` |
| Danger | `text-red-600` | `bg-red-50` |
| Success | `text-green-700` | `bg-green-50` |

Before shipping UI: verify every text-background pair is readable. Dark text on dark bg = broken. Light text on light bg = broken. Fix before committing.

---

## Architecture Quick Map

```
src/
  app/
    page.tsx              → login
    dashboard/            → home after login
    feed/                 → post feed (composer gated by id_verified)
    elections/            → list + [id] detail
    users/                → member directory
    profile/              → own profile
    verify-id/            → ID upload
    admin/                → AdminLayout — all admin pages live here
      users/              → user management + name history
      settings/           → app config (merged from app-config)
      academic/           → group structure (l1/l2/l3 dynamic)
      elections/          → manage elections
      verifications/      → review ID uploads
      reports/ logs/ roles/
    api/                  → ALL routes have force-dynamic (see below)
  components/
    AdminLayout.tsx       → admin sidebar, no BottomNav
    Layout.tsx            → user layout with Sidebar + BottomNav
    Sidebar.tsx           → user nav (Members, Verify Identity conditional)
    Navbar.tsx            → top bar, profile/admin dropdown
    BottomNav.tsx         → mobile nav, admin shortcut for mod+
    PostCard.tsx          → blocks react/comment when !id_verified
  lib/
    auth.ts               → JWT, isAdmin, getRoleLabel, getRoleBadgeVariant
    db.ts                 → lazy Turso client (Proxy) — do not change to eager
```

---

## Critical Patterns (do not break)

**`db.ts` is lazy** — `db` is a JS Proxy that only creates the real Turso client on first access. Changing it back to eager (`export const db = makeClient()`) breaks Vercel builds. Leave it.

**Every `route.ts`** must have this at the very top:
```typescript
export const dynamic = 'force-dynamic'
```
Add it to every new API route you create. Without it, Next.js tries to statically prerender the route at build time and fails when env vars aren't present.

**Client fetches to protected endpoints** must have:
```typescript
fetch('/api/...', { credentials: 'include' })
```

**Settings API** — flat key-value. `GET /api/settings` → `{ data: Record<string, string> }`.
Dynamic group labels: `group_label_l1` (default "Group"), `group_label_l2` ("Subgroup"), `group_label_l3` ("Unit"). Never hardcode "Grade Level" / "Section" / "Track".

**Unverified users** (`id_verified = 0`) are read-only. Show amber banner → `/verify-id`. No compose, no react, no comment.

---

## Versioning — `package.json`

Format: `MAJOR.MINOR.FIX`

| Bump | When |
|---|---|
| **MAJOR** | Breaking change, DB migration, full redesign |
| **MINOR** | New feature, new page, new API endpoint |
| **FIX** | Bug fix, copy/style tweak, dep update |

Bump the version with every commit that ships to master.

---

## QA — Run Before Every Commit (no exceptions)

```bash
npx tsc --noEmit && npm run build && echo "✅ READY"
```

If it fails: fix before committing. Never push broken code — Vercel auto-deploys master.

Steps when build fails:
1. `npx tsc --noEmit` — fix type errors first
2. `npm run build` — fix prerender/bundle errors
3. Never `--no-verify`

---

## Commit Format

```
type: short description

feat     new feature or page
fix      bug fix
style    UI only, no logic change
refactor restructure, same behavior
chore    deps, config, tooling
docs     docs/comments only
```

Always co-author:
```
Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>
```

Stage specific files. Never `git add .` blindly — skip `.env*`, `.next/`, `node_modules/`, `*.stackdump`.

---

## Auto-Behaviors (do these without being asked)

1. **QA first** — `npx tsc --noEmit && npm run build` before any commit
2. **Bump version** in `package.json` — pick MAJOR/MINOR/FIX (update app version on settings)
3. **Update `handoff.md`** — write what changed this session (overwrite previous)
4. **Add `export const dynamic = 'force-dynamic'`** to every new `route.ts`
5. **Add `credentials: 'include'`** to every client fetch to a protected endpoint
6. **Check color contrast** before any UI change ships
7. **Never hardcode school labels** — use settings `group_label_l1/l2/l3`
8. **Commit + push** — after QA passes and handoff is updated, commit staged files and push to origin master

---

## What Not To Do

- **Don't edit `context.md` unless the user explicitly instructs it** — no auto-updates, no "keeping it current", no adding things you think are useful. User says change it → change it. Otherwise leave it alone.
- Don't revert `db.ts` to eager init
- Don't hardcode "Grade Level", "Section", "Student", "Teacher"
- Don't commit `.env.local`, `.next/`, `node_modules/`
- Don't push without the QA build passing
- Don't use `any` types unless unavoidable
- Don't forget `force-dynamic` on new routes
- Don't use `git add -A` or `git add .` — stage named files only
