# Handoff — Last Session Summary

> Overwrite this file at the end of every session. Future sessions read this for context.

---

## Session Date
2026-06-15

## Version After This Session
`0.13.0` — UX polish: rejection notes mandatory, navbar unverified indicator, verify-id UIState confirmed

---

## What Was Done

### v0.13.0 — UX Polish: Rejection Notes + Navbar Indicator + Status Sync

#### `src/app/admin/verifications/page.tsx`
- Added `rejectNotesError` state
- `openRejectModal`: resets `rejectNotesError` to `''` on open
- `handleReject`: validates `rejectNotes.trim()` before closing modal — returns early with inline error if empty; API call blocked
- Reject modal label now shows red asterisk: `Reason / Notes *`
- Textarea `onChange` clears `rejectNotesError` on keystroke
- Inline error `<p>` renders below textarea when `rejectNotesError` is set
- Textarea border turns red (`border-red-400`) when error is active
- Shows existing `selectedRejectRequest.notes` in an amber context box above textarea (for re-review context)

#### `src/components/Navbar.tsx`
- Avatar button: adds `title="Verify your identity"` when `user.role === 'unverified'`
- Amber dot badge (`w-2 h-2 bg-amber-400 rounded-full absolute top-0 right-0 pointer-events-none`) rendered as sibling to avatar button inside the `relative` wrapper — visible outside button's `overflow-hidden`

#### `src/app/verify-id/page.tsx`
- **No changes needed** — `deriveUiState` already implements correct priority (verified → pending → rejected → upload), and `handleSubmit` already calls `fetchUser() + refetchAuth()` after successful POST, triggering UIState → `'pending'` without reload. Confirmed correct as-is.

---

## Previous Sessions

### v0.12.0 — Unverified role guards + visual indicators
- `api/users/route.ts`: SELECT includes `verification_status`; GET supports `?verification_status=pending` filter
- `api/users/[id]/route.ts`: PATCH guards — `unverified` role → 403; `master_admin` role → 403 unless actor is `master_admin`
- `admin/users/page.tsx`: pending filter chip, ⚠ indicator for unverified users, `unverified` removed from role selects, disabled "Unverified (auto)" shown as current value

### v0.11.2 — master_admin permissions all show checked
- `admin/roles/page.tsx`: permissions display forces `checked={true}` for `fullyLocked` roles

### v0.11.1 — member delete button showing incorrectly
- `admin/roles/page.tsx`: `isCustom` guards by name in addition to `is_system === 0`

### v0.11.0 — Roles system overhaul
- Roles page, API guards, lock rules, new permission keys, UI improvements

### v0.10.1 — Rejected banner stuck after resubmit
### v0.10.0 — Auto-upgrade unverified → member on approval
### v0.9.0–0.9.5 — Verify-ID overhaul, group dropdowns, etc.

---

## Current State

- Build: passing
- TypeScript: clean
- Version: `0.13.0`

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
- `deriveUiState` priority: id_verified → pending → rejected → upload
- Roles page is `master_admin`-only — redirects others to `/admin`
- `member` role: `is_system = 0` in DB — guarded by name checks in UI and API, not is_system flag
- `member` role: name-editable only. Permissions blocked at API + UI level.
- `master_admin` role: fully locked. Permissions display forced all-true (DB stores `{}`).
- Rejection reason is now mandatory in admin verifications UI — validated client-side before API call

---

## What's Left / Ideas

- `intended_role` column in `verification_requests` unused — drop in migration
- Per-position candidate-count validation on activate
- Achievements editor for new candidates
- Admin UI for user-level achievements
