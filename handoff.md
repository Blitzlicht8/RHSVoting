# Handoff — Last Session Summary

> Overwrite this file at the end of every session. Future sessions read this for context.

---

## Session Date
2026-06-15

## Version After This Session
`0.13.2` — fix: candidate group ID columns stored + returned for dropdown pre-selection

---

## What Was Done

### v0.13.2 — Candidate group ID persistence

#### `src/lib/db.ts`
- Added 3 idempotent `ALTER TABLE` migrations to `newColumns`:
  - `ALTER TABLE candidates ADD COLUMN grade_level_id INTEGER`
  - `ALTER TABLE candidates ADD COLUMN subtype_id INTEGER`
  - `ALTER TABLE candidates ADD COLUMN section_id INTEGER`

#### `src/app/api/elections/[id]/route.ts`
- `CandidateInput` interface: added `grade_level_id`, `subtype_id`, `section_id` optional fields
- `syncPositions` INSERT: expanded from 12 to 15 columns, now stores the ID columns alongside text names
- GET candidates SELECT: added `c.grade_level_id, c.subtype_id, c.section_id` to the query

#### `src/app/admin/elections/page.tsx`
- `handleSave` payload: added `grade_level_id`, `subtype_id`, `section_id` to candidate mapping
- `openEdit` candidate mapping + type annotation: added `grade_level_id`, `subtype_id`, `section_id` — dropdowns in CandidateManager now pre-select correctly on re-open

Note: CandidateManager dropdowns already used IDs as `value` (`acad.gradeLevelId`, `acad.subtypeId`, `cand.section_id`) and the restore effect already prioritized IDs — no changes needed there.

---

## Previous Sessions

### v0.13.1 — Revoke verification bugfixes
- PATCH revoke: sets `verification_status = 'rejected'` (banner now shows)
- POST /api/verifications: DELETE prior rows unconditionally before insert (fixed UNIQUE crash on resubmit)

### v0.13.0 — UX Polish: Rejection Notes + Navbar Indicator + Status Sync
- Mandatory rejection notes in admin verifications UI
- Amber dot badge on Navbar avatar for unverified users

### v0.12.0 — Unverified role guards + visual indicators
### v0.11.2 — master_admin permissions all show checked
### v0.11.1 — member delete button showing incorrectly
### v0.11.0 — Roles system overhaul
### v0.10.1 — Rejected banner stuck after resubmit
### v0.10.0 — Auto-upgrade unverified → member on approval
### v0.9.0–0.9.5 — Verify-ID overhaul, group dropdowns, etc.

---

## Current State

- Build: passing
- TypeScript: clean
- Version: `0.13.2`

---

## Key Architectural Notes

- `verification_status` on `users` is source of truth for banners and verify-id state
- `unverified` role is auto-only — PATCH guard at API level + removed from role selects in UI
- `master_admin` role assignment requires actor to be `master_admin` — enforced at API + hidden in UI for non-master-admins
- DELETE /api/verifications checks `users.verification_status = 'pending'`, not the request row
- Approve (both paths) sets `verification_status = 'approved'` + promotes `unverified → member`
- Reject sets `verification_status = 'rejected'` + `verification_notes` on users
- **Revoke** (admin users page `id_verified=false`) sets `id_verified=0`, `role='unverified'`, `verification_status='rejected'`
- `/api/auth/me` returns `verification_status`, `needs_academic_update`, `bio`
- `'none'` is the `image_path` placeholder in verification_requests when no files uploaded
- `verify-id/page.tsx` calls both local `fetchUser()` AND `refetchAuth()` on submit
- `deriveUiState` priority: id_verified → pending → rejected → upload
- POST /api/verifications deletes ALL prior rows for user before insert (pending guard runs first)
- Roles page is `master_admin`-only — redirects others to `/admin`
- `member` role: `is_system = 0` in DB — guarded by name checks in UI and API, not is_system flag
- `master_admin` role: fully locked. Permissions display forced all-true (DB stores `{}`).
- Rejection reason is mandatory in admin verifications UI — validated client-side before API call
- Candidates store `grade_level_id`, `subtype_id`, `section_id` alongside text names — dropdowns pre-select on edit

---

## What's Left / Ideas

- `intended_role` column in `verification_requests` unused — drop in migration
- Per-position candidate-count validation on activate
- Achievements editor for new candidates
- Admin UI for user-level achievements
