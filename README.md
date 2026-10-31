# True Kana

TrueKana is a Japanese kanji drilling app. It supports predefined JLPT decks,
user-owned study sets, and per-study-set spaced repetition progress.

## Supabase auth

The browser client reads `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from `.env.local`. The local Vercel environment already provides these values; for another environment, add them there and restart Next.js.

The account control in the header demonstrates the two common client-side checks:

```ts
import { getSupabaseClient } from "@/lib/supabase/client";

const { data: { user } } = await getSupabaseClient().auth.getUser();
const isLoggedIn = Boolean(user);
```

`getUser()` returns the current authenticated user, or `null` when nobody is signed in. The account control also listens to `supabase.auth.onAuthStateChange(...)`, so it updates immediately after sign-in or sign-out. Use the `/login` page to create an account or sign in with email and password.

## Database setup

Run [`supabase/migrations/0001_study_sets.sql`](./supabase/migrations/0001_study_sets.sql)
in Supabase before using persisted study sets. It creates the predefined decks,
cards, study sets, sparse progress table, RLS policies, and the `review_card`
function. Then run `npm run sync:jlpt` with `SUPABASE_URL` and
`SUPABASE_SERVICE_ROLE_KEY` set to import the bundled JLPT cards. The service
role key is only used by this server-side import script and must not be exposed
as a `NEXT_PUBLIC_` variable.

For an existing installation, also run
[`supabase/migrations/0002_simple_review_mode.sql`](./supabase/migrations/0002_simple_review_mode.sql).
It adds the deferred-next-session progress state and updates the review
function. Study sets can use either `srs` or `simple` review mode. In `simple`
mode, correct and wrong answers independently support never returning, the next
session, the next day, or a fixed delay in minutes.

The authenticated API endpoints are:

- `GET /api/decks`
- `GET|POST /api/study-sets`
- `GET|PATCH|DELETE /api/study-sets/:id`
- `GET /api/study-sets/:id/queue`
- `POST /api/study-sets/:id/review` with `{ "cardId": "...", "correct": true }`

Route requests require the Supabase access token in an `Authorization: Bearer`
header. The browser drill continues to work from the bundled JSON files when no
user is signed in, and saves reviews to the active study set when authenticated.

Signed-in users can manage persistent study sets through `/dashboard`, create
one at `/study-sets/new`, continue a set at `/study-sets/:id`, and edit its
deck selection and per-set study settings at `/study-sets/:id/settings`.
Decks are grouped by their database `category`, so adding future sources such
as Hiragana, Frequency, or Kanken does not require changing the selection UI.
