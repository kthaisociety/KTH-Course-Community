---
status: accepted
---

# Replace SuperTokens with Better Auth, mounted in the NestJS backend

We replaced SuperTokens with Better Auth, running inside the NestJS backend via
`@thallesp/nestjs-better-auth`, and used the migration to collapse the identity
model to a single user id issued by Better Auth. Sessions now live in the app's
own Postgres database through the existing Drizzle setup, so there is no separate
auth service to run, and there is exactly one kind of signed-in person — an
[app user](../../CONTEXT.md) — whose id is used unchanged everywhere.

## Why SuperTokens was replaced

Authentication was harder to understand than the thing it protected.

A signed-in person was represented twice: as an auth user, known only to
SuperTokens under an id that meant nothing anywhere else, and as an app user with
a different id. A `user_auth_identities` mapping table joined them, plus a
fallback path for older rows where the two ids happened to coincide. Every
protected route began by resolving one id into the other before it could do any
work, and no reader could tell at a glance which id they were holding.

The setup also cost more than it returned: a separate SuperTokens core service
reachable over the network, configured through four environment variables across
four files, a SuperTokens client in the browser, a second one inside the Next.js
server, a `serverExternalPackages` entry to keep the bundler quiet, and a Redux
slice whose only job was to mirror session state.

Worst of all, protection was opt-in — a route was public unless somebody
remembered to decorate it. One route had already shipped that way: reviews took
the author's id from the request body, so any visitor could post, edit or delete
a review as any app user. That was not an isolated oversight but the predictable
outcome of a model where forgetting fails open.

## Why authentication lives in the backend

NestJS already owns the Drizzle/Neon database and every guard in the app. Putting
Better Auth in the Next.js frontend would have separated identity from both the
database and the authorisation layer, forcing Nest to re-derive sessions out of
band. Mounting it in Nest keeps one configuration point instead of three client
initialisations that have to stay in sync.

The network topology is unchanged: the browser calls the site origin, and Next.js
rewrites `/api/auth/*` to the Nest mount. `BETTER_AUTH_URL` is therefore
deliberately the *site* origin and not the API's — that is what makes the session
cookie land on the host the browser actually talks to. Repointing it at the API
looks like a correction and silently breaks sign-in in deployment.

## Why identity collapsed to one id

The two-id model was the single largest source of confusion in the codebase, and
removing it was a motivation for the migration rather than a side effect. Better
Auth's user *is* the app user, so the mapping table, the resolution step and the
legacy fallback are all gone, and the favourites and reviews foreign keys point
straight at the Better Auth user table.

The rejected alternative was mapping Better Auth onto the existing `users` table
via `modelName` and `fields`. That would have avoided repointing foreign keys,
but at the price of a permanent indirection between what the configuration says
and what the database contains. A drop-and-recreate was affordable because the
existing users were test users: there was no production data to preserve, and no
backfill, email-relinking or compatibility shim was written.

## Consequences

- **Protection inverts.** The `AuthGuard` is registered globally; routes visitors
  may reach opt out with `@AllowAnonymous()`. Forgetting now fails closed, and
  "this route is public" is an explicit claim you can grep for. The failure mode
  this introduces is the inverse one — 401-ing visitors on pages that should be
  open — which is why public-route reachability is covered by tests.
- **`bodyParser: false`.** The Nest application is created without body parsing so
  Better Auth receives the raw request body; the integration re-adds the default
  parsers for every other route. This affects all `@Body()` routes and the
  multipart profile picture upload, and is the most likely place for breakage far
  from the auth code.
- **Tables are plural.** Better Auth's default naming is singular (`user`,
  `session`, `account`, `verification`); the adapter is configured with
  `usePlural: true` so it matches the rest of the schema.
- **No interactive transactions.** Neon's HTTP driver does not support them, so
  the Drizzle adapter runs with `transaction: false`.
- **One avatar field.** The separate `profilePicture` column is gone; uploads
  write their blob URL to Better Auth's `image` field.
- **`/ai/chat` requires a session.** It spends AI gateway credits per call on a
  public URL. The consequence is that the AI demo page is no longer usable by
  visitors; rate limiting was considered instead and rejected as a new subsystem.
- **The reviews WebSocket gateway stays unauthenticated.** It only joins
  course-code rooms and broadcasts "reviews changed" — nothing user-specific
  crosses it — and it connects cross-origin directly to the backend rather than
  through the Next.js rewrites. Revisit if it ever carries per-user data.
- **Frontend route protection is optimistic.** `frontend/proxy.ts` checks for the
  *existence* of the session cookie and redirects to `/auth` when it is absent; it
  never validates. The backend guards remain the real enforcement.
- **Google is the sole provider.** The UI stubs for other providers keep their
  "not supported yet" behaviour.

This ADR is the intended long-term home for the name "SuperTokens": once the
remnant purge is finished it should be the only place in the repo that mentions
it. At the time of writing one other mention survives, a comment in
`frontend/.env.example` explaining why `NEXT_PUBLIC_WEBSITE_DOMAIN` is still
declared but unread.
