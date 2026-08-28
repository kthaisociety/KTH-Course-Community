# Spec: Replace SuperTokens with Better Auth

**Status:** Ready to implement
**Delivery:** One PR, big-bang cutover. Five sub-issues under this spec.
**Author's intent:** The core replacement is implemented by hand, from Better Auth's own documentation, in order to understand both the library and the authentication flow. Tickets therefore state outcomes, never steps.

---

## Problem Statement

Authentication in this app is harder to understand than the thing it protects.

A person signing in is currently represented twice: as an **auth user**, known only to SuperTokens and identified by an id that means nothing anywhere else, and as an **app user**, known to the app and identified by a different id. A mapping table joins them, and a fallback path exists for older rows where the two ids happened to be equal. Every protected route begins by resolving one id into the other before it can do any work. Nobody reading the code can tell, at a glance, which id they are holding.

The setup also costs more than it should. It depends on a separate SuperTokens core service reachable over the network, configured through four environment variables across four files, plus a SuperTokens client on the browser, a second SuperTokens client inside the Next.js server, and a `serverExternalPackages` entry to keep the bundler happy. Auth state is mirrored into a Redux slice that exists only to hold it.

Worst of all, protection is opt-in. A route is public unless somebody remembers to decorate it. One route already shipped without that decoration: reviews accept the author's id **from the request body**, so any visitor can post, edit or delete a review as any app user. That is not an oversight to patch in isolation — it is the predictable outcome of a model where forgetting fails open.

## Solution

Replace SuperTokens with Better Auth, mounted inside the NestJS backend, and use the migration to collapse the identity model to a single id.

After this change there is one kind of signed-in person — an **app user** — whose id is issued by Better Auth and used unchanged by every part of the app. The mapping table, the resolution step and the legacy fallback all disappear. Sessions live in the app's own Postgres database through the existing Drizzle setup, so the external auth service and its connection settings are gone.

Protection inverts: a global guard covers every route, and routes that visitors may reach say so explicitly. The reviews endpoints take the author's identity from the session rather than the request body, and enforce ownership on update and delete.

On the frontend, the Redux session slice is deleted in favour of Better Auth's own reactive session hook, and the route gate moves out of the render tree into Next.js middleware.

## Domain Language Impact

`CONTEXT.md` currently defines three terms: **auth user**, **app user**, **visitor**.

This spec **retires "auth user"**. There is no longer a separate identity held by the authentication provider and mapped into the app — Better Auth's user *is* the app user, and its id is the app user id. **App user** and **visitor** survive unchanged in meaning, and "app user" loses the clause warning that its id must never be assumed equal to the auth user id.

Updating the glossary is sub-issue 5.

## User Stories

1. As an app user, I want to sign in with my Google account, so that I can use the app without creating another password.
2. As an app user, I want my session to persist across page loads and browser restarts, so that I am not asked to sign in repeatedly.
3. As an app user, I want to sign out, so that my account is not accessible to the next person using this browser.
4. As an app user, I want to see my own name, email and profile picture, so that I can confirm I am signed in as the right person.
5. As an app user, I want to upload a profile picture, so that my reviews are recognisably mine.
6. As an app user, I want my uploaded profile picture to be the one shown, so that my deliberate choice is not silently replaced by my Google avatar.
7. As an app user, I want to favourite and unfavourite courses, so that I can keep track of the ones I care about.
8. As an app user, I want to see my favourites listed, so that I can return to them quickly.
9. As an app user, I want to delete my account, so that I can leave and take my data with me.
10. As an app user, I want to write a review of a course, so that I can share my experience with other students.
11. As an app user, I want my review to be attributed to me automatically, so that I cannot accidentally post under the wrong identity.
12. As an app user, I want to edit only my own reviews, so that my words stay mine.
13. As an app user, I want to delete only my own reviews, so that I control my own contributions.
14. As an app user, I want other people to be unable to post, edit or delete reviews in my name, so that my reputation is not forgeable.
15. As an app user, I want to use the AI course assistant, so that I can find courses conversationally.
16. As a visitor, I want to browse courses without signing in, so that I can evaluate the app before committing to an account.
17. As a visitor, I want to search courses without signing in, so that I can find what I need immediately.
18. As a visitor, I want to read reviews without signing in, so that I can benefit from other students' experiences.
19. As a visitor, I want to be redirected to the sign-in page when I open a page that needs an account, so that I understand what is being asked of me rather than seeing an error.
20. As a visitor, I want to land back on the app after signing in with Google, so that the sign-in feels like one continuous action.
21. As a visitor, I want to see a clear error if sign-in fails, so that I know to try again rather than assuming the app is broken.
22. As a developer, I want one user id used everywhere, so that I never have to ask which kind of id I am holding.
23. As a developer, I want the authentication tables to be exactly what Better Auth's CLI generated, so that the schema matches the library's documentation with no mapping layer in between.
24. As a developer, I want new routes to be protected unless I explicitly open them, so that forgetting a decorator fails closed instead of leaking data.
25. As a developer, I want a route's publicness to be an explicit, greppable claim in the code, so that I can audit the public surface in one search.
26. As a developer, I want sessions stored in the app's own database, so that there is no external auth service to run, pay for, or debug.
27. As a developer, I want auth configured from one place in the backend, so that I do not have to reason about three separate client initialisations staying in sync.
28. As a developer, I want the failing test suite to describe the intended behaviour before the implementation exists, so that "done" is a green run rather than a judgement call.
29. As a developer, I want the tests to catch a public route accidentally becoming private, so that switching to a global guard cannot silently lock visitors out.
30. As a developer, I want the AI chat endpoint to require a session, so that an open endpoint on a public URL cannot spend our AI gateway credits.
31. As a developer, I want SuperTokens fully removed — dependencies, environment variables, bundler configuration and documentation — so that no reader is misled about how auth works.
32. As a developer, I want the decision recorded in an ADR, so that a year from now the reasoning is recoverable.
33. As a maintainer, I want a deploy checklist, so that the environment variable and Google console changes are not discovered at merge time.
34. As a maintainer, I want a manual smoke checklist, so that the parts no automated test can reach are still verified before merge.

---

## Implementation Decisions

Each decision records its reasoning, not just its verdict. The core implementation is done by hand from a tutorial; **where the tutorial's approach diverges from a decision here, that is not automatically an error — reopen the decision, argue it against the reasoning below, and record the outcome.** See "Reconciliation" under Further Notes.

### D1 — Better Auth is mounted in the NestJS backend

Better Auth runs inside NestJS via the `@thallesp/nestjs-better-auth` integration. The existing network topology is unchanged: the browser calls the site origin, and Next.js rewrites `/api/auth/*` to the Nest `/auth/*` mount.

*Why:* NestJS already owns the Drizzle/Neon database and every guard in the app. Putting authentication in the Next.js frontend would separate identity from the database and the authorisation layer, forcing Nest to re-derive sessions out of band.

*Known cost, accepted:* the integration requires the Nest application to be created with `bodyParser: false` so Better Auth receives the raw request body. This affects every route using `@Body()` and the multer `FileInterceptor` used for profile picture upload. JSON parsing must be reinstated for non-auth routes.

### D2 — One identity, one id

There is a single id for a signed-in person, issued by Better Auth. The `user_auth_identities` mapping table is dropped, along with the `resolveAppUserId` resolution step and its legacy fallback for rows where the auth id was used as the app id.

*Why:* the two-id model is the single largest source of confusion in the current codebase and a primary motivation for the migration. Simplicity is a goal here, not a side effect.

### D3 — Better Auth's CLI-generated schema is the schema

Better Auth's CLI generates `user`, `session`, `account` and `verification` at the library's default naming. The existing `users` table is dropped. The two foreign keys that referenced it — from user favourites and from reviews — are repointed at the new user table.

The rejected alternative was mapping Better Auth onto the existing `users` table via `modelName` and `fields`. That avoids repointing foreign keys but buys it with a permanent indirection between what the configuration says and what the database contains.

*Why:* "the auth tables are exactly what Better Auth generated, and my tables point at them" is the simplest sentence to tell a future reader. The migration cost is a single drop-and-recreate, which is free because there is no production data to preserve (see D4).

### D4 — No data migration

Existing users are test users and may be discarded. No backfill from the SuperTokens core, no email-based relinking, no compatibility shims.

*Why:* there is no production data. This is what makes D3 cheap, and it should be re-examined only if that stops being true before the work lands.

### D5 — Google only

Google remains the sole authentication provider. No email/password, no magic link, no KTH SSO in this migration. The existing UI stubs for other providers keep their current "not supported yet" behaviour.

*Why:* a migration that also grows the authentication surface cannot be verified against "does it still behave the same". New methods are cheap to add once Better Auth is the only thing in play.

### D6 — One avatar column

Better Auth's user model already carries an `image` field, populated from Google at sign-in. The separate `profilePicture` column is dropped; the upload endpoint writes its Vercel Blob URL to `image`.

*To verify during implementation:* whether Better Auth refreshes `image` from the provider on **every** sign-in. If it does, an uploaded picture would silently revert on next login (user story 6), and the fix is a configuration flag — not a second column.

*Why:* two avatar columns is exactly the kind of accumulation that produced the two-id problem.

### D7 — Global guard, explicit public routes

The integration's `AuthGuard` is registered globally so that all routes require a session by default. Routes reachable by visitors are individually marked anonymous — courses, search, review reads, health, and ingest.

*Why:* today's per-controller model is precisely why reviews shipped unauthenticated: forgetting a decorator fails open. Under a global guard, forgetting one fails closed and is noticed immediately. The annotation pass is one-time, and it turns "this route is public" into an explicit claim you can grep for.

*Risk this introduces:* the inverse failure — anonymous visitors being 401'd on pages that should be open. This is why test coverage of public routes is mandatory (see T4).

### D8 — Reviews take caller identity from the session

The author's id is removed from the review creation request body entirely and read from the session. Update and delete verify that the session's app user owns the review. The `userId` query parameter on review listing survives — it is a public "reviews by this person" filter, not an identity claim.

*Why:* this is the vulnerability the new session plumbing exists to close, and doing it before the migration would mean doing it twice. Note this is a deliberate behavioural change, not a like-for-like swap.

### D9 — The AI chat endpoint requires a session

`/ai/chat` moves from public to authenticated.

*Why:* it spends AI gateway credits per call and sits on a public URL. Rate limiting was considered as a way to keep the demo open to visitors, but that is a new subsystem and does not belong in this PR.

*Consequence:* the AI demo page is no longer usable by visitors. If that is unacceptable, the decision to revisit is this one, not D7.

### D10 — The reviews WebSocket gateway stays unauthenticated

The gateway keeps its current unauthenticated behaviour, with a code comment recording the reasoning.

*Why:* it only joins course-code rooms and broadcasts "reviews changed" notifications — nothing user-specific crosses it. It also connects cross-origin directly to the backend rather than through the Next.js rewrites, so cookie-based session auth there would be the fiddliest work in the whole migration for no security gain. Revisit if the gateway ever carries per-user data.

### D11 — The Redux session slice is deleted

Auth state comes from Better Auth's reactive session hook on the client. The `user` slice survives, holding app user profile data (name, email, favourites, picture).

*Why:* the slice exists solely to mirror SuperTokens state into Redux. Better Auth's client already exposes a reactive session, so keeping the slice would mean maintaining a copy of state that already has an owner. This also moves toward the planned Redux/TanStack refactor rather than deepening what is there.

### D12 — Frontend route protection moves to Next.js middleware

The SuperTokens client-side gate wrapping the authenticated layout is removed. Next.js middleware performs an optimistic redirect based on session cookie **existence**; the backend guards remain the real enforcement.

Better Auth documents this cookie-existence check as the recommended middleware approach and is explicit that it does **not** validate the session — validation belongs on the server.

*Open question for the first commit:* the cookie is set by NestJS but reaches the browser through the Next.js rewrite. Whether it is visible to Next middleware depends on Nest not pinning an explicit cookie domain. **Prove this early** — it determines whether D12 is viable as written. If the cookie is not visible, the fallback is a server component in the authenticated layout resolving the session and redirecting.

### D13 — Big-bang cutover, one PR

SuperTokens and Better Auth never coexist. No feature flag, no strangler migration, no parallel run. All five sub-issues land in a single PR.

*Why:* coexistence would mean two session cookies, two sets of CORS headers and two `/auth` mounts on one Nest app. The app is small enough that the insurance costs more than it pays.

*Consequence:* CI runs backend tests on every PR, so the branch will be red from the test commit (sub-issue 1) until the implementation goes green (sub-issue 2). This is expected and harmless — there is only one merge.

---

## Testing Decisions

### T1 — The test suite is written first, and is the executable form of this spec

Sub-issue 1 delivers a failing test suite before any implementation exists. "Done" for the implementation ticket is a green run, not a prose checklist.

*Consequence to accept:* the tests must commit to Better Auth's session shape as documented. If the real shape differs, the test suite is the first thing that says so — that is the mechanism working, not failing.

### T2 — A dependency-only commit precedes the tests

The first commit adds `better-auth` and the NestJS integration package with no configuration, so that imports resolve and the tests fail on **behaviour** rather than on missing modules.

The rejected alternative was writing tests against a locally-owned `@CurrentUser()` decorator to avoid coupling to the library. That was attractive while an app id had to be resolved from an auth id; under D2 the session's user id *is* the app user id, so such a decorator would wrap almost nothing while adding an abstraction.

### T3 — One seam: the Better Auth instance

**This is the one decision in this spec that the grilling did not reach, and it needs confirmation.**

Tests fake the Better Auth instance provider — returning a session, or returning none — and nothing else. Above that seam, everything runs for real: the global guard, the session decorator, routing, controllers, status codes. Below it, the database uses the existing `MockDb` pattern that mocks the Drizzle token.

Tests exercise controllers over HTTP with Supertest, against a minimal Nest application that registers the real global guard, rather than booting the full application module (which would pull in Elasticsearch, ingest and the AI module).

*Why this seam and not the existing one:* the current controller specs call controller methods directly with a mocked service. Guards do not run at that seam. Requirement T4 — proving public routes stay reachable anonymously — is **invisible below an HTTP seam**, because guard behaviour is exactly what a direct method call skips. This is the highest seam available, and using a single fake keeps the seam count at one.

*Prior art, with a correction:* `MockDb` is well established across the service specs and should be followed. However, the repo's tester agent documentation refers to end-to-end tests in a `backend-nest/test/` directory using a `jest-e2e.json` config — **neither exists**. `supertest` is present as a dev dependency but currently unused, and the Jest `testMatch` only covers `src/**/*.spec.ts`. New HTTP-level specs therefore live alongside their controllers under `src/`, requiring no Jest configuration change and no second test runner.

### T4 — Coverage is the full behavioural surface this migration changes

- The six user routes under the new session shape.
- Reviews: creation attributing to the session rather than the body; update and delete rejecting non-owners.
- The AI chat endpoint rejecting anonymous callers.
- **Public routes still reachable without a session once the global guard is on** — courses, search, review reads, health.

The last item is the one that must not be skipped. D7 trades fail-open for fail-closed, and the failure mode it introduces is silently 401-ing visitors on pages that should be open. Nothing else in this plan would catch that before a user did.

### T5 — What makes a good test here

Assert external behaviour: HTTP status codes, response bodies, and thrown errors. Assert that a mock was called only where the call *is* the contract — for example, that a review was persisted with the session's user id rather than the body's. Do not assert on internal call sequences or private helpers.

### T6 — Existing specs in the blast radius

- The user controller spec mocks the SuperTokens session container and the resolution step throughout — both deleted by this work. It is **rewritten, not adapted**. Note it is already stale independently of this migration: it asserts a console log the controller does not make, and references a binding named differently from its declaration.
- The user service spec covers the resolution step directly; those cases are deleted with the function.
- The reviews controller spec moves to the new seam to cover D8.
- Course, feedback, search and ingest specs are untouched.

### T7 — The frontend is not covered by automated tests

There is no frontend test runner (`npm run test:fe` echoes a placeholder), and standing one up is out of scope. Middleware behaviour, the Better Auth client, the session hook and the sign-in round trip are verified by the manual smoke checklist under Further Notes.

---

## Sub-Issues

Five children under this spec. All land in **one PR** (D13) — these are units of work and review, not separate merges.

### Sub-issue 1 — Write the failing test suite

**Owner:** AI · **Label:** `ready-for-agent` · **Blocks:** 2, 3

Add `better-auth` and `@thallesp/nestjs-better-auth` as dependencies with no configuration (T2), then write the failing suite described in T4 at the seam described in T3.

Acceptance criteria:
- Dependencies installed; test files compile.
- HTTP-level specs cover all four areas in T4.
- The Better Auth instance is the only auth-related fake; the global guard runs for real.
- `MockDb` pattern followed for database access.
- Stale user controller spec rewritten rather than patched (T6).
- The suite fails for the right reasons — absent behaviour, not absent modules.

### Sub-issue 2 — Replace SuperTokens with Better Auth

**Owner:** Human (implemented by hand from Better Auth's documentation / a tutorial)
**Label:** `ready-for-human` · **Blocked by:** 1

This ticket is deliberately **thin**: acceptance criteria and documentation links only, no implementation steps. Its purpose includes learning the library and the authentication flow.

Acceptance criteria:
- Google sign-in works end to end, from the sign-in page back into the app.
- Sessions persist across page loads and are stored in the app's Postgres database.
- Sign-out works.
- One id: the mapping table, the resolution step and the legacy fallback are gone; favourites and reviews foreign keys point at the Better Auth user table (D2, D3).
- Global guard active; public routes explicitly marked and still reachable by visitors (D7).
- The Redux session slice is gone; the client uses Better Auth's session hook (D11).
- Route protection runs in Next.js middleware, or the documented fallback if the cookie is not visible there (D12).
- Backend test suite from sub-issue 1 passes.

Sequencing note: start with a walking skeleton — sign in with Google and reach one guarded route — before touching anything else. Settle the cookie-visibility question in D12 early; it is the highest-uncertainty item in the plan.

### Sub-issue 3 — Take reviews' caller identity from the session

**Owner:** Either · **Label:** `ready-for-agent` · **Blocked by:** 1

Implements D8 against the red tests from sub-issue 1. Independent of *how* auth gets installed, so it can proceed in parallel with sub-issue 2 once the session shape is fixed.

Acceptance criteria:
- The author id is not accepted from the request body.
- Creation attributes the review to the session's app user.
- Update and delete reject non-owners.
- The public listing filter by user id still works.

### Sub-issue 4 — Purge SuperTokens remnants

**Owner:** AI · **Label:** `ready-for-agent` · **Blocked by:** 2

Acceptance criteria:
- All SuperTokens packages removed from both workspaces (backend, and the client/server/web-js packages on the frontend).
- SuperTokens environment variables removed from both `.env.example` files, `docker-compose.yml`, and any deployment documentation.
- The SuperTokens server-side initialisation module in the frontend is deleted, along with the matching `serverExternalPackages` entry.
- The SuperTokens exception filter and CORS header wiring removed from backend bootstrap; CORS headers replaced with what Better Auth requires.
- No SuperTokens string remains anywhere in the repo outside the ADR.

### Sub-issue 5 — Update CONTEXT.md and record the ADR

**Owner:** AI · **Label:** `ready-for-agent` · **Blocked by:** 2

Acceptance criteria:
- `CONTEXT.md`: the "auth user" entry is retired; "app user" drops the clause about ids never being assumed equal; "visitor" unchanged. See "Domain Language Impact".
- A new ADR records why SuperTokens was replaced, why authentication lives in the backend, and why the identity model collapsed to one id.
- The security review agent definition, which names SuperTokens explicitly, is updated.
- README and any developer setup instructions reflect the new environment variables.

---

## Out of Scope

- **Any authentication method beyond Google** — email/password, magic link, KTH SSO (D5).
- **Migrating existing user data.** Test users are discarded (D4).
- **Authenticating the reviews WebSocket gateway** (D10).
- **Rate limiting** the AI endpoint, or any other endpoint (D9).
- **Standing up a frontend test runner** (T7).
- **The wider Redux → TanStack Query refactor.** Only the session slice is touched (D11); the rest is deliberately left alone and should follow this work, not accompany it.
- **Collapsing the favourites junction table**, despite the existing TODOs suggesting it. Unrelated to authentication.
- **Roles, permissions or any authorisation model beyond resource ownership.** Ownership checks on reviews (D8) are the extent of it.
- **Rewriting course, feedback, search or ingest tests** (T6).

---

## Further Notes

### Reconciliation — the point of the exercise

Sub-issue 2 is implemented by hand from a tutorial. When the tutorial's approach differs from a decision recorded above, that difference is the interesting output, not a defect. Reopen the decision, argue it against the reasoning written into it, and record the outcome as a comment on this spec issue after the PR merges.

**This reconciliation comment is a deliverable**, not a good intention. It is the artifact this whole approach exists to produce.

### Deploy checklist

Too small for its own ticket, too easy to forget at merge time.

- Remove the SuperTokens connection URI and API key from the deployment environment and `docker-compose.yml`.
- Add Better Auth's secret and base URL.
- Configure trusted origins — the frontend and backend are on different origins in the deployed environment.
- **Update the authorised redirect URI in the Google Cloud console.** The callback path moves from SuperTokens' to Better Auth's. This one will silently break sign-in in the deployed environment while working perfectly on localhost, and it is the single most likely cause of a bad merge night.
- Confirm the CORS configuration still allows credentials with the new header set.

### Manual smoke checklist

Covers what the backend suite cannot reach (T7).

1. Signed out, browse courses and search — no redirect, no 401.
2. Signed out, read reviews on a course page — visible.
3. Signed out, open a page requiring an account — redirected to sign-in, not an error.
4. Sign in with Google — lands back in the app signed in.
5. Reload the page — still signed in.
6. Profile shows correct name, email and picture.
7. Upload a profile picture; sign out and back in — **the uploaded picture is still there** (D6).
8. Favourite and unfavourite a course; confirm it persists.
9. Post a review; confirm it is attributed to you.
10. Attempt to edit another person's review — rejected.
11. Use the AI chat signed in — works. Signed out — rejected (D9).
12. Open a course page in two browsers; post a review in one and confirm the other updates live (the gateway still works after the bootstrap changes).
13. Sign out — session gone, protected pages redirect.
14. Delete account — succeeds, data gone.

### Known risks

- **Nest body parsing.** `bodyParser: false` (D1) affects every `@Body()` route and the multipart profile picture upload. This is the most likely source of surprising breakage far from the auth code, and worth verifying early with the walking skeleton.
- **Cookie visibility in Next middleware** (D12). Highest-uncertainty item. Has a documented fallback.
- **Neon's HTTP driver does not support transactions.** Whether Better Auth's Drizzle adapter requires them is unverified. If it does, this forces a driver change and should be raised immediately rather than worked around.
- **Avatar clobbering** (D6). Verify the provider refresh behaviour.
- **Ingest routes.** These currently have no protection and are being marked anonymous to preserve behaviour under D7. Worth a look at whether they *should* be public — but changing that is not this spec's job.
