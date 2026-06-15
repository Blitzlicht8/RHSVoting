# Handoff — Last Session Summary

> Overwrite this file at the end of every session. Future sessions read this for context.

---

## Session Date
2026-06-15

## Version After This Session
`0.11.0` — roles system overhaul: lock rules, new permission keys, UI improvements

---

## What Was Done

### v0.11.0 — Roles system overhaul

#### `src/app/api/admin/roles/route.ts`
- GET query updated with explicit `ORDER BY CASE name ...` — master_admin pinned first, then admin/moderator/staff/member/unverified, then custom roles alphabetically.

#### `src/app/api/admin/roles/[id]/route.ts`
- SELECT now fetches `is_system, name` (was `is_system` only)
- PATCH logic restructured:
  - `master_admin` → 403 always
  - Other system roles (not `member`) → 403
  - `member` + `permissions` in body → 403
  - Dynamic SET clause — only updates fields present in body (name-only for member, name+permissions for custom)
- DELETE: added explicit error messages for `member` and `master_admin` (belt-and-suspenders; is_system catches them first)
- `args` typed as `(string | number | null)[]` to satisfy libsql `InArgs`

#### `src/app/admin/roles/page.tsx`
- `PERMISSION_KEYS` expanded: added `manageAcademic`, `manageRoles`, `viewLogs`, `manageFeed`
- `PERM_LABELS` map added — human-readable labels, replaces camelCase split everywhere
- `ROLE_DESCRIPTIONS` map — subtitle shown under each system role name
- Lock helpers: `isMemberRole`, `isMasterAdmin`, `isFullyLocked`, `isRenameOnly`
- `master_admin` card: Crown icon, amber border + tint bg, "Supreme Role" amber badge, no edit/delete buttons
- `member` card: Lock icon, "Default Member" teal badge, pencil (rename only), no delete; in edit mode perms grid is dimmed with amber warning note + toast on click
- Other system roles (admin/moderator/staff/unverified): Lock icon, "System" red badge, no edit/delete
- Custom roles: unchanged behavior (edit + delete)
- `handleSaveEdit`: sends `{ name }` only for member role, `{ name, permissions }` for custom
- Page subtitle: "System roles are locked. Custom roles can be created and assigned permissions."
- New role form: note explaining custom vs system roles, Cancel clears form state
- Crown icon imported from lucide-react

---

## Previous Sessions

### v0.10.1 — Rejected banner stuck after resubmit
- `verify-id/page.tsx`: calls `refetchAuth()` alongside local `fetchUser()` on submit — keeps Layout banner in sync

### v0.10.0 — Auto-upgrade unverified → member on approval
- Both approval paths promote `role='unverified'` to `'member'`, sync `verification_status='approved'`

### v0.9.0–0.9.5
- Verify-ID overhaul, group dropdowns, back button, rejection/pending banners, me endpoint fixes, cancel endpoint, migration

---

## Current State

- Build: passing
- TypeScript: clean
- Version: `0.11.0`

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
- `member` role: name-editable only via UI + API. Permissions blocked at API level.
- `master_admin` role: fully locked — no edit, no delete at API or UI level.

---

## What's Left / Ideas

- `intended_role` column in `verification_requests` unused — drop in migration
- Per-position candidate-count validation on activate
- Achievements editor for new candidates
- Admin UI for user-level achievements
