# Supabase setup — Mini Crossword

Follow these steps to connect the app to Supabase so puzzles can be saved and loaded from the database.

---

## Step 1: Create a Supabase account and project

1. Go to **[supabase.com](https://supabase.com)** and sign up or log in.
2. Click **New project**.
3. Choose your **organization** (or create one).
4. Fill in:
   - **Name:** e.g. `mini-crossword`
   - **Database password:** Choose a strong password and **save it** (you need it for direct DB access; the app uses the anon key, not this password).
   - **Region:** Pick one close to you.
5. Click **Create new project** and wait until the project is ready (green status).

---

## Step 2: Get your project URL and anon key

1. In the left sidebar, open **Project Settings** (gear icon at the bottom).
2. Click **API** in the left menu.
3. On the API page you’ll see:
   - **Project URL** — e.g. `https://xxxxxxxxxxxx.supabase.co`
   - **Project API keys** — use the **anon** **public** key (starts with `eyJ...`; do **not** use the `service_role` key in the browser).
4. Keep this tab open; you’ll paste these into `.env` in Step 4.

---

## Step 3: Create the `puzzles` table and RLS

1. In the left sidebar, open **SQL Editor**.
2. Click **New query**.
3. Copy the entire SQL block below and paste it into the editor.
4. Click **Run** (or press Cmd/Ctrl + Enter).
5. You should see “Success. No rows returned.” The table and policies are now created.

```sql
create table if not exists public.puzzles (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  creator text default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  rows smallint not null check (rows >= 1 and rows <= 15),
  cols smallint not null check (cols >= 1 and cols <= 15),
  grid jsonb not null,
  clues jsonb not null default '{}',
  answers jsonb not null default '{}',
  acrostic boolean not null default false
);

create index if not exists puzzles_updated_at_desc on public.puzzles (updated_at desc);

alter table public.puzzles enable row level security;

drop policy if exists "Allow anon read" on public.puzzles;
create policy "Allow anon read" on public.puzzles for select using (true);

drop policy if exists "Allow anon insert" on public.puzzles;
create policy "Allow anon insert" on public.puzzles for insert with check (true);

drop policy if exists "Allow anon update" on public.puzzles;
create policy "Allow anon update" on public.puzzles for update using (true);
```

---

## Step 4: Add credentials to your app

1. In your project folder, copy the example env file:
   - **Mac/Linux:** `cp .env.example .env`
   - **Or:** Create a new file named `.env` in the project root.
2. Open `.env` in your editor.
3. Replace the placeholders with your real values:
   - `VITE_SUPABASE_URL` = **Project URL** from Step 2 (e.g. `https://xxxxxxxxxxxx.supabase.co`).
   - `VITE_SUPABASE_ANON_KEY` = **anon public** key from Step 2 (the long `eyJ...` string).
4. Save the file. Do **not** commit `.env` to git (it should be in `.gitignore`).

Example `.env`:

```
VITE_SUPABASE_URL=https://abcdefghijk.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Step 5: Run the app

1. Restart the dev server if it’s already running (`npm run dev`).
2. Open the app: **Create** → you should see “Puzzles” in the left pane (empty at first). Create a puzzle and click **Save to database**; it should appear in the list. **Solve** → you should see “Puzzles from database” and be able to open a puzzle by ID.

If you see “Could not load puzzles” or “Supabase not configured”, double-check that `.env` has the correct URL and anon key and that you restarted the dev server.
