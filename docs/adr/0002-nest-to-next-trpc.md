---
status: accepted
---

# Move the API from NestJS into the Next.js app (tRPC + Better Auth + Drizzle)

The NestJS backend is gone. Course search, reviews, identity, and ingest now live
in the Next.js app: Better Auth on `/api/auth/*`, tRPC on `/api/trpc`, Drizzle
talking to the same Neon database, and a bun CLI for KOPPS ingest.

## Why Nest was removed

The browser already treated Next as the site origin. Nest existed as a second
process that Next rewrote `/api/auth` and `/api/nest` into, plus a Socket.IO
server the browser hit cross-origin. That split forced CORS, `SameSite=None`
cookies, two Docker images, and a dual user fetch (`authClient.useSession` and
`GET /user/me`). Putting the API in Next collapses that to one origin and one
deployable.

tRPC plus the existing TanStack Query client replaces hand-written `fetch`
wrappers with typed procedures. Session identity is read in tRPC context from
Better Auth; protected procedures fail closed, same as the old global
`AuthGuard`.

## What was dropped on purpose

- **Elasticsearch.** Search is Postgres keyword (ILIKE + tsvector) merged with
  pgvector cosine search. Compose no longer runs an ES node.
- **Socket.IO.** Review mutations invalidate the TanStack Query cache in the
  acting tab. Other tabs wait for staleTime/refocus.
- **HTTP ingest.** KOPPS ingest is `bun run ingest` (optional `--test`), not a
  fire-and-forget 202 route. Next route handlers are a poor fit for a long
  in-process job.

## Consequences

- **One container.** `docker-compose.yml` runs the Next app only. Health is
  `GET /api/health`.
- **Same-origin cookies.** Better Auth can use default Lax cookies. `BETTER_AUTH_URL`
  is still the public site origin.
- **Multipart stays off tRPC.** Profile pictures POST to
  `/api/user/profile-picture`.
- **Frontend route protection is still optimistic.** `proxy.ts` only checks that
  a session cookie exists. `protectedProcedure` is the real enforcement.
- **ADR 0001 still holds** for identity (one Better Auth user id, plural tables,
  Neon `transaction: false`). Sign-in is Google OAuth or a magic-link email.
  Only the mount point changed: Next instead of Nest.
