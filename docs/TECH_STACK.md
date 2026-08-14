# Tech Stack — Explained Simply

This page explains **every technology** used in the project and **why** we chose
it. No prior experience assumed. Think of the website like a restaurant:

- the **front end** is the dining area customers see and touch,
- the **back end** is the kitchen that does the real work,
- the **database** is the storeroom where everything is kept.

---

## The big picture

```
   Your browser  ⇄  Next.js (front end + back end)  ⇄  Supabase (PostgreSQL database)
   (React pages)      runs on Node.js                    stores users, votes, etc.
                          │
                          ├─ nodemailer  → sends OTP emails
                          ├─ Vercel Blob → stores uploaded images/videos
                          └─ bcrypt + JWT → keeps logins secure
```

---

## Languages

### TypeScript
The programming language the whole project is written in. It is **JavaScript
with type-checking added** — you tell the computer "this value is a number" or
"this is text", and it warns you *before* you run the code if you make a mistake
(like putting text where a number belongs). This catches many bugs early.
*File extensions:* `.ts` (logic) and `.tsx` (logic + on-screen layout).

### HTML & CSS
HTML is the **structure** of a page (headings, buttons, boxes). CSS is the
**styling** (colors, spacing, fonts). In this project we rarely write them by
hand — React and Tailwind generate them for us (see below).

---

## Front end (what the user sees)

### React 18
A library for building user interfaces out of **components** — small, reusable
pieces like a button, a card, or a navigation bar. You build a page by snapping
components together like LEGO. When data changes, React automatically re-draws
only the parts that changed.

### Next.js 14 (App Router)
The **framework** built on top of React that ties everything together. It is
"full-stack", meaning it handles **both** the front end (pages) **and** the back
end (server code) in one project. Two things make it special here:
- **File-based routing:** the folder path *is* the web address. A page at
  `src/app/elections/page.tsx` automatically becomes the URL `/elections`.
- **API routes:** a file named `route.ts` becomes a back-end endpoint the pages
  can call (for example, "save this vote").

### Tailwind CSS
A styling toolkit. Instead of writing separate CSS files, you add short
utility classes right on the element — e.g. `class="text-red-600 p-4"` means
"red text, padding 4". It makes consistent, responsive design fast, including
the **mobile bottom navigation bar** used on phones.

### Lucide React
A set of clean, ready-made **icons** (the little pictures on buttons and menus).

### @vladmandic/face-api
An **optional** face-recognition library that runs **entirely inside the
browser** (the server never sees your face). It turns a face from the webcam
into a list of 128 numbers (a "descriptor") and compares two faces by how close
those numbers are. Used as an extra identity check. The model files it needs are
bundled in `public/models`, so it works offline.

---

## Back end (the server / the kitchen)

### Node.js
The program that **runs** JavaScript/TypeScript outside a browser — it powers
the whole server side. When you type `npm run dev`, Node.js is what starts.

### Next.js API Routes
The back-end endpoints (files named `route.ts`). Each one receives a request
(e.g. "log me in", "cast this vote"), does the work, talks to the database, and
sends back an answer — usually as **JSON** (a simple text format for data).

### npm
The **package manager** for Node.js. `npm install` downloads all the libraries
the project depends on (listed in `package.json`) into the `node_modules` folder.

---

## Database (the storeroom)

### PostgreSQL
A powerful, reliable **relational database** — data lives in tables with rows
and columns (like linked spreadsheets). It stores users, elections, positions,
candidates, votes, posts, and more.

### Supabase
A cloud service that **hosts** our PostgreSQL database online, so it's always
available and we don't run a database server ourselves. Free tier is enough for
a school project.

### node-postgres (`pg`)
The library the code uses to **talk to** PostgreSQL from Node.js — it sends the
SQL commands and returns the results.

> **History note:** the project originally used **Turso (SQLite)** and was later
> migrated to **Supabase (PostgreSQL)**. The database code in `src/lib/db.ts`
> keeps a small "translation shim" from that migration so the rest of the app
> didn't have to be rewritten.

---

## Security

### bcryptjs
Scrambles ("**hashes**") passwords before they are stored, so the database never
holds the real password. Even the developers can't read it. Logging in re-hashes
what you typed and compares the scrambles.

### jose (JWT)
Creates a **JSON Web Token** — a tamper-proof digital "wristband" given to you
after you log in. It's stored in a secure cookie your browser sends with every
request, so the server knows it's really you without asking for your password
again. Because the cookie is *HttpOnly*, page scripts can't steal it.

### Two-Factor Authentication (2FA)
Logging in needs **two** proofs: (1) your password, and (2) a **one-time code
(OTP)** sent to your email. Knowing the password alone isn't enough.

### nodemailer
The library that **sends the OTP emails**. If email isn't configured while
testing, the code is returned in the response instead so you can still log in.

---

## Storage & Hosting

### Vercel Blob
Cloud **file storage** for uploaded images and videos (ID photos, avatars,
candidate photos, post media). The database stores only the *link* to each file.

### Vercel
The cloud platform the finished site is **deployed** (published) to. Every time
new code is pushed to the project's main branch, Vercel automatically rebuilds
and publishes the updated site.

### Git & GitHub
**Git** records the history of every code change (so you can undo mistakes and
see who changed what). **GitHub** stores that history online and is where Vercel
pulls the code from.

---

## Developer tools

### Visual Studio Code (VS Code)
The **code editor** used to write and edit the project.

### PostCSS & Autoprefixer
Behind-the-scenes tools that process the CSS Tailwind generates so it works
across all browsers. You never touch them directly.

---

## One-line summary of each

| Technology | One-line role |
|-----------|----------------|
| TypeScript | The language everything is written in (JavaScript + safety checks) |
| React 18 | Builds the on-screen interface from reusable components |
| Next.js 14 | Framework running both the pages and the server code |
| Tailwind CSS | Fast, responsive styling with utility classes |
| Lucide React | Icon set |
| face-api | Optional in-browser face verification |
| Node.js | Runs the server-side code |
| PostgreSQL | The database that stores all data |
| Supabase | Cloud host for the PostgreSQL database |
| pg | Lets the code talk to PostgreSQL |
| bcryptjs | Hashes (scrambles) passwords |
| jose (JWT) | Signs the secure login token |
| nodemailer | Sends OTP emails for 2FA |
| Vercel Blob | Stores uploaded images/videos |
| Vercel | Hosts/publishes the finished website |
| Git / GitHub | Tracks and stores code history |
