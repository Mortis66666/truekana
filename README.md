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

`getUser()` returns the current authenticated user, or `null` when nobody is signed in. The account control also listens to `supabase.auth.onAuthStateChange(...)`, so it updates immediately after sign-in or sign-out. Use the `/login` page to create an account, sign in with email and password, or continue with Google.

### Google sign-in setup

Google sign-in uses Supabase OAuth and requires configuration in both Google
Cloud and Supabase:

1. In Google Cloud Console, create an OAuth 2.0 Web application client.
2. Add the Supabase callback URL shown in Supabase under
   **Authentication → Providers → Google** to the Google client's authorized
   redirect URIs.
3. Copy the Google client ID and secret into the Supabase Google provider
   settings and enable the provider.
4. In **Authentication → URL Configuration**, set the production Site URL and
   add the production login URL to Redirect URLs:
   `https://your-domain.example/login`
5. Keep a localhost redirect for local development if needed:
   `http://localhost:3000/login`

The login page passes the current origin as `redirectTo` and preserves a safe
relative `next` path, so users return to the page they originally requested.

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
