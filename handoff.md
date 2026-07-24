# Handoff — Last Session Summary

> Overwrite this file at the end of every session. Future sessions read this for context.

---

## Session Date
2026-07-24

## Version After This Session
`1.9.1` — FIX: performance pass (`fix/perf-pass`), Part 1 only. **On branch, NOT merged — image pages need manual visual QA before merge (below). Part 2 (Supabase migration) deferred to a separate branch.**

Prev: `1.9.0` — MINOR (EXPERIMENTAL): client-side face verification (`feat/face-verification-client`), MERGED via PR #9.

---

## What Was Done (Session 11 — Performance Pass Part 1, v1.9.1, `fix/perf-pass`, UNMERGED)

Baseline vs after measured via `npm run build` route sizes. Live network timing NOT measurable in this headless env — needs Network-tab confirmation on deploy.

**1. Query-layer caching (`src/lib/cache.ts` NEW).** Per-instance in-memory TTL cache (`cached`/`invalidate`/`invalidatePrefix`; `CONFIG_TTL=60s`). Applied to the three GLOBAL, low-churn reads, each invalidated on write:
- `/api/settings` GET (invalidate in PATCH).
- `/api/groups` GET (structure tree; `invalidateGroupsCache()` added to `groups.ts`, called from all 4 admin/groups write routes).
- `/api/admin/roles` GET (invalidate in roles POST + `[id]` PATCH/DELETE).
- **NOT cached: `/api/elections` list GET** — per-user (`hasVoted`/`eligible`) + volatile vote counts; stale data is a correctness bug for a voting app. Its rules already load in one `IN (...)` query + one value-set load (no N+1).
- Per-lambda cache; 60s TTL bounds cross-instance staleness, explicit invalidate keeps the writing instance immediate.

**2. `next/image` migration (ALL 33 raw `<img>`).** Patterns: `fill` (parents given `relative` where missing), fixed `width`/`height` (avatars/thumbnails), `width=0 height=0 sizes="100vw"`+auto style (unknown-aspect post media/lightbox); `unoptimized` on blob-preview srcs. Page-specific JS dropped (dashboard 5.42→3.52 kB, elections 5.96→4.13); First Load +~5 kB shared (next/image runtime) — net win is image bytes/format (WebP/AVIF) + lazy-load at request time.
- **⚠ NEEDS MANUAL VISUAL QA (unverifiable headless):**
  - `elections/[id]/page.tsx` banner (~:866): real class `max-h-48` → wrapped `relative w-full h-48`; confirm height.
  - `PostEditor.tsx:172` + `PostCard.tsx:50,60` post media: NO `unoptimized` (assumed remote Blob URL). If a live local-object-URL preview shows right after upload it may not render — check.
  - All `fill` conversions need `position: relative` parents; added where missing but eyeball every avatar/photo page once.

**3. N+1 fix.** Elections list GET pre-flight: per-election `checkAutoTransition()` loop → two bulk `UPDATE`s (auto-start w/ position+candidate guards via correlated subqueries; auto-end), identical semantics, kills a hot-path N+1. `checkAutoTransition` still used for single-election create POST. **Deferred (write-path, FK-sequential, low-value):** election create/update nested INSERT loops, eligibility-rule inserts, `setUserAssignments`, verify-upload, admin/verifiers lookup.

**4. Turso client reuse — already correct.** `db.ts` singleton `_db` reused; `ensureInit` memoized. No change (context.md do-not-touch).

**5. Waterfalls.** Only fix: dashboard fires elections + admin-stats concurrently (were sequential). Elections/profile already parallel; login/profile-modal cascades genuinely dependent.

**6. Bundle — already lean.** First Load 92–120 kB; face-api correctly lazy-loaded; no admin dep leak. No action.

**7. Loading states — already present.** Skeletons/spinners on dashboard/feed/elections/profile; login form renders immediately. No action.

**Branch commits:** (a) cache + dashboard parallel fetch; (b) next/image + bulk auto-transition + version bump.

**Part 2 (Turso → Supabase Postgres) NOT DONE — deferred to `feat/supabase-migration`.** `.env.local` already has Supabase + Postgres vars pulled from Vercel production. Turso still live.

**Supabase MCP connected.** Project-scoped `.mcp.json` (committed) adds an HTTP MCP server `supabase` (project `ulnxmakclnwbjdhutjci`; features: docs/account/database/debugging/development/functions/branching/storage). Auth is per-user OAuth — each dev runs `/mcp` in an interactive terminal, selects `supabase`, Authenticate (see `context.md` → MCP Servers). Useful for Part 2. Optional: `npx skills add supabase/agent-skills`.

**Merge note:** perf pass was rebased onto the latest `origin/master` (which gained PR #10 face fixes after this session started) and pushed as `7b7a46c`. QA re-run green on the combined tree.

---

### (historical) Prev version header
`1.8.1` — FIX: post-launch QA fix pass (`fix/qa-pass-v1.8`). See "Session 9" below.

Prev: `1.8.0` — MINOR: Roles & Permissions gains 4 new granular scopes; Activity Logs records + badges new event types (election visibility changes, settings changes, reverification). New log actions `election_visibility_changed`, `settings_changed`, `verification_reverified`.

Prev: `1.7.0` — MINOR: Admin layout tweaks (top pill "Admin Dashboard") + post approval workflow. New `posts.status` column, `require_post_approval`/`auto_approve_posts` settings, `/admin/posts` moderation page, `PATCH /api/posts/[id]`.

Prev: `1.6.0` — MINOR: Feed/posting overhaul — election-scoped post visibility, unified media upload (button + plus-menu + paste + drop), blob-URL persistence bug fixed, profile Recent Posts filtered + JSON-leak fixed.

Prev: `1.5.0` — MINOR: Election deadline reminders on dashboard + user timeout/penalty system. New columns `elections.warn_non_voters`, `users.timeout_until`.

Prev: `1.4.3` — FIX: election filter is now multi-select (checkboxes, OR semantics across chosen scopes). Button shows count badge + Clear. `groupFilters: Set<'v:id'|'s:id'>`; popover stays open on toggle.

Prev: `1.4.2` — FIX: election filter is now a "Filter" popover button (funnel icon) with expandable per-structure categories (accordion) instead of a native select. Leveled values grouped under parent context header + parent-prefixed selected label (e.g. "STEM · A") so repeated child names (Section A/B/C) read clearly. Active filter shown as chip with clear (×).

Prev: `1.4.1` — FIX: election group filter now drills into group *values* (optgroups per structure), not just structure names. List API returns `value_ids` per election; filter matches `v:<valueId>` or structure-wide `s:<structureId>`.

Prev: `1.4.0` — MINOR: Election group-structure filter on elections page + "Visible to non-eligible groups" toggle (read-only visibility with server-side vote gate). Adds `elections.visible_to_all` column.

Prev: `1.3.0` — MINOR: Settings Save bar (staged changes applied on Save) + unsaved-changes guard; confirmed App Version reads live from package.json

Prev: `1.2.2` — FIX: eligibility builder groups leveled values under their parent value (repeated child names like Section A/B/C now shown under each Strand caption)

Prev: `1.2.1` — FIX: election eligibility builder now cascades (leveled group values show only when a parent value is selected; stale rules from deselected parents dropped)

---

## What Was Done (Session 9 — Post-Launch QA Fix Pass, v1.8.1)

**New:** `src/lib/permissions.ts` — `hasPermission(role, scope)`: master_admin always true; else reads `roles.permissions` JSON and returns `!!perms[scope]` (deny on any error). db.ts backfills the 4 Session-8 scopes on system roles via `json_insert` (admin gets all 4; moderator gets reviewVerificationFields + managePostApproval) so existing `{}`-seeded DBs keep current access; `json_insert` never overwrites a later master_admin edit.

Fixed (priority order):
1. **Granular scopes now enforced.** `reviewVerificationFields` → `verifications/[id]` PATCH; `managePostApproval` → `posts/[id]` PATCH; `manageUserPenalties` → the `timeout_days` branch in `users/[id]` PATCH; `manageElectionVisibility` → `elections/[id]` PATCH + DELETE. Each gates on `isAdmin` AND `hasPermission`.
2. **Election detail GET eligibility gate.** `GET /api/elections/[id]` now 404s when viewer is not admin, not eligible, and election is not `visible_to_all` — closes direct-by-ID bypass of list hiding.
3. **Upload legacy branch removed.** Deleted the default/`purpose=id` branch in `api/upload` (+ unused `ID_TYPES`); it bypassed the reverification flow and could 409-lock users. Confirmed no caller (verify-id/register post to `/api/verifications`). Unknown purpose now 400s.
4. **Roles page unsaved-guard.** `admin/roles` now uses `useUnsavedGuard` (dirty on inline edit or typed-but-unsaved new role). Audit: elections/users/verifications edits are modal-based (state discarded on close) and posts page has no staged form — no route-level guard needed; academic/settings/roles are the only page-level staged editors, all now guarded.
5. **auto_approve_posts wired + atomic pair.** POST gate now: pending only when `require_post_approval && !auto_approve_posts && !admin`. Settings PATCH enforces mutual exclusivity server-side (setting one 'true' writes the other 'false' in one batch) so non-atomic client saves can't leave both 'true'.
6. **is_global→global normalizes visible_to_all** even when caller omits it (no stale `visible_to_all=1`).
7. **is_global flip to global clears eligibility rules** even when `eligibility` not resent.
8. **Eligibility rules admin-only** in election GET response (`eligibility: admin ? rules : []`).
9. **getVisibleElectionIds honors visible_to_all** — posts for visible-to-all elections now visible to non-eligible viewers, matching election-page visibility.
10. **Pending-posts badge total.** `GET /api/posts?status=…` (admin) returns unpaginated `total`; AdminLayout badge uses it (no longer capped at 20).
12. **Warning color standardized** to `text-amber-700 bg-amber-50 border-amber-200`: `Badge.tsx` warning variant, `PostCard.tsx` pending pill, `ConfirmDialog.tsx` non-destructive icon.

**Deferred:**
- **11. Legacy dead columns** (`users.grade_level`/`section`, `candidates.grade_level`/`subtype`/`section` + `_id` variants) — still read/written inert. Dropping needs a DB migration + confirming UI doesn't present them as authoritative; left as a follow-up migration to keep this a low-risk fix pass.

---

## What Was Done (Session 8 — Roles & Permissions + Activity Logs)

- **Roles (`admin/roles`)**: added 4 new permission scopes to `PERMISSION_KEYS` + `PERM_LABELS`: `reviewVerificationFields` (Review / Deny Verification Fields), `manageElectionVisibility` (Manage Election Visibility & Warnings), `manageUserPenalties` (Timeout / Penalize Users), `managePostApproval` (Approve / Reject Posts). Group-structure management continues to map to existing `manageAcademic`. Roles API stores permissions as free-form JSON — new keys pass through, no server whitelist change needed.
- **New log events wired into code**:
  - `election_visibility_changed` — `PATCH /api/elections/[id]` now logs when `visible_to_all` or `warn_non_voters` toggle actually changes (compares against prior row; message names which toggle + ON/OFF). Added `logActivity` import.
  - `settings_changed` — `PATCH /api/settings` logs old value → new value for the changed key (only when value differs). Added `logActivity` import.
  - `verification_reverified` — `POST /api/verifications` distinguishes reverification (prior `denied_fields` present) from first submit; logs fixed fields.
  - Already-logged events reused as-is: `group_structure_created/deleted`, `group_value_created/deleted`, `verification_approved/rejected` (rejected already includes flagged fields), `user_timeout`, `post_approved/rejected`.
- **Logs page (`admin/logs`)**: added `ACTION_BADGE` entries (colored pills) for all new + previously-raw event types: group structure/value created+removed, verification submitted/reverified/approved/denied, election visibility changed, user timed out, post approved/rejected, settings changed.
- context.md left unchanged (no explicit request; role hierarchy table unaffected — additions are permission scopes, not roles).

---

## What Was Done (Session 7 — Admin Layout + Post Approval)

- **Layout**: Navbar top admin pill relabeled `Admin` → `Admin Dashboard`. Profile menu already top-right (avatar dropdown in `Navbar`, used by both `Layout` and `AdminLayout`) — no move needed. Added `Post Approvals` item to `AdminLayout` sidebar (`/admin/posts`) with pending-count badge.
- **DB (`db.ts`)**: `posts.status TEXT NOT NULL DEFAULT 'approved'` (additive). Seeded settings `require_post_approval='false'`, `auto_approve_posts='true'`.
- **Settings (`admin/settings`)**: new "Feed & Posting" card with two mutually-exclusive toggles (turning one on forces the other off, enforced in `toggleRequireApproval`/`toggleAutoApprove`). Persisted via staged Save bar. `/api/settings` ALLOWED_KEYS extended.
- **Posts API (`api/posts`)**:
  - POST reads `require_post_approval`; non-admin posts → `status='pending'` (admins auto-approve). Returns `status`.
  - GET approval gate: non-admins see only `status='approved'` OR their own posts. Admins bypass; `?status=pending|approved|rejected` filter for moderation.
  - `PATCH /api/posts/[id]` (admin only): set status approved/rejected, logs `post_approved`/`post_rejected`.
- **Moderation page (`admin/posts/page.tsx`)**: pending/approved/rejected tabs, approve/reject actions, content excerpt.
- **`PostCard`**: shows "Pending approval"/"Rejected" pill when `status !== 'approved'` (author sees own pending in feed).

---

## What Was Done (Session 6 — Feed/Posting Overhaul)

- **Posting scope (`api/posts`)**: new `getVisibleElectionIds(userId, role)` — set of elections a non-admin may see posts for = global + eligible-by-rules (`evaluateEligibility`) + candidate-in (`candidates.user_id`/`student_user_id`). Admins bypass (null).
  - **GET**: main feed = `is_public = 1 OR election_id IN (visible)`. `electionId` filter gated (non-eligible get empty). `userId`/legacy `author_id` filter applies same visibility. Admin sees all.
  - **POST**: election-scoped post validates author is eligible/candidate (403 otherwise) + forces `is_public = 0` so only eligible voters/candidates receive it. Badge already rendered via `election_title` in `PostCard`.
- **Media upload unified (`src/lib/uploadMedia.ts` new)**: `uploadPostMedia(file)` → `/api/upload` (purpose `post`) → server Blob URL. Used by ALL composer paths.
  - **Blob-URL bug fixed**: composer bottom Photo/Video buttons (`feed/page.tsx`) previously persisted `URL.createObjectURL()` (`blob:` local URL) — now insert a preview block then swap in the uploaded URL; drop the block on failure.
  - **`PostEditor`**: `uploadFile` uses shared helper + `valueRef` for fresh-state writes; new `appendMediaFiles` + container `onPaste`/`onDragOver`/`onDrop` for inline paste/drop, same upload handler.
  - **Submit guard**: Post disabled/blocked while any block content still `blob:` (upload pending) and while election audience has no election selected.
  - Composer election dropdown lists only `eligible` elections.
- **Profile Recent Posts (`users/[id]/page.tsx`)**: `author_id` filter now honored server-side (was falling through to public feed = all users' posts). Raw post-content JSON no longer leaks — `postExcerpt()` parses blocks to plain-text preview (media-only → `[image]`/`[video]`/`[embed]`).

---

## What Was Done (Session 5 — Deadline Notifications + Penalty System)

- **DB (`db.ts`)**: `elections.warn_non_voters INTEGER NOT NULL DEFAULT 0`, `users.timeout_until TEXT` (additive, idempotent).
- **Dashboard (`dashboard/page.tsx`)**: deadline reminder cards for active elections the user is eligible for + hasn't voted, within 7 days of end. ≤3 days + `warn_non_voters` on → red "FAILURE TO COMPLY WILL LEAD TO PENALTY" card; otherwise amber "You have N days to vote on {title}." card. Uses `eligible`/`hasVoted`/`warn_non_voters` from list API.
- **Election form**: `warn_non_voters` toggle added to `ElectionForm`, EMPTY_FORM, openEdit, handleSave, and rendered as a switch in `ElectionFormModal` (applies to any election, global or scoped).
- **Elections API**: POST + PATCH persist `warn_non_voters` (list route already returns `e.*`).
- **Penalty**: users PATCH accepts `timeout_days` (>0 sets `timeout_until` N days out; 0 clears) — admin only, logs `user_timeout`. GET/list/PATCH selects return `timeout_until`.
- **Timeout UI (`admin/users`)**: "Timeout (Penalty)" section in edit modal — days input + Timeout User / Lift Timeout. `UserRow.timeout_until` added.
- **API-level enforcement**: post creation (`api/posts` POST) and vote casting (`api/elections/[id]/vote` POST) both reject timed-out users with 403 (checks `timeout_until > now`).

---

## What Was Done (Session 4 — Election Filters + Group-Scoped Visibility Toggle)

- **DB (`db.ts`)**: `elections.visible_to_all INTEGER NOT NULL DEFAULT 0` (additive, idempotent).
- **Visibility model**: `is_global` = everyone eligible. Scoped election (`is_global=0`): eligibility rules gate voting. New `visible_to_all` (scoped only): when 1 everyone SEES it read-only but only eligible vote; when 0 only eligible see it. Global forces `visible_to_all=0`.
- **List API (`GET /api/elections`)**: rewrote visibility — loads eligibility rules for all scoped elections, annotates each row with `eligible` (0/1) and `structure_ids` (distinct include-rule structure ids). Non-admin keeps election if `eligible || visible_to_all`. Admin sees all (`eligible=1`).
- **Detail API (`GET /api/elections/[id]`)**: returns `eligible` for the user (admin/global → true, else evaluate rules).
- **Vote API (`POST /api/elections/[id]/vote`)**: NEW server-side eligibility gate — scoped elections reject non-eligible voters with 403 (previously unenforced; only list hid them).
- **POST/PATCH**: persist `visible_to_all` (coerced to 0 when global).
- **`elections/page.tsx`**: group-structure `<select>` filter next to All/Active/Upcoming/Ended tabs (only lists structures used by visible elections). Cards show "View only — not eligible" for non-eligible (`canVote` gate).
- **`elections/[id]/page.tsx`**: `canVote` gates voting view; read-only gray banner + candidate preview (`UpcomingView hideOpensBanner`) for non-eligible active viewers.
- **`ElectionFormModal` + `admin/elections`**: `visible_to_all` added to `ElectionForm`, EMPTY_FORM, openEdit, handleSave payload; toggle rendered in Eligibility section (shown when !is_global).

---

## What Was Done (Session 3 — Settings Save Bar + Unsaved Changes Guard)

- **`src/lib/useUnsavedGuard.ts`** (new hook): `useUnsavedGuard(dirty, message?)`. Installs a `beforeunload` handler (tab close/refresh/external nav → native prompt) + a capture-phase `document` click interceptor for internal same-origin `<a>` links (App Router has no cancelable route-change event) → `window.confirm` before allowing the jump. Refs keep listeners reading fresh `dirty`.
- **`admin/settings`**: converted App Identity (app_name, org_type), Verification Document Types, and the two toggles (auto_verify_id, otp_required_login) from per-field immediate save to a staged `draft`/`baseline` model. A sticky amber **Save bar** appears when `draft !== baseline`, with Save changes (PATCHes only changed keys, then updates baseline) + Discard (reverts to baseline). `useUnsavedGuard(isDirty)` wired in. CRUD sections (Group Structures, Verification Requirements) stay immediate — discrete add/delete actions, not staged fields.
- **`admin/academic`**: `useUnsavedGuard` wired to `editingValue !== null || newValueName` non-empty (guards a mid-rename / typed-but-unadded value). Its value/verifier CRUD stays immediate.
- **App Version fix**: already resolved — `src/lib/version.ts` imports `pkg.version`; Settings shows `v${APP_VERSION}` = live package.json version (1.3.0). No stale DB row / hardcode found. Nothing to change.

---

## What Was Done (Session 2 — Account Creation, Profile, Verification Refactor)

Unified the profile-completion + verification step. Flow: register (credentials) → email OTP → `/verify-id` (single combined form that finishes the account AND submits verification). No separate later verification step.

### DB (`src/lib/db.ts`, additive ALTER COLUMN, idempotent)
- `users.lrn TEXT`
- `verification_requests.lrn TEXT`
- `verification_requests.profile_photo_url TEXT`
- `verification_requests.denied_fields TEXT` — JSON array of flagged field keys

### verify-id page (`src/app/verify-id/page.tsx`) — the combined flow
- **LRN** input — required, exactly 12 digits (PH Learner's Reference Number), digit-masked.
- **Profile photo** upload — required, must be a face. Client + server checks are a **lightweight heuristic only** (type jpeg/png/webp + size 3 KB–5 MB). TRUE face detection (face-api.js / vision API) is **out of scope — flagged, not faked** (see comments in route + page).
- Group selection (existing dynamic `GroupSelects`) + Document Type (existing) kept.
- Submit posts everything to `/api/verifications` (auto-triggers verification).
- **Reverification lock:** reads `denied_fields` from `/api/auth/me`. Only admin-flagged fields are editable; all others render read-only with a "(locked)" tag and show the kept value. Header switches to "Fix your submission" + amber banner listing fields to fix. Reuses `deriveUiState`.

### APIs
- `POST /api/verifications`: accepts `lrn` + `profile_photo` file. Uploads photo to Blob `avatars/<uid>/…`, sets `users.avatar_url` + `verification_requests.profile_photo_url`, stores `lrn` on both tables. On reverify, **locked** fields (those NOT in prior `denied_fields`) carry forward prior values (lrn, doc_type + its documents, profile photo, group assignments) instead of trusting client input.
- `PATCH /api/verifications/[id]`: reject now **requires** `denied_fields` (subset of `doc_type|profile_photo|lrn|groups`), stored on the request; approve clears `denied_fields`. Activity log records flagged fields.
- `GET /api/auth/me`: now returns `lrn`, and from the latest verification request: `denied_fields[]`, `submitted_lrn`, `submitted_doc_type`, `submitted_profile_photo_url`, `id_photo_url`, `verification_notes`.

### Admin verifications (`src/app/admin/verifications/page.tsx`)
- Reject modal: checkbox grid to tick which fields are wrong (required — ≥1). Sends `denied_fields`.
- Card shows LRN badge; avatar already shows the submitted profile photo (avatar_url).

---

### Register wizard (`src/app/register/page.tsx`) — fields now live on account creation
- Rebuilt register as a 3-step single-page wizard (no navigation away):
  1. **Credentials** (name/email/password) → `POST /api/auth/register` (sends OTP).
  2. **OTP** → `POST /api/auth/verify-otp` type `email_verify` — now **auto-logins** (sets auth cookie).
  3. **Profile** (LRN, profile photo, group selection, doc type + docs) → `POST /api/verifications`, then → dashboard.
- Reuses `GroupSelects`/`useGroupSelections`; same LRN (12-digit) + photo heuristic as verify-id.
- `verify-id` page retained for **reverification** (rejected users) with field-level locks.
- **Auto-login change:** `POST /api/auth/verify-otp` `email_verify` branch now signs a JWT + sets cookie (was: no cookie). Enables uploading during registration. Login OTP branch unchanged.

## Current State
- Build: passing (`npm run build` exit 0)
- TypeScript: clean (`npx tsc --noEmit`)
- Version: `1.2.0`

---

## Key Architectural Notes
- **verification_requests** now carries per-submission `lrn`, `profile_photo_url`, `denied_fields` (JSON). `denied_fields` non-empty ⇒ user is in field-level reverification: only those keys editable.
- **deriveUiState priority** (verify-id): `id_verified` → verified; `verification_status==='pending'` → pending; `'rejected'` → rejected screen (Try Again → upload form pre-filled with locks); else upload. Field locks computed on fetch: `lockedFields = ALL − denied_fields` when `denied_fields` non-empty, else `[]`.
- Server is the source of truth for locked fields — client locking is UX; POST re-derives locks from the prior request and ignores incoming values for locked fields.
- Face validation is a size/type heuristic, NOT real detection (flagged in code).

---

## What's Left / Follow-ups
- Real face detection (library or vision API) if stricter validation is required.
- `register/page.tsx` remains credentials-only (name/email/password); LRN/photo/groups/doc live in the post-OTP verify-id step by design.
- Legacy carry-over from Session 1 still open: candidate group tagging UI, admin user edit of group assignments, dropping dead grade_level_id/subtype_id/section_id columns.
