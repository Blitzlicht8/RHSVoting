# Session Prompts — Rizal High School Elections Overhaul

Paste one block per session, in order. Each depends on prior ones (structure changes ripple: Settings → Profile/Verification → Elections → Feed → Admin/Roles/Logs).

## Rules for every session (apply to all prompts below)

- **Token discipline**: don't re-read whole large files repeatedly, don't dump full file contents into responses, don't re-explore already-known structure. Use targeted grep/read on specific files/lines, not broad scans. Keep responses terse — no restating the plan back before acting.
- **Branch workflow**: before starting, create a branch off `master` — `feat/<short-name>` for new features, `fix/<short-name>` for bug fixes (e.g. `feat/group-structure`, `fix/feed-media-upload`). Do all work on that branch. After QA passes (`npx tsc --noEmit && npm run build`), update `handoff.md` (and `context.md` only if the session explicitly changes something documented there, e.g. Roles table), commit, merge branch into `master`, then push `master`. Delete the merged branch after.

---

## Session 1 — Rebrand + Configurable Group Structure

Read `handoff.md` and `context.md` fully first for existing patterns and current state before changing anything.

Rebrand this app from a general community hub back to "Rizal High School Elections" (school-specific, not community platform). Update `context.md` header, app name/logo strings, copy referencing "community hub" across UI (Navbar, Layout, settings labels, metadata/titles) to Rizal High School Elections branding. Do not touch the `group_label_l1/l2/l3` genericization pattern — that stays.

Refactor Group Structure (currently fixed 3-level l1/l2/l3 under `admin/academic`) into a fully configurable system in Settings:
- Admins can add/remove group structures (min 1 must always remain — block delete of last one).
- Each structure has a toggle: required vs optional (affects account creation validation).
- Each structure can be created as a level within a hierarchy (like current Group Level → Subgroup → Unit chain) OR as a standalone structure with no parent/child dependency.
- Migrate existing `group_label_l1/l2/l3` + related tables (grade_levels/subtypes/sections or whatever backs them — check `src/app/admin/academic/` and `src/lib/db.ts`) into this new configurable model. Write a DB migration, don't break existing elections/candidates that reference `grade_level_id/subtype_id/section_id`.
- Update Verifier structure (verification requests / admin verifications review) to reflect dynamic group structures instead of hardcoded l1/l2/l3.
- Update voting/election eligibility structure creation (`GradeTargetingBuilder`, election eligibility rules) to list whatever group structures exist now, leveled or standalone.

Follow the QA/versioning/commit rules in `context.md`.

---

## Session 2 — Account Creation, Profile, Verification Refactor

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file. Depends on Session 1's group structure model.

Refactor account creation + profile + verification into one flow:
- Add `LRN` (Learner's Reference Number) field to users table and profile/account creation form.
- Move group structure selection (whatever was created in Session 1 — leveled and standalone) into account creation. Required structures block account creation until selected; optional ones can stay blank.
- Move Verification Document Type selection into account creation (currently likely in `verify-id/page.tsx` — check).
- Add profile picture upload to account creation, required, must be an actual face — do real-image/face validation (basic heuristic or library check; note if a full face-detection lib is out of scope, flag it, don't fake it).
- Account creation now auto-triggers verification submission (no separate later step).
- On verification denial: user is informed to reverify (banner/notification, reuse `deriveUiState` pattern from `verify-id/page.tsx`).
- Admin denial flow: when admin rejects, they check/tick which specific fields are wrong (e.g. Document Type, Profile Photo, LRN, Group Selection). Store these flagged fields on the verification request (new column, e.g. `denied_fields` JSON).
- Reverification window: user can only edit the fields the admin ticked; other fields locked/read-only, with each ticked field showing what was denied and needs resubmission.

Update `handoff.md` architectural notes for the new `verification_requests` schema and `deriveUiState` priority once field-level denial exists.

---

## Session 3 — Settings Autosave-away / Save Bar + Unsaved Changes Guard

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file.

Add a persistent "Save" bar at top of `admin/settings` (and any other settings-like config pages, e.g. academic/group structure editor from Session 1) that applies changes immediately on Save rather than per-field submit.
Add unsaved-changes guard: if user has pending edits and tries to navigate away/close tab/switch page, show a confirm dialog ("Discard changes?"). Use Next.js router event interception + `beforeunload` for tab close.

Fix App Version display in Settings — stuck showing `v0.3.0`, not reflecting `package.json` version. Find where settings reads/stores app version (likely a stale DB `settings` row or hardcoded string instead of reading `package.json` at build/runtime). Make it read the live version so it updates automatically per commit/version bump per `context.md` versioning rules, instead of needing manual settings edits.

---

## Session 4 — Election Filters, Group-Scoped Visibility Toggle

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file. Depends on Session 1's group structure.

On `elections` page, alongside existing All / Active / Upcoming / Ended filter tabs, add a Group Structure filter (dropdown or chip list) that filters elections by which group structure(s) they're scoped to.

On election creation/edit (`admin/elections`), add a toggle: "Visible to non-eligible groups". Behavior:
- Off (default): only selected group structure(s) can see AND vote on the election.
- On: everyone can see the election, but only the selected eligible group structure(s) can actually vote — non-eligible viewers see it read-only with an indicator they're not eligible to vote.

---

## Session 5 — Election Deadline Notifications + Penalty System

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file.

On dashboard, show notification cards for active elections the user is eligible to vote in:
- 7 days before election end: "You have N days to vote on {Election Name}."
- 3 days before end: escalate to a warning card "FAILURE TO COMPLY WILL LEAD TO PENALTY" — only shown if the election has "Warn non-voters" toggled on at creation (add this toggle to election creation form, `admin/elections`).

Add penalty system:
- On admin user management (`admin/users`), add a "Timeout" action: admin selects N days, sets `timeout_until` on user.
- While timed out, user cannot create posts or participate in elections (block at API level in feed post creation + vote casting endpoints, not just UI).

---

## Session 6 — Feed/Posting Overhaul

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file.

Fix and extend feed/posting (`src/app/feed/`, `PostCard.tsx`, composer):
- Posting scope: Public (visible to all) or tied to a specific Election the user is eligible to vote in or is a candidate for (visible only to eligible voters/candidates of that election, with a badge/indicator showing which election the post belongs to).
- Fix inline photo/video paste-drop-inline composer path — currently broken, only the explicit "Add Photo/Video" button path works. Unify both paths to the same upload handler.
- Fix posts with image/video not rendering for other users after posting — check upload flow uses `blob:` local URLs instead of the actual uploaded Vercel Blob URL (seen in raw content: `"content":"blob:https:..."` — this is a bug, the local object URL is being persisted instead of the server URL post-upload).
- Fix "Recent Posts" on a user's profile showing all users' posts instead of just that profile's — filter by `user_id` in the query/component.
- Fix raw post content JSON leaking into the UI (seen literal `[{"id":"...","type":"text",...}]` strings rendering instead of parsed content) — find where post content is rendered without JSON.parse or with a serialization bug and fix the render path.

---

## Session 7 — Admin Layout Fixes + Post Approval Controls

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file.

- Top admin nav: button should read "Admin Dashboard" (check current label in `AdminLayout.tsx`/`Navbar.tsx`).
- Profile menu button: currently below Dashboard button, move to the typical top-right profile-menu position (next to notifications, standard placement), not stacked under Dashboard.
- Admin feed/post settings: add toggle "Require Post Approval" (all posts need admin approval before showing) and toggle "Auto-approve posts" (mutually exclusive with the above — clarify UX so both aren't on simultaneously). Wire into post creation flow: pending posts hidden from feed until approved.

---

## Session 8 — Roles & Permissions + Activity Logs Update

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file. Depends on all prior sessions.

Update Roles & Permissions (`admin/roles`) to include new permission scopes for:
- Group structure management (add/remove/edit group structures)
- Verification field-level denial/review
- Election visibility toggle + warning toggle management
- User timeout/penalty action
- Post approval toggle + approving/rejecting posts

Update Activity Logs (`admin/logs`) to record new event types: group structure created/removed, verification denied with flagged fields, reverification submitted, election visibility toggle changed, user timed out (by whom, duration), post approved/rejected, settings changed (what changed, by whom).

Update `context.md` Roles table and `handoff.md` if `context.md` changes are explicitly requested by the user at that time — otherwise leave `context.md` alone per existing rule.

---

## Session 9 — Post-Launch QA Fix Pass (fix/qa-pass-v1.8)

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file. This is a fix branch, not a feature branch — `fix/qa-pass-v1.8`.

A full QA sweep across all 8 prior sessions found the following. Fix in priority order, verify each with `npx tsc --noEmit && npm run build` after, don't batch-fix blind:

**Blockers:**
1. New granular permission scopes (`reviewVerificationFields`, `manageElectionVisibility`, `manageUserPenalties`, `managePostApproval` — set in `admin/roles/page.tsx`) are saved to `permissions` JSON but never read by any API route. Routes gate on blanket `isAdmin(role)` instead: `src/app/api/verifications/[id]/route.ts:14`, `src/app/api/elections/[id]/route.ts:201,427`, `src/app/api/users/[id]/route.ts:180`, `src/app/api/posts/[id]/route.ts:13`. Add `JSON.parse(role.permissions)[scopeName]` checks to each.
2. `src/app/api/elections/[id]/route.ts` GET (~122-187) doesn't gate on `eligible`/`visible_to_all` — a non-eligible, non-visible-to-all user can fetch full election detail (positions, candidates, bios) directly by ID, bypassing the list endpoint's hiding. Add the same eligibility/visibility check the list endpoint uses; 404 if neither admin, eligible, nor visible_to_all.
3. `src/app/api/upload/route.ts:89-160` — legacy default/`purpose=id` branch predates the reverification refactor, writes legacy `users.grade_level`/`section`, does `INSERT OR REPLACE INTO verification_requests` bypassing `lrn`/`profile_photo_url`/`doc_type`/`denied_fields`. Reachable by any authenticated request, can 409-lock users out of the real verification flow. Delete this branch (or 404 it) — confirm nothing still calls it first.

**Major:**
4. `admin/roles/page.tsx` inline edit state has no unsaved-changes guard (unlike settings/academic pages which correctly use it). Add the same `useUnsavedGuard` hook. Also audit other multi-field admin forms (elections, users, verifications, posts, app-config) for missing guard coverage.
5. `auto_approve_posts` setting is saved but never read in any enforcement path — only `require_post_approval` gates `src/app/api/posts/route.ts` POST. Either wire `auto_approve_posts` into the gating logic properly, or remove it. Also `admin/settings/page.tsx` `handleSaveAll` (~354-379) does sequential non-atomic PATCHes with only client-side mutual-exclusivity — add server-side pair validation in the settings PATCH handler so both can't end up `'true'` in DB.

**Minor (fix what's cheap, note the rest in handoff.md if skipped):**
6. `src/app/api/elections/[id]/route.ts` PATCH (~315-330): when `is_global=1` sent without `visible_to_all`, stale `visible_to_all` value persists silently. Clear/normalize it when `is_global` flips.
7. Same PATCH: eligibility rules aren't cleared when `is_global` flips to `1` unless `eligibility` explicitly sent — stale rules can reappear later. Clear them on the `is_global=1` path.
8. Election GET returns raw `eligibility` rules to any authenticated viewer, including visible-to-all-only viewers who aren't eligible. Make eligibility rules admin-only in the response.
9. `getVisibleElectionIds` (`src/app/api/posts/route.ts:11-56`) ignores `visible_to_all` — posts for a scoped-but-visible-to-all election stay invisible to non-eligible viewers even though the election page itself is visible to them. Decide product intent (likely: election-scoped posts should follow the same visible_to_all rule) and align.
10. `src/components/AdminLayout.tsx:73-76` pending-posts badge counts `res.data.posts.length` from a paginated (limit 20) call — undercounts past 20. Have `/api/posts?status=pending` return a `total`, use that for the badge (like verifications does).
11. Legacy dead columns still read/written but inert: `src/app/api/verifications/route.ts:66-68` selects always-NULL `u.grade_level`/`u.section`; `candidates.grade_level`/`subtype`/`section` (+`_id` variants) still written/read across `src/app/api/elections/route.ts:142-143`, `[id]/route.ts:76-77,139-140`, `candidates/[candidateId]/route.ts:12`, `CandidateManager.tsx`. Confirm UI doesn't present these as authoritative; drop the dead columns/reads in a follow-up migration if truly unused.
12. Design-system color inconsistency — three different pending/warning color pairs, none matching the documented `text-amber-700 bg-amber-50 border-amber-200` standard: `src/components/ui/Badge.tsx:13` (`warning` variant, yellow-100/yellow-700, no border), `src/components/PostCard.tsx:195-196` (amber-100 not amber-50, no border), `src/components/ui/ConfirmDialog.tsx:33` (yellow-50). `src/components/Layout.tsx:93,103,116` banners are correct — use as reference and align all three.

Update `handoff.md` with what was fixed vs. deliberately deferred (with reason) before merging `fix/qa-pass-v1.8` into `master`.

---

## Session 10 (Experimental) — Client-Side Face Verification (feat/face-verification-client)

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file. Branch: `feat/face-verification-client`. This is experimental/exploratory — keep it isolated, don't touch the existing verification approval flow's data model beyond what's needed to record a face-match result.

Goal: face verification on registration and login, done entirely client-side ("Full-Control Way") using a browser face-detection library (`face-api.js` or Google MediaPipe Face Landmarker/Face Detector) running in the user's browser — no server-side face compute, so it doesn't touch Vercel's server function limits.

Scope:
- Host model weights as static files (e.g. `public/models/`) — pick `face-api.js` (tiny/ssd_mobilenetv1 + landmark + recognition models) or MediaPipe Tasks Vision (`face_landmarker.task` / `face_detector.tflite`), whichever has better bundle size / accuracy tradeoff for this use case; note the choice and why in `handoff.md`.
- On registration (Session 2's profile-photo-upload step): run live face detection in-browser before allowing photo submission — reject non-face images at the client (blurry/no-face/multiple-faces), compute and store a face descriptor/embedding (float array) alongside the uploaded photo, tied to the user record.
- On login: capture a live webcam frame, compute its descriptor client-side, compare (Euclidean distance / cosine similarity) against the stored registration descriptor client-side, and only pass a "face verified" flag/token to the server alongside normal credential login — server never receives raw face data or does the comparison, just trusts the client-computed match result plus normal password auth (treat this as an additive factor, not a replacement for password auth).
- Handle browsers without webcam/camera permission gracefully — fall back to normal login without face step, don't hard-block.
- This is an experiment: don't wire it into the main registration/login flow behind a feature flag that's off by default (add a settings toggle, e.g. `enable_face_verification`, defaulting off) until it's been tested.
- Note performance/model-load-time observations and false-accept/false-reject behavior you observe in manual testing, in `handoff.md`, since this is the main open question for whether it ships for real.

Do not merge this into `master` without explicit confirmation — this is a test branch, flag it as such in the PR/merge message and leave it for review rather than auto-merging like the other sessions.

---

## Session 11 — Performance Pass (fix/perf-pass)

Read `handoff.md` and `context.md` fully first, and follow "Rules for every session" at top of this file. Branch: `fix/perf-pass`.

App is unbearably slow on page/data loads. Confirmed contributing factors to fix, in priority order — measure before/after each with actual load timing (Network tab / server logs), don't guess-fix:

1. **All 59 API routes are `force-dynamic` with zero query-level caching** — every request re-hits Turso cold, even for near-static data (settings, group structures, role list, election list). Add in-memory or `unstable_cache`/short-TTL caching for read-heavy, low-churn endpoints (`/api/settings`, `/api/groups`, `/api/admin/roles`, election list GET), invalidate on write. Don't touch `force-dynamic` itself (required for env vars per `context.md`) — cache at the data-fetch layer instead.
2. **All images use plain `<img>` tags, not `next/image`** (confirmed across `PostCard.tsx`, `CandidateManager.tsx`, `elections/[id]/page.tsx`, `verify-id/page.tsx`, `admin/users/page.tsx`, `register/page.tsx`, `profile/page.tsx`, etc.) — no lazy loading, no responsive sizing, no automatic compression/format negotiation (WebP/AVIF). Migrate to `next/image` with explicit `width`/`height` or `fill`, and configure `next.config.js` `images.remotePatterns` for the Vercel Blob domain. This alone is likely the biggest visible win for feed/profile/candidate photo-heavy pages.
3. **N+1 / unbatched queries** — audit `src/lib/db.ts` and API routes for per-row queries inside loops (e.g. candidate group lookups, election eligibility checks, post author lookups). Batch into single JOINs or `IN (...)` queries where found.
4. **Turso client cold-start** — `db.ts`'s lazy Proxy pattern is required (don't revert it), but check if connection is being re-established per-request instead of reused across the request lifecycle/edge runtime instance. Confirm libsql client reuse is correct per Next.js docs for the deployment target.
5. **Waterfall fetches on page load** — check dashboard, feed, elections list, profile pages for sequential `await fetch` chains that could run in parallel (`Promise.all`) instead — e.g. user data + settings + election list + notifications all fetched one after another instead of concurrently.
6. **Bundle size** — run `npm run build` and check the route JS sizes reported; identify any page pulling in heavy unused deps (check `admin/*` pages aren't bundling admin-only libs into shared chunks).
7. **Missing loading states causing perceived slowness** — verify pages show skeleton/spinner immediately rather than blank screen during fetch (React Suspense boundaries or loading.tsx per route where missing).

Report actual before/after load-time numbers (even rough, from Network tab or `console.time`) in `handoff.md` for the pages fixed, not just "fixed it."

### Part 2 (same branch or split to `feat/supabase-migration` — decide after scoping) — Turso → Supabase Postgres Migration

Supabase is already connected to this Vercel project via the Vercel integration. Env vars are available in Vercel (`POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_USER`, `POSTGRES_HOST`, `POSTGRES_PASSWORD`, `POSTGRES_DATABASE`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`, `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`). Pull them locally first: `npx vercel login && npx vercel link && npx vercel env pull .env.local` — don't ask the user to paste secrets into chat.

Migrate `src/lib/db.ts` and all query call sites from Turso/libsql (SQLite dialect) to Supabase Postgres, without breaking anything:

1. **Schema translation**: dump current Turso schema (`sqlite3`-style `CREATE TABLE` statements across all tables — users, elections, positions, candidates, posts, verification_requests, groups/group_values, roles, activity_logs, settings, etc.). Translate SQLite types/constraints to Postgres equivalents (`INTEGER PRIMARY KEY AUTOINCREMENT` → `SERIAL`/`BIGSERIAL` or `GENERATED ALWAYS AS IDENTITY`, `TEXT` timestamps → `TIMESTAMPTZ` where actually used as dates, boolean-as-integer columns → real `BOOLEAN` or keep as integer if changing risks breaking comparisons elsewhere — audit call sites either way). Write this as a versioned SQL migration file, don't hand-edit Supabase via dashboard only.
2. **Client swap**: replace `@libsql/client` with Supabase's Postgres client (`@supabase/supabase-js` for the REST/RPC layer, or `pg`/`postgres.js` directly against `POSTGRES_URL` if raw SQL access is preferred — pick whichever requires the least query-syntax rewrite given `db.ts` currently does raw SQL, not an ORM). Keep the same lazy-init Proxy pattern `db.ts` currently uses (`context.md` says don't make it eager) if it still makes sense under the new client — otherwise document why it changed.
3. **Query syntax audit**: SQLite and Postgres differ on: parameter placeholders (`?` vs `$1, $2...`), `INSERT OR REPLACE` (no Postgres equivalent — needs `ON CONFLICT ... DO UPDATE`), `datetime('now')`/SQLite date functions (→ `NOW()`/Postgres date functions), `LIKE` case sensitivity (Postgres `LIKE` is case-sensitive by default, SQLite isn't — decide `ILIKE` where needed), auto-increment behavior, `PRAGMA` usage if any. Grep every raw query in the codebase for these patterns and fix one by one — don't do a blind find-replace.
4. **Data migration**: write a one-time script to export all rows from the live Turso DB and import into Supabase, preserving IDs/foreign keys/relationships exactly (critical: don't break existing users' elections/votes/verification history). Run against a copy/staging Supabase project first if possible, verify row counts and spot-check foreign key integrity before touching production data.
5. **Env var swap**: update `.env.local` and Vercel project env to use the Supabase vars instead of `TURSO_DATABASE_URL`/`TURSO_AUTH_TOKEN` once migration is verified — don't remove Turso env vars until Supabase is confirmed fully working in production for at least one full deploy cycle.
6. **Full regression pass after migration**: every feature from Sessions 1-10 touches the DB — group structures, verification/reverification, elections/voting, timeouts, posts/feed, roles/permissions, activity logs. Re-run the QA checklist from Session 9 against Postgres, not just `npx tsc --noEmit && npm run build` (those won't catch runtime SQL syntax errors). Manually exercise each major flow (register → verify → vote → post → admin actions) against the migrated DB before merging.
7. Update `context.md`'s Tech Stack table (Database row) and Required Env Vars section, and `handoff.md`, once migration is confirmed stable — this is one of the few cases where `context.md` should change, since the DB layer is core documented architecture.

Do this migration on its own branch, merge only after explicit confirmation from the user that production data migrated correctly — same non-auto-merge caution as the face-verification experiment.

---

# Post-Supabase Cutover: Stabilize, Speed, Polish (Sessions 12–16)

All the "Rules for every session" at the top of this file apply. Do **Session 12 first** — it unblocks the rest (a 10s-loading, redirect-looping app can't be QA'd). 13 and 14 are independent. Do 15 before 16 so the group-editor redesign is built on a fixed theme.

---

## Session 12 — Post-Cutover Stability: Redirect Loop, Cold-Start Slowness, DB Pooling (`fix/postgres-stability`)

Read `handoff.md` and `context.md` fully first. DB is now Supabase Postgres (v2.0.0). Three confirmed prod problems: (A) logged-in users hit an **infinite load / redirect loop** that only clears by deleting cookies; (B) **every page + data load is ~10s slow**; (C) general "is everything actually working" doubt after the Turso→Supabase cutover. Measure before/after with real timing (Network tab / `npx vercel logs <alias>`), don't guess-fix.

**1. Cold-start killer — `ensureInit()` runs full DDL on every request.** `src/lib/db.ts` `ensureInit()` (`_init`, ~199-577) runs 27 `CREATE TABLE IF NOT EXISTS` + ~55 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` + settings/role seeds + **2 `bcrypt.hash` calls** + several SELECTs. It's `await`ed at the top of **66 route files** (grep `ensureInit`). `initPromise` only memoizes within a single warm lambda — every cold serverless instance (frequent on Vercel) pays the entire schema-DDL + bcrypt round-trip cost against the Supabase **session pooler** before the route does any work. Primary source of the 10s loads.
   - Gate the whole init behind a one-time check: `SELECT value FROM settings WHERE key='schema_version'` — if present and current, return immediately without running any DDL/seed. Only run the CREATE/ALTER/seed block on a fresh/older schema, then stamp `schema_version`. Keep it lazy (do NOT eager-init at import — `context.md` rule).
   - Move the DDL out of the request hot path entirely if feasible: expose it as a one-off migration script (like `scripts/migrate-*`) run manually, routes only ensure a cheap readiness flag. Document the chosen approach in `handoff.md`.
   - Do NOT remove `force-dynamic` (required for runtime env per `context.md`).

**2. Redirect loop / infinite load.** `src/middleware.ts` `hasValidSession()` only base64-decodes the JWT payload and checks `exp` + shape — it does **not verify the signature**, while server layouts + `/api/auth/me` (`getAuthUser`, `src/lib/auth.ts`) do full `jose` verification. A token that parses but fails signature verification (or a user row that no longer matches) makes middleware keep redirecting `/` → `/dashboard` (thinks logged-in) while `/api/auth/me` returns 401 and `AuthProvider` (`src/components/providers/AuthProvider.tsx`) sets `user=null` → client bounces back to `/` → middleware bounces to `/dashboard` = infinite loop; only clearing the cookie escapes. Fix:
   - When `/api/auth/me` returns 401 (or any auth endpoint rejects), **clear the `auth-token` cookie** server-side (expire it) so the stale token can't re-trigger the loop. Add a client guard in `AuthProvider`/dashboard layout: if `me` 401s, hard-redirect to `/` once and stop.
   - Make middleware and server verification agree on "logged in": verify the signature in middleware too (jose works in Edge) so a bad token is treated as logged-out and the cookie cleared.
   - Confirm `AuthProvider` never leaves `loading=true` forever if `fetchMe` hangs (add a timeout/abort).

**3. Postgres pool tuning.** `src/lib/db.ts` `getPool()` uses `new Pool({ ...cfg, ssl:{rejectUnauthorized:false}, max:5 })`. On Supabase session pooler + serverless verify: connection reuse across lambda lifetime (`_pool` singleton — keep), add `keepAlive:true`, sane `connectionTimeoutMillis`/`idleTimeoutMillis`, and a `statement_timeout` so a hung query fails fast instead of hanging the page 10s. Confirm `APP_DATABASE_URL` points at the session-pooler URL (port 5432, `context.md` cutover notes) and `max:5` isn't starving concurrency — tune with measured evidence.

**4. Post-cutover correctness sweep.** The `translate()` shim (`db.ts` ~40-99) rewrites SQL per-statement (`?`→`$n`, `LIKE`→`ILIKE`, `datetime('now')`, `INSERT OR IGNORE/REPLACE`→`ON CONFLICT`). Runtime SQL-dialect bugs don't surface in `tsc`/`build`. Exercise each major flow against prod Postgres and fix any broken query: **register → OTP → verify-id → login → dashboard → vote → post (feed) → comment/react → admin (users, verifications, elections, roles, logs, group structure)**. Watch: `RETURNING id`/`lastInsertRowid` paths, the blanket `LIKE`→`ILIKE` replace (could corrupt a `LIKE` inside a string literal — audit), `ON CONFLICT` upserts, BIGINT→Number parsing. Report what you tested + found in `handoff.md`.

Report real before/after load numbers for dashboard + one data-heavy page in `handoff.md`.

---

## Session 13 — Activity-Log & Role/Permission Coverage Audit (`fix/gating-audit`)

Read `handoff.md` and `context.md` fully first. Depends on Session 12 (stable DB). Two audits, mechanical and evidence-based — produce a coverage table in `handoff.md`, then fix gaps.

**1. Activity-log coverage.** `logActivity` lives in `src/lib/logger.ts`; log types badged in `src/app/admin/logs/page.tsx` (`ACTION_BADGE`). Grep every state-mutating API route (POST/PATCH/PUT/DELETE under `src/app/api/`) and confirm each meaningful action writes a log entry. Already-logged (Sessions 8-9): group structure/value created+deleted, verification submitted/reverified/approved/denied, election visibility changed, user timeout, post approved/rejected, settings changed. **Find the gaps** — likely-missing: login/logout, failed login, password change/reset, user create/role change, election create/update/delete, vote cast, candidate add/remove, post created/deleted, comment created/deleted, report filed/resolved, verifier assigned/removed, face enroll/report. For each real gap add a `logActivity` call (actor id + target + human message) and an `ACTION_BADGE` entry for any new action type. Don't over-log read-only GETs.

**2. Role/permission gating.** `hasPermission(role, scope)` in `src/lib/permissions.ts`; `isAdmin` (level ≥ 2) in `src/lib/auth.ts`. Scopes seeded in `db.ts` role seeds + backfill (`manageUsers`, `manageElections`, `manageSettings`, `manageRoles`, `viewReports`, `verifyMembers`, `managePosts`, `reviewVerificationFields`, `manageElectionVisibility`, `manageUserPenalties`, `managePostApproval`, `manageAcademic`). Grep every admin/mutating route and confirm it gates on **both** `isAdmin` AND the correct `hasPermission` scope — not blanket `isAdmin` alone (Session 9 fixed only 4 routes; re-verify none regressed in the Postgres cutover, find any route added since that only checks `isAdmin` or nothing). Produce a route → required-scope → actual-check table; fix each mismatch. Confirm unverified users (`id_verified=0`) stay read-only at the API level (post/react/comment/vote all 403), not just UI-gated.

Update `handoff.md` with both coverage tables (what was already correct vs. what you added).

---

## Session 14 — Feed & Profile Post Display Fixes (`fix/post-display`)

Read `handoff.md` and `context.md` fully first.

**1. Embeds render as `[embed]` / posts not shown fully.** On a user profile's Recent Posts, post content is collapsed to a plain-text excerpt via `postExcerpt()` (media-only posts become literal `[image]`/`[video]`/`[embed]` — see `src/app/users/[id]/page.tsx`, Session 6 notes). Requirement: profile posts should render the **actual post** (use the real `PostCard`/`renderContent` from `src/components/PostCard.tsx:47-72`, which already turns YouTube/TikTok/Drive/image/video/link embeds into real iframes/media), not an `[embed]` placeholder string. If a compact card is wanted, still render real media + a clear **"View post"/permalink link**.

**2. Link to the actual post.** Posts need a canonical permalink. `PostCard` share copies `/feed#post-${id}` (`handleShare`, ~166) but there's no route that deep-links/scrolls to a single post reliably, and profile posts don't link out at all. Add a working permalink (anchor scroll on `/feed`, or a dedicated post view) and make every post (feed header timestamp + profile posts) link to it.

**3. Profile picture clipped / wrong aspect ratio.** Avatars must be square, centered, cover-cropped — never original aspect ratio stretched/clipped. `PostCard` avatars use `relative w-10 h-10 ... overflow-hidden` + `<Image fill className="object-cover" />` (correct pattern, ~178-188) — replicate that exact pattern everywhere an avatar renders. Audit and fix any avatar not `object-cover` inside a fixed-size `overflow-hidden` round container: profile page header (`src/app/profile/page.tsx`, `src/app/users/[id]/page.tsx`), Navbar dropdown, admin user lists, verifier panel, comments. Uploaded profile photo also center-cropped to square on display.

QA the feed + a profile with image/video/embed posts visually before merging.

---

## Session 15 — UI/UX & Contrast Overhaul (`fix/ui-contrast`)

Read `handoff.md` and `context.md` fully first. `context.md` §Design System defines the palette + readability rule ("Dark text on dark bg = broken. Light text on light bg = broken").

**1. Fix invisible text (white-on-white / low-contrast).** Confirmed unreadable spots (white text on white/near-white). Sweep every page + component for text whose color ≈ its background. Structural cause: **admin pages assume a dark theme** (Group Structure uses `text-white`, `bg-gray-900`, `text-gray-300` — `src/app/admin/academic/page.tsx`) while the app shell/header is light (`bg-white`) — so an admin heading `text-white` lands on a white bar and vanishes (the user's screenshot: white "Group Structure" title on white). Decide one coherent theme per surface (admin vs. user) and make every text/background pair meet WCAG AA. Fix the theme mismatch so it can't recur — don't spot-patch one label.

**2. Overall design/UX polish.** Tighten spacing, hierarchy, empty states, loading states, consistency across pages using the `context.md` palette (`#84050C` primary, `#6B0409` hover, `#FEE2E2` tint, amber/red/green status pairs). Consistent card/button/input/badge styling (reuse `src/components/ui/*`). No new dependencies. Clean and legible over decorative.

Before committing verify **every** text-background pair is readable in the actual rendered pages (`context.md` hard rule). List specific contrast fixes in `handoff.md`.

---

## Session 16 — Group Structure Editor Redesign (`feat/group-structure-ux`)

Read `handoff.md` and `context.md` fully first. Depends on Session 15 (contrast/theme) landing first.

Current Group Structure admin (`src/app/admin/academic/page.tsx`) is janky: parent and child structures sit as sibling tabs (`Strand`, `Section`, etc. all in one flat tab row, ~342-355), and managing leveled values means manually picking a structure tab, then a parent-value dropdown, then editing chips — the hierarchy is invisible and the flow is tedious. Redesign into something a non-technical admin understands at a glance, **without changing the underlying data model** (`group_structures.parent_structure_id`, `group_values.parent_value_id`) or its APIs.

Requirements:
- **Show the hierarchy as a hierarchy** — a tree / nested drill-down where a child structure (e.g. Section) is visually nested *under* its parent (Strand → its values → their child values), not a sibling tab beside its own parent.
- **Fluid drill-down**: click a parent value to expand and manage its child values inline, breadcrumb showing location (e.g. `Strand: STEM › Sections`), instead of the current "select structure tab, then select parent value in a separate dropdown" two-step.
- Keep all existing capability: add/rename/activate-deactivate/delete values (incl. force-delete-with-users 409 flow, ~201-225), respect required/optional + leveled/standalone structures, and the **Verifier assignment panel** (keep its function; restyle to match the new layout + Session 15 theme).
- Never hardcode structure names — everything reads from live structures / `group_label_l1/l2/l3` (`context.md` rule).
- Loading states must not read as broken (screenshot shows "Loading structures…"/"Loading…" stuck-looking on a dark card — real skeletons, ensure fetch resolves post-Session-12).

Don't alter the group-structure **API routes** or DB schema; front-end/UX redesign over the existing endpoints. QA the full add/rename/delete/verifier flow before merging.
