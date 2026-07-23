# Handoff — Last Session Summary

> Overwrite this file at the end of every session. Future sessions read this for context.

---

## Session Date
2026-07-24

## Version After This Session
`1.2.0` — MINOR: moved profile+verification fields into register wizard (auto-login on email verify)

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
