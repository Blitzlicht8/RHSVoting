# RHS E-Voting

A secure online voting website for **Rizal High School** strand elections, with
**Two-Factor Authentication (2FA)**, identity verification, and live results.

Built as a Grade 12 STEM capstone project.

> **New to the project? Read the two guides in [`docs/`](docs/):**
> - **[TECH_STACK.md](docs/TECH_STACK.md)** — what each technology is, in plain words
> - **[CODE_GUIDE.md](docs/CODE_GUIDE.md)** — what every folder, file, and important function does

---

## What you need to run this on your own computer

You only need **three** things to get it running:

| # | Requirement | Why | Where to get it |
|---|-------------|-----|-----------------|
| 1 | **Node.js 18.17+** (20 LTS recommended) + npm | Runs the website | <https://nodejs.org> |
| 2 | The project files | The code itself | This folder (see "Files to hand over" below) |
| 3 | A **PostgreSQL database** connection URL | Stores users, elections, and votes | Free at <https://supabase.com> |

That's it. The database **tables** and a **default admin account** are created
automatically the first time you open the site — you do **not** run any manual
database setup.

Everything else (email sending, image uploads, face verification) is **optional**
and the app runs fine without them while testing.

---

## Setup — step by step

**1. Install Node.js** from <https://nodejs.org> (pick the LTS version). Check it:

```bash
node -v
```

**2. Open a terminal inside this project folder** and install the libraries:

```bash
npm install
```

**3. Create your settings file.** Copy the example and open the new `.env.local`:

```bash
cp .env.example .env.local
```

Then paste your database connection string into `APP_DATABASE_URL`.
(Supabase → your project → **Settings → Database → Connection string → URI**.)
See the comments in `.env.example` for the optional settings.

**4. Start the website:**

```bash
npm run dev
```

**5. Open it** in your browser: <http://localhost:3000>

**6. Log in as the built-in admin** (created automatically):

- **Email:** `admin@localhost.local`
- **Password:** `Admin@123`

> ⚠️ Change this password after your first login for anything real.

---

## Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Runs the site in development mode (auto-reloads on edits) at `localhost:3000` |
| `npm run build` | Compiles a production build (checks the whole project for errors) |
| `npm run start` | Runs the compiled production build (run `build` first) |

---

## Files to hand over (to run it elsewhere)

Give them the **whole project folder EXCEPT** these — they are rebuilt or are
private and should never be shared:

- `node_modules/` — reinstalled by `npm install`
- `.next/` — rebuilt by `npm run dev` / `npm run build`
- `.vercel/` — private hosting link
- `.env` / `.env.local` — **your secrets** (share `.env.example` instead)
- `.git/` — version history (optional to include)

Everything else — `src/`, `public/`, `package.json`, the config files, and
`docs/` — is required.

---

## The optional features (and what turning them off does)

| Feature | Env vars needed | If not set |
|---------|-----------------|------------|
| **OTP email (2FA)** | `EMAIL_*` | The one-time code is shown in the API response instead of emailed, so you can still log in while testing |
| **File uploads** | `BLOB_READ_WRITE_TOKEN` | The app runs, but uploading ID photos / avatars / candidate photos / post images fails |
| **Face verification** | *(none — models are already included in `public/models`)* | Works out of the box; needs a webcam and `localhost` or HTTPS |
| **Signed sessions** | `JWT_SECRET` | Uses a built-in development secret (fine for local testing, not for real use) |

---

## How the project is organized

This uses the standard **Next.js App Router** layout, so the folders follow
Next.js conventions (don't rename them):

```
SchoolVoting/
├─ public/            Static files served as-is (logo, face-recognition models)
├─ src/
│  ├─ app/            Every page and API endpoint (URL = folder path)
│  │  ├─ api/         Back-end endpoints (the server side)
│  │  └─ ...          Front-end pages (dashboard, elections, admin, ...)
│  ├─ components/     Reusable UI building blocks (buttons, modals, nav, ...)
│  ├─ lib/            Shared logic (database, auth, email, permissions, ...)
│  ├─ types/          Shared TypeScript type definitions
│  └─ middleware.ts   Runs before every request (login/redirect guard)
├─ scripts/           One-off maintenance scripts (not needed to run the app)
├─ docs/              Documentation (start here!)
├─ .env.example       Template for your settings — copy to .env.local
├─ package.json       Project name, version, libraries, and commands
└─ ... config files   next.config.js, tailwind.config.js, tsconfig.json, etc.
```

A full file-by-file breakdown is in **[docs/CODE_GUIDE.md](docs/CODE_GUIDE.md)**.
