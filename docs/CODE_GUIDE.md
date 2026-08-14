# Code Guide — What Every File Does

A friendly map of the whole codebase. Read [TECH_STACK.md](TECH_STACK.md) first
if the technology names are new.

**Two rules that explain the whole layout:**
1. **A page's URL = its folder path.** `src/app/elections/page.tsx` → `/elections`.
2. **`page.tsx` = a screen you see. `route.ts` = a back-end endpoint pages call.**
   Anything under `src/app/api/` is server-only (the "kitchen").

Square brackets like `[id]` in a folder name mean "a changing value goes here" —
e.g. `elections/[id]` matches `/elections/5`, `/elections/6`, and so on.

---

## Table of contents
- [Root config files](#root-config-files)
- [`public/` — static files](#public--static-files)
- [`src/lib/` — the shared brain](#srclib--the-shared-brain-most-important)
- [`src/middleware.ts` — the gatekeeper](#srcmiddlewarets--the-gatekeeper)
- [`src/types/` — shared type definitions](#srctypes--shared-type-definitions)
- [`src/app/` — pages (the screens)](#srcapp--pages-the-screens)
- [`src/app/api/` — endpoints (the kitchen)](#srcappapi--endpoints-the-kitchen)
- [`src/components/` — reusable UI pieces](#srccomponents--reusable-ui-pieces)
- [`scripts/` — maintenance tools](#scripts--maintenance-tools)
- [Follow one real action end-to-end](#follow-one-real-action-end-to-end)

---

## Root config files

| File | What it does |
|------|--------------|
| `package.json` | The project's ID card: its name, version, list of libraries, and the `dev`/`build`/`start` commands. |
| `package-lock.json` | Auto-generated exact versions of every library, so everyone installs the identical set. Don't edit by hand. |
| `next.config.js` | Next.js settings. Here it lists which external image hosts are allowed (Vercel Blob, Google, GitHub). |
| `tailwind.config.js` | Tailwind CSS settings (colors, which files to scan for classes). |
| `postcss.config.js` | Wires Tailwind + Autoprefixer into the CSS build. |
| `tsconfig.json` | TypeScript settings, including the `@/` shortcut that means "the `src/` folder". |
| `vercel.json` | Tells Vercel this is a Next.js app when publishing. |
| `.gitignore` | Lists files Git should ignore (secrets, `node_modules`, build output). |
| `.env.example` | Template of the settings you must provide. Copy to `.env.local`. |
| `next-env.d.ts` | Auto-generated TypeScript helper for Next.js. Don't edit. |

---

## `public/` — static files

Anything here is served exactly as-is at the site root (`/`).

| Path | What it is |
|------|-----------|
| `public/rhslogo.png` | The school logo (also used as the browser-tab icon). |
| `public/models/` | The face-recognition model files for `face-api`. Bundled so face verification works offline. |
| `public/uploads/` | Placeholder folder for local uploads. |

---

## `src/lib/` — the shared brain (most important)

Reusable logic that many pages and endpoints depend on. If you read only one
folder, read this one.

| File | What it does | Key functions |
|------|--------------|---------------|
| **`db.ts`** | The single doorway to the database. Opens the connection pool, and on first use **creates all tables and seeds** the default settings, roles, group structure, and admin accounts. Also translates the app's old SQLite-style SQL into PostgreSQL. | `db.execute({sql, args})` run one query · `db.batch(...)` run several · `ensureInit()` build/seed the DB once |
| **`auth.ts`** | Everything about login sessions. Creates and reads the JWT wristband, sets/clears the cookie, and generates OTP codes. | `signJWT()` make a login token · `verifyJWT()` check one · `getAuthUser()` who is logged in? · `isAdmin()` is this role staff-or-higher? · `generateOTP()` |
| **`permissions.ts`** | Fine-grained "is this role allowed to do X?" checks, read from the `roles` table. `master_admin` can always do everything. | `hasPermission(role, scope)` |
| **`email.ts`** | Builds and sends the OTP emails with nodemailer. In no-email dev mode, returns the code instead of sending it. | `sendOTPEmail(to, otp, type)` |
| **`groups.ts`** | The configurable "group structure" system (e.g. Grade Level → Section → Strand) used to decide who may vote in an election. | `evaluateEligibility()` · `getUserValueSet()` · `invalidateGroupsCache()` |
| **`postVisibility.ts`** | Works out which election-related posts a normal user is allowed to see (admins see all). | `getVisibleElectionIds()` |
| **`autoTransition.ts`** | Automatically opens an election when its start time arrives and closes it at its end time (if auto mode is on). | `checkAutoTransition(electionId)` |
| **`cache.ts`** | A tiny short-term memory for data that rarely changes, to avoid hitting the database repeatedly. | `cached(key, ttl, loader)` · `invalidate(key)` |
| **`logger.ts`** | Records important actions (logins, edits, deletions) into an activity log. Never crashes the app if logging fails. | `logActivity(userId, action, details, ip)` |
| **`uploadMedia.ts`** | Front-end helper that sends a chosen file to the upload endpoint and returns its stored URL. | `uploadPostMedia(file)` |
| **`faceApi.ts`** | Loads the face models in the browser and compares two faces. All face math runs client-side. | `loadModels()` · `getDescriptor()` · `compareFaces()` |
| **`useUnsavedGuard.ts`** | A React hook that warns "you have unsaved changes" before you leave a form. | `useUnsavedGuard()` |
| **`version.ts`** | Exposes the app version from `package.json` as `APP_VERSION`. | — |

---

## `src/middleware.ts` — the gatekeeper

Runs **before every request**. It checks your login cookie and:
- sends logged-in users away from the login page (to the dashboard), and
- sends logged-out users away from protected pages (back to login).

It also clears a broken/expired cookie so you can't get stuck in a redirect loop.

---

## `src/types/` — shared type definitions

| File | What it does |
|------|--------------|
| `types/index.ts` | Central list of the project's data shapes (a `User`, an `Election`, a `Role`, etc.) so every file agrees on what fields exist. |

---

## `src/app/` — pages (the screens)

Each `page.tsx` is one screen. `layout.tsx` wraps a whole section with shared
chrome (nav bars, providers). Special files: `loading.tsx` (shown while a page
loads) and `not-found.tsx` (the 404 page).

| Path (URL) | Screen |
|------------|--------|
| `app/layout.tsx` | The outermost wrapper for the entire site (fonts, providers, tab icon). |
| `app/page.tsx` (`/`) | The **login** page (landing page). |
| `app/register/page.tsx` (`/register`) | Create a new account. |
| `app/verify-otp/page.tsx` (`/verify-otp`) | Enter the one-time code during 2FA. |
| `app/verify-id/page.tsx` (`/verify-id`) | Submit ID for identity verification. |
| `app/dashboard/page.tsx` (`/dashboard`) | The signed-in home screen. |
| `app/elections/page.tsx` (`/elections`) | List of elections you can see. |
| `app/elections/[id]/page.tsx` (`/elections/5`) | One election: positions, candidates, and the **voting** interface. |
| `app/feed/page.tsx` (`/feed`) | Social feed of posts. |
| `app/posts/[id]/page.tsx` | A single post with comments. |
| `app/profile/page.tsx` (`/profile`) | Your own profile and group info. |
| `app/users/page.tsx` + `app/users/[id]/page.tsx` | Browse users / view one user. |
| `app/loading.tsx`, `app/not-found.tsx` | Loading spinner and 404 screen. |

### `app/admin/` — the admin area (staff only)
Each is a management screen; `admin/layout.tsx` adds the admin sidebar and blocks
non-staff.

| Path | Screen |
|------|--------|
| `admin/elections/page.tsx` | Create & manage elections, positions, candidates. |
| `admin/users/page.tsx` | Manage user accounts. |
| `admin/verifications/page.tsx` | Approve/reject submitted IDs. |
| `admin/roles/page.tsx` | Define roles and their permissions. |
| `admin/academic/page.tsx` | Manage the group structure (grades/sections/strands). |
| `admin/posts/page.tsx` | Moderate posts. |
| `admin/reports/page.tsx` | Handle reported posts/comments. |
| `admin/logs/page.tsx` | View the activity log. |
| `admin/settings/page.tsx` · `admin/app-config/page.tsx` | Site-wide settings. |
| `admin/face-verification/page.tsx` | Review face-verification data. |

### `app/actions/`
| File | What it does |
|------|--------------|
| `actions/auth.ts` | Server Actions for auth (server functions callable directly from forms). |

---

## `src/app/api/` — endpoints (the kitchen)

Every `route.ts` is a back-end endpoint. The folder path is the URL, and each
file can handle different HTTP "verbs": **GET** = read, **POST** = create,
**PUT/PATCH** = update, **DELETE** = remove. Grouped by topic:

**Authentication — `api/auth/`**
| Endpoint | Purpose |
|----------|---------|
| `register` | Create an account, start email verification. |
| `login` | Check password, then send the OTP (step 1 of 2FA). |
| `verify-otp` | Check the OTP and issue the login token (step 2 of 2FA). |
| `resend-otp` | Send a fresh OTP. |
| `logout` | Clear the login cookie. |
| `me` | "Who am I?" — returns the current user. |
| `change-password` | Change your password. |
| `face-verify` | Confirm identity with a face check. |

**Elections & voting — `api/elections/`**
| Endpoint | Purpose |
|----------|---------|
| `route.ts` | List / create elections. |
| `[id]` | Read / update / delete one election. |
| `[id]/vote` | **Cast a vote** (enforces one vote per position). |
| `[id]/candidates` & `[id]/candidates/[candidateId]` | Add / edit / remove candidates. |
| `[id]/results` + `results/export` | View results / download them. |
| `eligible-count` | How many students may vote. |
| `join/[token]` | Join a private election via invite link. |
| `upload-thumbnail` | Election cover image. |

**Users — `api/users/`** — read/update users, your own profile (`me`), achievements, and self re-verification (`me/reverify`).

**Admin tools — `api/admin/`** — staff-only endpoints mirroring the admin pages: `users`, `roles`, `groups`, `students`, `verifiers`, `verification-requirements`, `teacher-assignments`, `reports`, `comment-reports`, `logs`, `members/search`, and `face-verification`.

**Social — `api/posts/` & `api/comments/`** — create/read/update/delete posts, react to them, comment, and report posts or comments.

**Face verification — `api/face/`** — save a face descriptor (`enroll`), fetch it (`descriptor`), check status, and report mismatches.

**Other**
| Endpoint | Purpose |
|----------|---------|
| `api/groups` | The group structure the sign-up and eligibility forms use. |
| `api/settings` | Public site settings. |
| `api/upload` | Receives a file, stores it in Vercel Blob, returns the URL. |
| `api/verifications` + `api/verifications/[id]` | Submit an ID / approve-reject it. |

---

## `src/components/` — reusable UI pieces

Building blocks used across many pages, so the look stays consistent.

**Layout & navigation**
| Component | What it is |
|-----------|-----------|
| `Layout.tsx`, `AdminLayout.tsx` | Page frames for the normal site and the admin area. |
| `Navbar.tsx`, `Sidebar.tsx`, `BottomNav.tsx` | Top bar, side menu, and the phone bottom nav bar. |

**Feature components**
| Component | What it is |
|-----------|-----------|
| `PostCard.tsx`, `PostEditor.tsx` | Show a post / write a post. |
| `GroupSelects.tsx` | The linked dropdowns for grade/section/strand. |
| `FaceCapture.tsx`, `FaceGate.tsx`, `LivenessCapture.tsx` | Webcam capture and face-verification gate. |
| `admin/elections/*` | `ElectionList`, `ElectionFormModal`, `PositionManager`, `CandidateManager` — the pieces of the admin election screen. |

**Providers — `components/providers/`**
| Component | What it is |
|-----------|-----------|
| `AuthProvider.tsx` | Shares "who is logged in" with the whole app. |
| `ToastProvider.tsx` | Shows the little pop-up success/error messages. |

**Basic UI kit — `components/ui/`**
Small styled primitives reused everywhere: `Button`, `Input`, `Card`, `Modal`,
`ConfirmDialog`, `Badge`, `StatusBadge`, `Spinner`, `Skeleton`, `OTPInput`,
`DateTimePicker`, `LightboxModal`, `Logo`.

---

## `scripts/` — maintenance tools

Not needed to run the app — one-off helpers run by hand.

| File | What it does |
|------|--------------|
| `smoke-pg.ts`, `smoke-write-pg.ts` | Quick "is the database reachable / writable?" checks. |

---

## Follow one real action end-to-end

**Casting a vote**, from tap to stored:

1. You open `/elections/5` → the page `src/app/elections/[id]/page.tsx` renders
   the positions and candidates (using UI components from `src/components/`).
2. You pick candidates and press **Submit**. The page sends a POST request to
   the endpoint `src/app/api/elections/[id]/vote/route.ts`.
3. **Before** it even reaches that code, `src/middleware.ts` confirms you have a
   valid login cookie.
4. Inside the endpoint, `src/lib/auth.ts` confirms who you are, and the code
   checks the rules: are you eligible? have you already voted for this position?
5. If all good, `src/lib/db.ts` writes your vote into the `votes` table, and
   `src/lib/logger.ts` records the action.
6. The endpoint replies "success", and the page updates to show your vote was
   counted.

Every other feature follows the same shape: **page → API route → lib helpers →
database → back to the page.**
