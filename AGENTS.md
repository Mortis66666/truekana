<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# AGENTS.md

Guidance for AI coding agents and contributors working on this project.

## Project overview

A Japanese kanji drilling web app. Users pick from predefined **decks** (e.g. JLPT N5, N4, N3), combine any number of them into their own **study set**, and study the cards with a simplified spaced-repetition system (SRS). All progress is saved per study set, and how often cards reappear is controlled by per-study-set user preferences.

## Tech stack

- **Frontend / backend:** Next.js (App Router). API logic lives in Route Handlers under `app/api/**/route.ts`.
- **Database + Auth:** Supabase (Postgres, Supabase Auth, Row Level Security).
- **Client library:** `@supabase/supabase-js`.
- **Language:** TypeScript.

## Terminology (important, keep consistent)

| Term          | Meaning                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| **Card**      | One kanji with its readings, meaning and deck. The unit of study.                                       |
| **Deck**      | A predefined, read-only collection of cards (e.g. "JLPT N3"). Seeded by admins; users cannot edit them. |
| **Study set** | A user-owned collection built by combining one or more decks. Holds settings and all progress.          |
| **Progress**  | A user's SRS state for one card within one study set.                                                   |

Do not use "session" for study sets: Supabase Auth already has sessions (JWTs) and the names will collide.

## Data model

```
auth.users (managed by Supabase)
   │
   └── study_sets ──< study_set_decks >── decks ──< cards
          │
          └──< progress >── cards
```

### `decks` (predefined, read-only to users)

| Column        | Type      | Notes            |
| ------------- | --------- | ---------------- |
| `id`          | `text` PK | e.g. `jlpt-n3`   |
| `name`        | `text`    | display name     |
| `description` | `text`    | optional         |
| `sort_order`  | `int`     | display ordering |

### `cards` (static reference data)

| Column    | Type                    | Notes                                        |
| --------- | ----------------------- | -------------------------------------------- |
| `id`      | `text` PK               | e.g. `n3_0123`                               |
| `deck_id` | `text` FK → `decks(id)` | each card belongs to one deck                |
| `kanji`   | `text`                  | not null                                     |
| `meaning` | `text`                  | glosses separated by `;`                     |
| `reading` | `text[]`                | one row per card, readings as a native array |

### `study_sets` (user-created)

| Column       | Type                         | Notes                       |
| ------------ | ---------------------------- | --------------------------- |
| `id`         | `uuid` PK                    | default `gen_random_uuid()` |
| `user_id`    | `uuid` FK → `auth.users(id)` | `on delete cascade`         |
| `name`       | `text`                       | e.g. "My N3+N4 set"         |
| `settings`   | `jsonb`                      | see Settings below          |
| `created_at` | `timestamptz`                | default `now()`             |

### `study_set_decks` (which decks a study set combines)

| Column         | Type                         | Notes               |
| -------------- | ---------------------------- | ------------------- |
| `study_set_id` | `uuid` FK → `study_sets(id)` | `on delete cascade` |
| `deck_id`      | `text` FK → `decks(id)`      |                     |

Primary key: `(study_set_id, deck_id)`.

### `progress` (sparse: a row exists only once a card has been reviewed)

| Column          | Type                         | Notes                                                 |
| --------------- | ---------------------------- | ----------------------------------------------------- |
| `study_set_id`  | `uuid` FK → `study_sets(id)` | `on delete cascade`                                   |
| `card_id`       | `text` FK → `cards(id)`      |                                                       |
| `user_id`       | `uuid` FK → `auth.users(id)` | denormalised so RLS is a simple column check          |
| `status`        | `smallint`                   | last result: `0` = wrong, `1` = correct               |
| `due`           | `timestamptz`                | when the card is next shown; `infinity` = never again |
| `interval_days` | `real`                       | current review gap                                    |
| `ease_factor`   | `real`                       | interval multiplier, default 2.5, floor 1.3           |
| `reps`          | `integer`                    | consecutive correct answers                           |
| `lapses`        | `integer`                    | total failures                                        |
| `last_reviewed` | `timestamptz`                |                                                       |

Primary key: `(study_set_id, card_id)`. A missing row means the card is **unseen** (new).

Indexes: `progress (user_id)`, `progress (study_set_id, due)`.

### Design principles

- **Sparse progress.** Never write placeholder rows for unseen cards. Adding new cards or decks later requires no backfill.
- **Progress is per study set.** The same card in two study sets has independent progress.
- **Card membership is derived.** A study set's cards are all cards whose `deck_id` is in its `study_set_decks`. Removing a deck from a study set does not delete progress rows; they are simply ignored by queries and reappear if the deck is re-added.
- **Readings are an array, not rows.** One card = one row. Only normalise into a `card_readings` table if per-reading metadata (on'yomi vs kun'yomi, example sentences) is ever needed.

## Settings (`study_sets.settings`)

```json
{
  "reviewMode": "srs",
  "wrongRetryMinutes": 10,
  "shuffle": true,
  "collectRandomly": true,
  "showReadingFirst": false
}
```

`reviewMode` controls whether cards appear again:

| Mode            | Correct answer                                    | Wrong answer                                      |
| --------------- | ------------------------------------------------- | ------------------------------------------------- |
| `srs` (default) | reappears on its due date, with growing intervals | reappears after `wrongRetryMinutes`, ease drops   |
| `wrong_only`    | never reappears (`due = infinity`)                | keeps reappearing until answered correctly        |
| `once`          | never reappears                                   | never reappears (it is recorded but not repeated) |

Keep settings in `jsonb` while they are small and change often. If a setting needs to be filtered or indexed in SQL, promote it to a real column.

When `collectRandomly` is enabled, new cards are selected randomly from all
decks included in the study set. It defaults to `true`.

## Core queries

**Cards in a study set**

```sql
select c.*
from cards c
join study_set_decks sd
  on sd.deck_id = c.deck_id and sd.study_set_id = $1;
```

**Full status of every card (new + seen)**

```sql
select c.id, c.kanji, coalesce(p.status, -1) as status  -- -1 = unseen
from cards c
join study_set_decks sd
  on sd.deck_id = c.deck_id and sd.study_set_id = $1
left join progress p
  on p.card_id = c.id and p.study_set_id = $1;
```

**Due reviews** (cards with `due = infinity` are naturally excluded)

```sql
select c.*, p.due
from progress p
join cards c on c.id = p.card_id
join study_set_decks sd
  on sd.deck_id = c.deck_id and sd.study_set_id = p.study_set_id
where p.study_set_id = $1 and p.due <= now()
order by p.due
limit $2;  -- internal batch size
```

**New cards** (never seen), loaded in internal batches

```sql
select c.*
from cards c
join study_set_decks sd
  on sd.deck_id = c.deck_id and sd.study_set_id = $1
where not exists (
  select 1 from progress p
  where p.study_set_id = $1 and p.card_id = c.id
)
order by c.id
limit $2;
```

## Reviewing a card

All scheduling logic lives in one Postgres function, `review_card(p_study_set uuid, p_card text, p_correct boolean)`. It reads the study set's `reviewMode` and relevant behavior settings, computes the next `interval_days`, `ease_factor`, `reps`, `lapses` and `due`, and upserts into `progress` with `on conflict (study_set_id, card_id)`.

Simplified SRS rules for `srs` mode:

- Correct: `reps + 1`. Interval is 1 day on the first rep, 3 days on the second, then `round(interval_days * ease_factor)`.
- Wrong: `reps = 0`, `interval_days = 0`, `ease_factor = max(1.3, ease_factor - 0.2)`, `lapses + 1`, `due = now() + wrongRetryMinutes`.

The function is `security invoker` so RLS applies. Call it from the app with:

```ts
await supabase.rpc('review_card', {
  p_study_set: studySetId,
  p_card: cardId,
  p_correct: true,
});
```

The UI is currently two-button (Wrong / Correct). A four-grade system (Again/Hard/Good/Easy) would only require a `p_grade` parameter and different multipliers; no table changes.

## Security (Row Level Security)

RLS must be enabled on every table in `public`.

- `decks`, `cards`: select-only for authenticated users. No insert/update/delete policies (writes happen via the service role).
- `study_sets`: `for all` using `auth.uid() = user_id`, with check `auth.uid() = user_id`.
- `study_set_decks`: `for all` where the parent study set belongs to `auth.uid()` (check via `exists` on `study_sets`).
- `progress`: `for all` using `auth.uid() = user_id`; the `with check` must also verify the study set belongs to the user:

```sql
with check (
  auth.uid() = user_id
  and exists (
    select 1 from study_sets s
    where s.id = study_set_id and s.user_id = auth.uid()
  )
)
```

Rules for agents:

- Never trust a `user_id` sent from the client. Derive it from `auth.uid()` or the authenticated session.
- The **service role key must never reach the browser**. Use it only in local admin scripts or server-only code. Never prefix it with `NEXT_PUBLIC_`.
- Do not disable RLS to "make something work"; fix the policy instead.

## Frontend

- Flashcard component: front shows the kanji, back shows readings (one chip per array element), meaning (split on `;` into a list) and the deck/level badge.
- Give the card component `key={card.id}` (or reset flip state) so the next card does not appear pre-flipped.
- Answer buttons on the back of the card call `review_card`.
- Client components that use state or the Supabase browser client need `'use client'`.

## API structure (Next.js App Router)

```
app/api/
  study-sets/
    route.ts                    GET list, POST create (name, deckIds, settings)
    [id]/
      route.ts                  GET, PATCH (name, settings, decks), DELETE
      queue/route.ts            GET next cards: due reviews + new cards
      review/route.ts           POST { cardId, correct } -> review_card
  decks/route.ts                GET list of predefined decks
```

- File must be named exactly `route.ts`; export functions named after HTTP verbs.
- In Next.js 15+, `params` is a Promise: `const { id } = await params;`.
- A route segment cannot contain both `route.ts` and `page.tsx`.

## Importing card data

Do **not** hand-write or hand-escape CSVs for this data. The Supabase dashboard CSV importer can silently turn `text[]` values into `NULL`.

Use a one-off Node script with the service role key, passing `reading` as a real JS array, and `upsert` in chunks (about 500 rows):

```js
await supabase
  .from('cards')
  .upsert(batch.map(c => ({ id: c.id, reading: c.reading })), { onConflict: 'id' });
```

An upsert with a partial payload only updates the columns provided. Test on a few rows first.

## Conventions

- Primary keys: `uuid` for user-owned data, readable `text` ids for static reference data (`jlpt-n3`, `n3_0123`).
- All user-owned tables reference `auth.users(id)` with `on delete cascade`.
- Keep `public.profiles` (id = `auth.users.id`) for extra user fields only if needed; do not duplicate `auth.users`.
- Schema changes go through SQL migrations run inside a transaction.

## Pending work / migration notes

The schema previously used `decks` for user-created sets and `progress.deck_id`. These need to be migrated to the model above:

1. Rename the old user `decks` table to `study_sets`; rename `progress.deck_id` to `study_set_id`.
2. Create the new predefined `decks` table and seed one deck per JLPT level.
3. Add `cards.deck_id` (backfill from the old `cards.level`), then drop `level`.
4. Create `study_set_decks` and backfill it from the old `study_sets.levels` array, then drop `levels`.
5. Update `review_card` to take `p_study_set` and honour `reviewMode`.
6. Update RLS policies as described in Security.

## Possible future additions

- Four-grade SRS (Again/Hard/Good/Easy).
- Per-user timezone in settings for "new cards per day" resets.
- Hand-picked individual cards in a study set (a `study_set_cards` table alongside `study_set_decks`).
- `card_readings` table for on'yomi/kun'yomi metadata and example sentences.
- Realtime sync of progress across devices via Supabase Realtime on `progress`.