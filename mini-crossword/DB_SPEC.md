# Database spec — Mini Crossword

Used with Supabase. Schema and RLS for human inspection and editing.

---

## Table: `puzzles`

| Column       | Type      | Description |
|-------------|-----------|-------------|
| `id`        | `uuid`    | Primary key, default `gen_random_uuid()` |
| `title`    | `text`    | Puzzle title (max 25 chars in app) |
| `creator`  | `text`    | Creator display name (max 50 chars); optional, show as "Anonymous" if blank |
| `created_at` | `timestamptz` | Set on insert, default `now()` |
| `updated_at` | `timestamptz` | Set on insert/update, default `now()` |
| `rows`     | `int2`    | Grid row count |
| `cols`     | `int2`    | Grid column count |
| `grid`     | `jsonb`   | 2D array of booleans: `[[false,true,...],...]` (row-major, true = black) |
| `clues`    | `jsonb`   | Object: `{ "1-across": "Clue text", ... }` |
| `answers`  | `jsonb`   | Object: `{ "1-across": "ANSWER", ... }` (uppercase) |
| `acrostic` | `boolean` | If true, only across clues are used |

Indexes (optional but useful):

- `puzzles_updated_at_desc` on `(updated_at DESC)` for list ordering.

---

## Row Level Security (RLS)

- **v1:** No per-user auth. Use permissive policies so the app can read/write with the anon key:
  - `SELECT`: allow all (anon).
  - `INSERT`: allow all (anon).
  - `UPDATE`: allow all (anon).
  - `DELETE`: no policy (out of scope for v1; no delete).

If you prefer to lock down later: restrict `INSERT`/`UPDATE` to a role or add auth.

---

## SQL to create the table (Supabase SQL editor)

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

-- Optional index for list order
create index if not exists puzzles_updated_at_desc on public.puzzles (updated_at desc);

-- RLS: enable and allow anon read/write for v1
alter table public.puzzles enable row level security;

drop policy if exists "Allow anon read" on public.puzzles;
create policy "Allow anon read" on public.puzzles for select using (true);

drop policy if exists "Allow anon insert" on public.puzzles;
create policy "Allow anon insert" on public.puzzles for insert with check (true);

drop policy if exists "Allow anon update" on public.puzzles;
create policy "Allow anon update" on public.puzzles for update using (true);
```

---

## App ↔ DB mapping

- **List:** `select id, title, creator, created_at, updated_at from puzzles order by updated_at desc limit 100`
- **Get by ID:** `select * from puzzles where id = $1`
- **Create:** `insert into puzzles (title, creator, rows, cols, grid, clues, answers, acrostic) values (...) returning *`
- **Update:** `update puzzles set title, creator, rows, cols, grid, clues, answers, acrostic, updated_at = now() where id = $1`

The app uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the frontend. If these are missing, the app still runs but DB operations fail (show error messages).
