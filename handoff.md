# Handoff — Last Session Summary

> Overwrite this file at the end of every session. Future sessions read this for context.

---

## Session Date
2026-06-15

## Version After This Session
`0.12.0` — unverified role guards + admin users page UX improvements

---

## What Was Done

### v0.12.0 — Unverified role guards + visual indicators

#### `src/app/api/users/route.ts`
- SELECT now includes `verification_status`
- GET supports `?verification_status=pending` filter for pending-count and pending-filter queries

#### `src/app/api/users/[id]/route.ts`
- PATCH: explicit guard — `unverified` role returns 403 (auto-only, cannot be manually assigned)
- PATCH: explicit guard — `master_admin` role returns 403 unless actor is `master_admin`
- Both guards placed before `ALL_ROLES.includes` check

#### `src/app/admin/users/page.tsx`
- `UserRow` interface: added `verification_status?: string | null`
- `ROLE_BADGE.unverified`: changed from `'default'` to `'warning'` (amber badge)
- Added `pendingFilter` + `pendingCount` state
- `fetchPendingCount()` callback — fetches total pending verification users, runs on mount
- `fetchUsers()` now accepts `vs: string` (verification_status) 4th arg; called with `pendingFilter ? 'pending' : ''`
- **Pending Verification chip**: amber filter chip above search bar, shows count badge when > 0, toggles pending filter
- **⚠ indicator**: shown in name column (desktop + mobile) for users with `role === 'unverified'`
- **Inline role selects** (desktop + mobile): `unverified` removed from selectable options; if user IS unverified, a disabled "Unverified (auto)" option shown as current value; `master_admin` option hidden unless current user is `master_admin`
- **Edit modal role select**: shows disabled "Unverified (auto-assigned)" option when editing an unverified user; note "Only Master Admins can assign the Master Admin role" visible when current user is `master_admin`
- Role filter dropdown already included `unverified` via `ALL_ROLES` — no change needed

---

## Previous Sessions

### v0.11.2 — master_admin permissions all show checked
- `admin/roles/page.tsx`: permissions display forces `checked={true}` for `fullyLocked` roles
- Root cause: master_admin permissions column in DB is `{}` — UI was rendering unchecked for missing keys

### v0.11.1 — member delete button showing incorrectly
- `admin/roles/page.tsx`: `isCustom` now guards by name (`!isMemberRole && !isMasterAdmin`) in addition to `is_system === 0`
- Root cause: member has `is_system = 0` in DB, so old check treated it as custom

### v0.11.0 — Roles system overhaul
- Roles page, API guards, lock rules, new permission keys, UI improvements (see prior handoff for full detail)

### v0.10.1 — Rejected banner stuck after resubmit
### v0.10.0 — Auto-upgrade unverified → member on approval
### v0.9.0–0.9.5 — Verify-ID overhaul, group dropdowns, etc.

---

## Current State

- Build: passing
- TypeScript: clean
- Version: `0.12.0`

---

## Key Architectural Notes

- `verification_status` on `users` is source of truth for banners and verify-id state
- `unverified` role is auto-only — PATCH guard at API level + removed from role selects in UI
- `master_admin` role assignment requires actor to be `master_admin` — enforced at API + hidden in UI for non-master-admins
- DELETE /api/verifications checks `users.verification_status = 'pending'`, not the request row
- Approve (both paths) sets `verification_status = 'approved'` + promotes `unverified → member`
- Reject sets `verification_status = 'rejected'` + `verification_notes` on users
- `/api/auth/me` returns `verification_status`, `needs_academic_update`, `bio`
- `'none'` is the `image_path` placeholder in verification_requests when no files uploaded
- `verify-id/page.tsx` calls both local `fetchUser()` AND `refetchAuth()` on submit
- Roles page is `master_admin`-only — redirects others to `/admin`
- `member` role: `is_system = 0` in DB — guarded by name checks in UI and API, not is_system flag
- `member` role: name-editable only. Permissions blocked at API + UI level.
- `master_admin` role: fully locked. Permissions display forced all-true (DB stores `{}`).

---

## What's Left / Ideas

- `intended_role` column in `verification_requests` unused — drop in migration
- Per-position candidate-count validation on activate
- Achievements editor for new candidates
- Admin UI for user-level achievements
