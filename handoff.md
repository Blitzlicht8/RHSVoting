# Handoff — Last Session Summary

> Overwrite this file at the end of every session. Future sessions read this for context.

---

## Session Date
2026-06-15

## Version After This Session
`0.11.2` — roles bug fixes on top of overhaul

---

## What Was Done

### v0.11.2 — master_admin permissions all show checked
- `admin/roles/page.tsx`: permissions display forces `checked={true}` for `fullyLocked` roles
- Root cause: master_admin permissions column in DB is `{}` — UI was rendering unchecked for missing keys

### v0.11.1 — member delete button showing incorrectly
- `admin/roles/page.tsx`: `isCustom` now guards by name (`!isMemberRole && !isMasterAdmin`) in addition to `is_system === 0`
- Root cause: member has `is_system = 0` in DB, so old check treated it as custom

### v0.11.0 — Roles system overhaul

#### `src/app/api/admin/roles/route.ts`
- GET query: explicit `ORDER BY CASE name` — master_admin pinned first, then admin/moderator/staff/member/unverified, then custom α

#### `src/app/api/admin/roles/[id]/route.ts`
- SELECT fetches `is_system, name`
- PATCH: master_admin → 403, other system (not member) → 403, member + permissions → 403, dynamic SET clause
- DELETE: explicit error messages for member and master_admin
- `args` typed as `(string | number | null)[]`

#### `src/app/admin/roles/page.tsx`
- `PERMISSION_KEYS` expanded to 10 keys; `PERM_LABELS` human-readable map
- `ROLE_DESCRIPTIONS` — subtitle under each system role name
- Lock helpers: `isMemberRole`, `isMasterAdmin`, `isFullyLocked`, `isRenameOnly`
- master_admin: Crown icon, amber border, "Supreme Role" badge, no edit/delete
- member: Lock icon, "Default Member" teal badge, pencil (rename only), no delete, perms blocked with toast
- Other system roles: Lock icon, "System" red badge, no edit/delete
- Custom roles: edit + delete unchanged
- `handleSaveEdit`: name-only body for member, name+permissions for custom
- Page subtitle + new role form explanatory note

---

## Previous Sessions

### v0.10.1 — Rejected banner stuck after resubmit
- `verify-id/page.tsx`: calls `refetchAuth()` + local `fetchUser()` on submit

### v0.10.0 — Auto-upgrade unverified → member on approval
- Both approval paths promote `unverified → member`, sync `verification_status='approved'`

### v0.9.0–0.9.5
- Verify-ID overhaul, group dropdowns, back button, rejection/pending banners, me endpoint fixes, cancel endpoint, migration

---

## Current State

- Build: passing
- TypeScript: clean
- Version: `0.11.2`

---

## Key Architectural Notes

- `verification_status` on `users` is source of truth for banners and verify-id state
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
