# SchoolVoting — Claude Code Prompts
Paste each prompt as a separate Claude Code task. Follow phase order — later phases depend on earlier ones.

---

## PHASE 1 — FOUNDATION

### P1 · RHS Theme + Favicon

```
Rebrand the entire SchoolVoting app to Rizal High School (RHS) theme.

COLOR SYSTEM — replace all indigo-600/indigo-700/indigo-500 Tailwind references:
  Primary (RHS Red):    #84050C  → use for primary buttons, active nav, CTAs
  Primary hover:        #6B0409
  Primary light/tint:   #FEE2E2  (replace indigo-50/indigo-100 backgrounds)
  Accent (RHS Yellow):  #D69A23  → use for badges, highlights, active states
  Accent light:         #FEF9C3
  Secondary reds:       #BA4955, #D47F88 — gradients, hover states
  Destructive:          #DC2626  (keep as-is)
  All other grays/whites stay the same.

FILES TO UPDATE:
1. src/app/globals.css — add CSS custom properties:
   :root {
     --color-primary: #84050C;
     --color-primary-hover: #6B0409;
     --color-primary-tint: #FEE2E2;
     --color-accent: #D69A23;
     --color-accent-light: #FEF9C3;
   }

2. src/components/ui/Button.tsx — update VARIANTS.primary to bg-[#84050C] hover:bg-[#6B0409] focus:ring-[#84050C]

3. src/components/ui/Logo.tsx (create if not exists, else update src/app/page.tsx LogoIcon) —
   change shield fill/stroke from #4f46e5 to #84050C, ballot checkmark stroke stays white

4. src/components/Sidebar.tsx — active nav item: text-[#84050C] bg-[#FEE2E2] border-[#84050C]
   (replace indigo active state classes)

5. src/components/ui/Badge.tsx — primary badge: bg-[#FEE2E2] text-[#84050C]

6. src/app/page.tsx + src/app/register/page.tsx — update all indigo-600/700 Link and text colors

7. src/app/dashboard/page.tsx — StatCardItem active/primary color tile

8. src/app/elections/[id]/page.tsx — selected candidate border: border-[#84050C] ring-[#84050C] bg-[#FEE2E2]

9. All remaining files in src/ — global find-replace:
   text-indigo-600 → text-[#84050C]
   text-indigo-700 → text-[#6B0409]
   bg-indigo-600  → bg-[#84050C]
   bg-indigo-700  → bg-[#6B0409]
   bg-indigo-50   → bg-[#FEE2E2]
   bg-indigo-100  → bg-[#FEE2E2]
   border-indigo-* → border-[#84050C] (where semantic)
   ring-indigo-*  → ring-[#84050C]
   hover:bg-indigo-700 → hover:bg-[#6B0409]
   hover:text-indigo-700 → hover:text-[#6B0409]
   focus:ring-indigo-500 → focus:ring-[#84050C]

FAVICON:
- rhslogo.png already exists at project root
- In src/app/layout.tsx <head>, add:
  <link rel="icon" href="/rhslogo.png" type="image/png" />
  <link rel="apple-touch-icon" href="/rhslogo.png" />
- Copy rhslogo.png to public/rhslogo.png (Next.js serves from /public)

FONT — migrate off render-blocking @import:
- Remove @import from src/app/globals.css
- In src/app/layout.tsx, add at top:
  import { Inter } from 'next/font/google'
  const inter = Inter({ subsets: ['latin'], display: 'swap' })
- Apply: <body className={inter.className}>

APP NAME — update all "SchoolVoting" text labels to "RHS E-Voting" or "Rizal High School E-Voting"
in layout.tsx metadata title, sidebar header, login page title, register page title.
```

---

### P2 · Database Schema Migration

```
Add new tables and columns to src/lib/db.ts to support grade levels, subtypes, sections,
campaigns, posts, reactions, and the updated verification/election/candidate models.

In the _init() function, add these CREATE TABLE IF NOT EXISTS statements to the existing batch:

-- 1. Grade levels (admin-managed, default 7-12 seeded)
CREATE TABLE IF NOT EXISTS grade_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  order_index INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 2. Subtypes per grade level (strand/program/track — optional)
CREATE TABLE IF NOT EXISTS grade_subtypes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_level_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE,
  UNIQUE(grade_level_id, name)
);

-- 3. Sections per grade level OR per subtype
CREATE TABLE IF NOT EXISTS sections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  grade_level_id INTEGER NOT NULL,
  subtype_id INTEGER,
  name TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (grade_level_id) REFERENCES grade_levels(id) ON DELETE CASCADE,
  FOREIGN KEY (subtype_id) REFERENCES grade_subtypes(id) ON DELETE CASCADE,
  UNIQUE(grade_level_id, subtype_id, name)
);

-- 4. Verification documents (replaces single image_path)
CREATE TABLE IF NOT EXISTS verification_documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  verification_request_id INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  FOREIGN KEY (verification_request_id) REFERENCES verification_requests(id) ON DELETE CASCADE
);

-- 5. Election eligibility rules (replaces future free-text grade/section)
CREATE TABLE IF NOT EXISTS election_eligibility (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  election_id INTEGER NOT NULL,
  grade_level_id INTEGER,
  subtype_id INTEGER,
  section_id INTEGER,
  is_all_grade INTEGER NOT NULL DEFAULT 0,
  is_all_subtype INTEGER NOT NULL DEFAULT 0,
  is_all_section INTEGER NOT NULL DEFAULT 0,
  is_exclude INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE CASCADE
);

-- 6. Posts (campaign posts)
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  author_id INTEGER NOT NULL,
  election_id INTEGER,
  content TEXT NOT NULL,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (author_id) REFERENCES users(id),
  FOREIGN KEY (election_id) REFERENCES elections(id) ON DELETE SET NULL
);

-- 7. Post media attachments
CREATE TABLE IF NOT EXISTS post_media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  url TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

-- 8. Post reactions
CREATE TABLE IF NOT EXISTS post_reactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'heart',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 9. Post comments
CREATE TABLE IF NOT EXISTS post_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  author_id INTEGER NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id)
);

-- 10. Post reports
CREATE TABLE IF NOT EXISTS post_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  post_id INTEGER NOT NULL,
  reporter_id INTEGER NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by INTEGER,
  reviewed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(post_id, reporter_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (reporter_id) REFERENCES users(id),
  FOREIGN KEY (reviewed_by) REFERENCES users(id)
);

-- 11. User achievements
CREATE TABLE IF NOT EXISTS user_achievements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  year INTEGER,
  order_index INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 12. Candidate ↔ user link + achievements
-- candidates table: add user_id column (links to users table — for when candidate is an existing user)

NEW COLUMNS (add to the existing idempotent ALTER TABLE block):
  ALTER TABLE users ADD COLUMN grade_level_id INTEGER
  ALTER TABLE users ADD COLUMN subtype_id INTEGER
  ALTER TABLE users ADD COLUMN section_id INTEGER
  ALTER TABLE users ADD COLUMN avatar_url TEXT
  ALTER TABLE verification_requests ADD COLUMN grade_level_id INTEGER
  ALTER TABLE verification_requests ADD COLUMN subtype_id INTEGER
  ALTER TABLE verification_requests ADD COLUMN section_id INTEGER
  ALTER TABLE verification_requests ADD COLUMN doc_type TEXT
  ALTER TABLE elections ADD COLUMN allow_teacher_vote INTEGER NOT NULL DEFAULT 0
  ALTER TABLE elections ADD COLUMN is_global INTEGER NOT NULL DEFAULT 0
  ALTER TABLE candidates ADD COLUMN user_id INTEGER

SEED grade levels after settings seed:
  INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 7', 0)
  INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 8', 1)
  INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 9', 2)
  INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 10', 3)
  INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 11', 4)
  INSERT OR IGNORE INTO grade_levels (name, order_index) VALUES ('Grade 12', 5)

Also seed a new settings key:
  INSERT OR IGNORE INTO settings (key, value) VALUES ('otp_required_login', 'true')
  (already exists — skip if duplicate)

Update src/types/index.ts to add:
  GradeLevel, GradeSubtype, Section, Post, PostMedia, PostReaction, PostComment,
  PostReport, UserAchievement interfaces matching the tables above.
  Update User interface: add grade_level_id, subtype_id, section_id, avatar_url fields.
  Update VerificationRequest: add grade_level_id, subtype_id, section_id, doc_type fields.
  Update Election: add allow_teacher_vote, is_global fields.
  Update Candidate: add user_id field.
```

---

## PHASE 2 — ADMIN CONFIGURATION

### P3 · Grade Level / Subtype / Section Management

```
Create a new admin page for managing the academic hierarchy used in account creation,
verification, and election targeting.

NEW PAGE: src/app/admin/academic/page.tsx
- Title: "Academic Structure"
- Three-panel accordion layout: Grade Levels → Subtypes → Sections
- Add to Sidebar nav (adminOnly: true): href="/admin/academic", label="Academic Structure",
  icon = LayoutList from lucide-react

GRADE LEVELS panel:
- List all grade_levels ordered by order_index
- Each row: name, order drag handle, edit button, delete button (confirm modal)
- Add button → inline form: name input + save
- Default grades (7-12) are deletable too

SUBTYPES panel (appears when a grade level is selected/expanded):
- List grade_subtypes for selected grade_level_id
- Label says "Subtypes (optional — strand/track/program)"
- Same CRUD: add, edit, delete with confirm
- If a grade level has no subtypes, sections attach directly to the grade level

SECTIONS panel (appears when grade level OR subtype is selected):
- List sections filtered by selected grade_level_id and subtype_id (null if no subtype)
- Same CRUD: add, edit, delete with confirm
- Display as chips/tags list

API ROUTES to create:
  GET    /api/admin/academic/grade-levels
  POST   /api/admin/academic/grade-levels
  PUT    /api/admin/academic/grade-levels/[id]
  DELETE /api/admin/academic/grade-levels/[id]

  GET    /api/admin/academic/subtypes?gradeLevelId=X
  POST   /api/admin/academic/subtypes
  PUT    /api/admin/academic/subtypes/[id]
  DELETE /api/admin/academic/subtypes/[id]

  GET    /api/admin/academic/sections?gradeLevelId=X&subtypeId=Y
  POST   /api/admin/academic/sections
  PUT    /api/admin/academic/sections/[id]
  DELETE /api/admin/academic/sections/[id]

Also create a PUBLIC read-only API (no auth required) for use in registration/forms:
  GET /api/academic/grade-levels  → returns active grade levels
  GET /api/academic/subtypes?gradeLevelId=X → returns active subtypes
  GET /api/academic/sections?gradeLevelId=X&subtypeId=Y → returns active sections

All admin routes require role in [master_admin, teacher_admin].
```

---

### P4 · OTP Skip When Disabled

```
In src/app/api/auth/login/route.ts, the login flow always issues an OTP even when
otp_required_login is false. Fix:

1. Read the otp_required_login setting from the settings table (already done for other flows).
2. When otp_required_login === 'false' AND password matches:
   - Skip OTP generation and email send
   - Issue the JWT session cookie directly (same logic as the OTP verify step)
   - Return { success: true, redirectTo: '/dashboard' } (no requiresOTP flag)
3. When otp_required_login === 'true': keep existing OTP flow unchanged.

In src/app/page.tsx (login), when the API returns redirectTo without requiresOTP:
  window.location.href = '/dashboard'
  (no OTP step shown)

No other changes needed — the toggle already exists in admin settings.
```

---

### P5 · Admin Create User + Manage Verification

```
PART A — Admin Create User

In src/app/admin/users/page.tsx, add a "Create User" button (for master_admin and
teacher_admin only) that opens a modal with:

Fields:
  - Name (text, required)
  - Email (email, required)
  - Password (auto-generate shown, or manual entry with show/hide toggle)
  - Role: dropdown [student, teacher, student_admin, teacher_admin] (master_admin can also set master_admin)
  - For student/student_admin roles: Grade Level selector → Subtype selector (if grade has subtypes) → Section selector
  - For teacher/teacher_admin: no grade/subtype/section fields
  - Email Verified: checkbox (default checked for admin-created accounts)
  - School Document Verified: checkbox (default unchecked)
  - Optional: upload school document for this user (same file upload as verification, max 5MB)

On submit:
  POST /api/admin/users/create (new route)
  Creates user, optionally creates verification_request with status='approved' if doc uploaded
  and "School Document Verified" is checked. If checkbox checked but no doc, still sets
  id_verified=1 (admin vouches). Logs action in user_logs.

PART B — Revoke Verification

In the user management table (src/app/admin/users/page.tsx), add a "Revoke" button on
verified users. Shows a confirm modal. On confirm:
  PATCH /api/users/[id] with { id_verified: false }
  Also sets the user's verification_request status back to 'pending' if one exists,
  or creates a new one with status='revoked'. Logs in user_logs.
```

---

### P6 · School Document Verification (Replace ID Upload)

```
Replace the current single-photo ID verification with a multi-document school proof upload.

CHANGES:

1. src/app/verify-id/page.tsx — rename page concept to "School Document Verification":
   - Page title: "Upload School Documents"
   - Description: "Upload a photo or scan of your School ID, enrollment form, registration
     form, or any official school document proving you are a student/staff at Rizal High School."
   - Grade Level selector (cascading): fetch from GET /api/academic/grade-levels
     → if grade has subtypes, show Subtype selector
     → then Section selector
     → Teacher role: skip grade/subtype/section fields entirely
   - Document type selector: ['School ID', 'Enrollment Form', 'Registration Form', 'Other Document']
   - File upload: accept image/* and application/pdf, max 5MB per file,
     allow up to 3 files (stored as verification_documents rows)
   - On submit: POST /api/verifications with grade_level_id, subtype_id (nullable),
     section_id (nullable), doc_type, and files
   - Show current upload status banner if already submitted

2. src/app/api/verifications/route.ts — update POST handler:
   - Accept multipart/form-data with up to 3 files + grade_level_id, subtype_id, section_id, doc_type
   - Upload each file to Vercel Blob (keep existing blob logic, enforce 5MB per file)
   - INSERT INTO verification_requests with new fields
   - INSERT each file URL into verification_documents
   - Update user grade_level_id/subtype_id/section_id from submitted values

3. src/app/admin/verifications/page.tsx — update verification review view:
   - Show doc_type and grade/subtype/section submitted
   - Show all uploaded documents (not just one image) — image gallery or list of links
   - Approve button sets user.id_verified=1 AND sets the user's grade_level_id/subtype_id/section_id
     from the verification_request values
   - Rejection notes field (already exists)

4. src/app/api/verifications/[id]/route.ts — update PATCH approve handler:
   On approve: also UPDATE users SET grade_level_id=?, subtype_id=?, section_id=?
   using values from verification_request.
```

---

## PHASE 3 — ELECTIONS & PRIVACY

### P7 · Election Eligibility Targeting

```
Update election creation/edit in src/app/admin/elections/page.tsx to support grade-level
targeted elections with the following UI flow:

NEW "Eligibility" section in the election create/edit modal:

TOGGLE: "Global Election (visible to all)" — when ON, skips grade targeting, sets is_global=1.
When global is ON, add a secondary toggle: "Teachers Can Vote" (allow_teacher_vote).

When global is OFF, show the Grade Targeting builder:

GRADE LEVEL SELECTOR:
- Checkbox list of all active grade levels
- "All Grade Levels" checkbox at top — when checked, disables individual grade checkboxes
  and shows an "Add Exclusions" toggle

For each selected grade level:
  → If the grade has subtypes, show SUBTYPE row:
    - "All Subtypes" checkbox + individual subtype checkboxes
  → For each selected subtype (or directly if no subtypes):
    → SECTION row: "All Sections" checkbox + individual section checkboxes

EXCLUSIONS (only visible when "All Grade Levels" is checked):
- Same cascading selector but labeled "Exclude:"
- Adds records with is_exclude=1 to election_eligibility

"Teachers Can Vote" toggle: saves allow_teacher_vote=1 on the election.

DATA MODEL: save selections as rows in election_eligibility:
  - One row per grade/subtype/section combination
  - Use is_all_grade, is_all_subtype, is_all_section flags for "All" selections
  - is_exclude=1 for exclusion rows

API: update POST/PUT /api/elections and /api/elections/[id] to accept and save
eligibility rules. Add GET /api/elections/[id] to return eligibility rules.

CANDIDATE TARGETING:
In election candidate search (admin/elections page, candidate add modal):
- By default only search users whose grade_level_id/subtype_id/section_id matches the
  election's eligibility rules AND role in [student, student_admin]
- Add a toggle "Search Teachers as Candidates" — when ON, also include
  role in [teacher, teacher_admin]
```

---

### P8 · Vote Privacy + Election Visibility Filtering

```
VOTE PRIVACY:

1. Student votes are PRIVATE — only the voter sees their own vote history.
   - src/app/api/elections/[id]/vote/route.ts GET: only return hasVoted + the voter's own
     vote selections (not vote counts or other voters) when requester is a student/student_admin
   - Admin results endpoint GET /api/elections/[id]/results: student vote details are
     NEVER returned (only aggregate counts per candidate). Teacher votes CAN be returned
     as individual records when requester is teacher_admin or master_admin.

2. src/app/elections/[id]/page.tsx — student vote history:
   After voting, show the voter their own selections in a "Your Votes" summary section.
   Do NOT show how many total votes each candidate has to students during an active election.
   After election ends, show results to all (aggregate only, no individual attribution).

ELECTION VISIBILITY FILTERING:

3. src/app/api/elections/route.ts GET — filter elections by user:
   - If user is teacher, teacher_admin, master_admin, student_admin: return all elections
   - If user is student (verified): return elections where:
     a. is_global = 1, OR
     b. election_eligibility has a matching row for user's grade_level_id/subtype_id/section_id
        (accounting for is_all_grade/is_all_subtype/is_all_section and exclusions)
   - If user is student (unverified): return only global elections (is_global=1)
     with hasVoted=false and canVote=false

4. src/app/dashboard/page.tsx — update ElectionCard:
   - For unverified students seeing a global election: show "Verify to Vote" badge
     (amber) instead of "ID Required"
   - Remove the "ID Required" label; update to "Verify to Vote" linking to /verify-id
```

---

## PHASE 4 — PROFILE & ACHIEVEMENTS

### P9 · Profile Page

```
Create src/app/profile/page.tsx — accessible at /profile for all authenticated users.
Add "Profile" to Sidebar nav (not admin-only): href="/profile", icon = UserCircle from lucide-react.

SECTIONS:

1. PROFILE PHOTO
   - Show current avatar_url or initials avatar if none
   - "Change Photo" button → file input (image/* only, max 2MB)
   - Upload to Vercel Blob → PATCH /api/users/me with { avatar_url }

2. BASIC INFO (read-only display + edit button)
   - Name, Email (non-editable)
   - Edit name → inline form

3. ACADEMIC INFO (students only — not shown for teacher/teacher_admin)
   - Current Grade Level, Subtype, Section (read from user record)
   - "Request Change" button → opens cascading selector
   - On save: PATCH /api/users/me with new grade_level_id/subtype_id/section_id
     + sets user.id_verified = 0 (requires re-verification)
     + shows warning modal: "Changing your academic info will reset your verification.
       You will need to re-upload school documents."
   - After save, redirect user to /verify-id

4. CHANGE PASSWORD
   - Current password, New password, Confirm new password
   - POST /api/auth/change-password (new route)
   - Validate current password with bcrypt, update hash

5. ACHIEVEMENTS
   - List of user_achievements for this user
   - Add achievement: title (required), description (optional), year (optional number)
   - Edit, delete per achievement
   - API: POST/PUT/DELETE /api/users/me/achievements

TEACHER ACCOUNTS: show sections 1, 2, 4, 5 only (skip academic info section).

Create GET/PATCH /api/users/me route (new) that returns full user profile including
achievements, grade level name, subtype name, section name (joined from tables).
```

---

## PHASE 5 — CAMPAIGN & POSTS

### P10 · Campaign Posting System

```
Create a campaign/posting feature that lets users create rich posts tied to elections
or posted publicly.

NEW PAGES:
- src/app/feed/page.tsx — public/global feed (shows public posts + posts from user's visible elections)
- Add "Feed" to Sidebar nav: href="/feed", icon = Newspaper from lucide-react

POST EDITOR (used in feed page and candidate profile):
Create src/components/PostEditor.tsx — a block-based rich text editor:

TOOLBAR (inline, appears on text selection):
  Bold, Italic, Underline, Strikethrough, text size (Normal/Heading/Subheading)

BLOCK SYSTEM:
- Each "block" is a line/paragraph
- Every empty block shows a "+" button on the left
- Clicking "+" opens a block type picker:
    📷 Upload Image (image/*, max 25MB, uploads to Vercel Blob, renders inline)
    🎬 Upload Video (video/mp4 etc., max 25MB, uploads to Vercel Blob, renders with <video> player)
    🔗 Embed Video URL — input for YouTube/TikTok/Google Drive/Facebook video links:
         - YouTube: convert to youtube.com/embed/VIDEO_ID and render in <iframe>
         - TikTok: use TikTok oEmbed API or render as <blockquote data-video-id>
         - Google Drive: convert share URL to /preview embed URL, render in <iframe>
         - Other: render as <iframe src={url}> with sandbox
    🖼️ Embed Image URL — renders image inline (not as hyperlink)

Content stored as JSON array of blocks: [{ type: 'text'|'image'|'video'|'embed', content: string }]
Serialized to TEXT column (posts.content).

POST CREATION MODAL/PAGE:
- Audience toggle: "Public" or "For Election: [dropdown of elections user is in or all for admins]"
- Post editor
- Submit button

POST CARD (src/components/PostCard.tsx):
Renders a post with:
  - Author name, avatar, timestamp
  - Rich content (text blocks + media blocks rendered)
  - Reaction button: heart icon + count. Click toggles own reaction.
    POST /api/posts/[id]/react  (type: 'heart')
  - Comment button: shows comment count, click expands inline comment thread
  - Report button (⋯ menu): opens report reason modal
    POST /api/posts/[id]/report

COMMENT THREAD (inline, below post card):
- Load top 3 comments by default, "View all" to expand
- Text input + submit to add comment
- POST /api/posts/[id]/comments

API ROUTES:
  GET    /api/posts?electionId=X&page=1            (feed, filtered by visibility)
  POST   /api/posts                                (create)
  DELETE /api/posts/[id]                           (author or admin only)
  POST   /api/posts/[id]/react
  DELETE /api/posts/[id]/react
  GET    /api/posts/[id]/comments
  POST   /api/posts/[id]/comments
  DELETE /api/posts/[id]/comments/[commentId]
  POST   /api/posts/[id]/report

FEED VISIBILITY RULES (same as election visibility):
  - Public posts: visible to all authenticated users
  - Election posts: visible only to users who can see that election
  - Unverified students: only see public posts

ADMIN REPORTED POSTS DASHBOARD:
src/app/admin/reports/page.tsx
- List post_reports with status='pending'
- Each row: reporter, post preview, reason, "View Post" link, "Delete Post" button, "Dismiss" button
- Add to Sidebar under admin section: href="/admin/reports", label="Reports", icon=Flag
```

---

### P11 · Candidate Profile Pages

```
Create public candidate profile pages visible during and after elections.

NEW PAGE: src/app/elections/[id]/candidates/[candidateId]/page.tsx

LAYOUT:
1. HEADER — candidate photo (or initials avatar), name, position running for, election name

2. ABOUT — bio (existing candidates.bio field), can be rich text if candidate.user_id is set

3. ACHIEVEMENTS — if candidate has a linked user (candidate.user_id), show their
   user_achievements list. Fetch from GET /api/users/[id]/achievements (new public route).

4. CAMPAIGN POSTS — posts where author_id = candidate.user_id AND election_id = this election,
   rendered using PostCard components. Fetch from GET /api/posts?userId=X&electionId=Y.
   If no user linked, skip this section.

5. Back button → returns to election page

LINK FROM ELECTION PAGE:
In src/app/elections/[id]/page.tsx, in the candidate voting card:
- Make the candidate name/photo a link to /elections/[id]/candidates/[candidateId]
- Keep the vote selection click behavior on the card itself (not navigating)
  — use a separate "View Profile" small link instead

ADMIN CANDIDATE MANAGEMENT — link candidates to users:
In src/app/admin/elections/page.tsx candidate add/edit modal:
- Add optional "Link to User Account" search field
- Search students/teachers matching election eligibility
- When linked, candidate.user_id is set
- Candidate name/bio/photo auto-populate from user record but are editable
```

---

## PHASE 6 — CODE QUALITY

### P12 · Install lucide-react + Extract Shared Components

```
STEP 1 — install icon library:
  npm install lucide-react

STEP 2 — create shared components:

src/components/ui/Logo.tsx:
  Extract the LogoIcon SVG from src/app/page.tsx and src/app/register/page.tsx into a
  shared component. Both files define identical SVGs — remove from both, import from Logo.

src/components/ui/StatusBadge.tsx:
  Extract StatusBadge from src/app/dashboard/page.tsx and src/app/elections/[id]/page.tsx
  into a shared component. Props: { status: 'draft' | 'active' | 'ended' }

STEP 3 — replace inline SVGs with lucide-react:
Map and replace all hand-crafted inline SVG icon functions across src/:
  EnvelopeIcon → Mail
  EyeIcon open/closed → Eye / EyeOff
  ArrowLeftIcon → ArrowLeft
  Calendar SVG → Calendar
  Users SVG → Users
  CheckCircle SVG → CheckCircle
  Warning triangle → AlertTriangle
  Document/file SVG → FileText
  Settings cog → Settings
  ChevronRight SVG → ChevronRight
  Shield SVG in nav → ShieldCheck
  GridLayout SVG (dashboard icon) → LayoutDashboard
  Vote/ballot SVG → Vote (or ListChecks)

Standard sizes: size={16} for small inline, size={20} for nav/buttons, size={24} for headers.
Remove every inline SVG function component after replacement.
Keep Logo.tsx (brand shield) — it's custom, not replaceable.

STEP 4 — fix Quick Actions emoji icons in src/app/dashboard/page.tsx:
Replace: 👥 → Users, 🗳️ → Vote, 📋 → ClipboardList, ⚙️ → Settings
Update quickActions type from { icon: string } to { icon: React.ReactNode }.
```

---

### P13 · Performance & Mobile UX

```
SKELETON SCREENS:
Create src/components/ui/Skeleton.tsx:
  export function Skeleton({ className }: { className?: string }) {
    return <div className={`animate-pulse rounded-md bg-gray-200 ${className ?? ''}`} />
  }

Replace spinner-only loading states with skeletons:
1. src/app/dashboard/page.tsx — skeleton: 4 stat card boxes (h-20) + 3 election card placeholders (h-40)
2. src/app/elections/[id]/page.tsx — skeleton: title bar + 2 position card placeholders
3. src/app/admin/users/page.tsx — skeleton: 6 table row placeholders
4. src/app/admin/verifications/page.tsx — skeleton: 4 card placeholders
5. src/app/feed/page.tsx (new) — skeleton: 3 post card placeholders
Keep the full-screen spinner in Layout.tsx (auth-gate) — correct use, leave it.

FIX N+1 FETCH on dashboard:
In src/app/api/elections/route.ts GET, when the authenticated user is a student:
  Join votes table: LEFT JOIN votes v ON v.election_id = e.id AND v.voter_id = ?
  Return hasVoted: v.id IS NOT NULL as a field on each election object.
In src/app/dashboard/page.tsx fetchData:
  Remove the Promise.all(activeElections.map(fetch hasVoted)) block entirely.
  Use the hasVoted field returned from the elections list call instead.

MOBILE BOTTOM NAV:
Create src/components/BottomNav.tsx — fixed bottom bar, md:hidden only:
  4 items: Dashboard (LayoutDashboard), Feed (Newspaper), Elections (Vote), 
           Profile (UserCircle) — always shown
  If isAdmin: replace Profile slot with a "More" button (Menu icon) that opens sidebar
  Active item: text-[#84050C], inactive: text-gray-400
  Height: 56px, bg-white border-t border-gray-200, icon w-5 h-5 + 10px label
In Layout.tsx:
  Render <BottomNav /> after <main>
  Add pb-16 md:pb-0 to main content area

OTP INPUT MOBILE:
In src/components/ui/OTPInput.tsx:
  Add inputMode="numeric", pattern="[0-9]*" to each digit input
  Add autoComplete="one-time-code" on first input only

CURSOR + TRANSITIONS:
  StatCardItem in dashboard: add cursor-pointer when card.href is set
  All card hover transitions: ensure transition-shadow duration-200 is explicit
```

---

### P14 · Split Admin Elections Page

```
src/app/admin/elections/page.tsx is 868 lines. Refactor without changing any logic:

Extract into:
  src/components/admin/elections/ElectionList.tsx     — table/card of all elections
  src/components/admin/elections/ElectionFormModal.tsx — create/edit modal + eligibility builder
  src/components/admin/elections/PositionManager.tsx   — position CRUD within election
  src/components/admin/elections/CandidateManager.tsx  — candidate CRUD + user link search

Keep src/app/admin/elections/page.tsx as thin orchestrator:
  - Holds state (selectedElection, modalOpen, etc.)
  - Passes state and callbacks as props to the 4 components
  - Each extracted file should be < 250 lines

Do not change API call signatures, existing logic, or visual output.
```
