# KTH-Course-Community

Bun workspace monorepo (`workspaces: ["apps/*"]`). The only app is `apps/web`: Next.js 16 hosts the UI, Better Auth, Drizzle/Neon, and the tRPC API. There is no `packages/` workspace yet.

## Quick Reference

- Package manager: `bun@1.3.14`
- App: `apps/web` (`kth-course-community-web`)
- Install: `bun i`
- Dev: `bun run dev` → http://localhost:3000
- Test: `bun run test:web` (Vitest, `apps/web/server/**/*.spec.ts`)
- Lint / format: `bun run lint` / `bun run format` (Biome)
- DB: `bun run db:push` / `bun run db:generate`
- Ingest: `bun run ingest` (optional `--test`)
- Backfill earned personalization tiers: `bun run backfill:tiers` (idempotent; only ever raises)

Run scripts from the repo root. Env lives in `apps/web/.env.local` (see `apps/web/.env.example`). Path alias `@/*` → `apps/web/*`.

## Layout

```
apps/web/
  app/                      # routes and layouts only
  features/<name>/          # product UI
    api/                    # tRPC useQuery / useMutation hooks
    components/             # feature UI
    hooks/                  # feature-local UI state
    index.ts                # cross-feature API (hooks + shared UI)
  components/ui/            # shadcn primitives
  lib/                      # browser helpers
  types/                    # shared server + UI types
  trpc/                     # browser tRPC client + QueryClient
  server/
    <domain>/               # one folder per domain: course, reviews, search,
      router.ts             #   user, feedback, health
      service.ts            # router = thin tRPC procedures
      repository.ts         # service = business logic, repository = Drizzle
      service.spec.ts       # colocated test
    api/root.ts             # register routers
    api/trpc.ts             # context, baseProcedure, protectedProcedure
    db/                     # schema, client, drizzle-kit, migrations
    auth.ts                 # Better Auth
    ai.ts                   # embeddings (search/ingest)
    ingest/                 # KOPPS → Neon
    email/                  # SES magic-link mail
    http/                   # request-shaping helpers shared by app/api routes
```

## Conventions

- `app/` only routes. A page imports the route component from `features/<name>/components`, not from the feature barrel.
- Feature `index.ts` is the cross-feature API. Other features import hooks/shared UI from `@/features/<name>`.
- A feature route is one component (data + layout). Split a child only when it has its own name (`CourseCard`, `Review`), not a Screen/View pair.
- Do not put tRPC routers under `features/`.
- Server code is grouped **by domain, not by layer**: everything for one domain lives in `server/<domain>/`. Adding an endpoint means editing one folder.
- Layers within a domain: router → service → repository → `db`. Routers stay thin: validate input, pick `baseProcedure` or `protectedProcedure`, call the service. Services hold business logic. Repositories import `db` and run queries.
- These layers are **enforced by Biome**, not just convention: a router importing a `repository`, or a repository importing a `service`/`router`, fails `bun run lint`. See the `noRestrictedImports` overrides in `biome.json`.
- Cross-domain calls go service → service (e.g. `search/service.ts` imports `../course/service`). Routers never import another domain's router; compose them in `server/api/root.ts`.
- Feature `api/` exposes wrapped `useQuery` / `useMutation` hooks, not raw queryOptions factories.
- `protectedProcedure` is the real auth gate (`ctx.session.user`). `proxy.ts` (Next 16; not `middleware.ts`) only checks that a session cookie exists for `/profile`, `/saved` and `/taken`. Visitors may browse courses, search, and read reviews.
- Browser calls same-origin `/api/trpc` and `/api/auth`. Multipart profile pictures POST to `/api/user/profile-picture` (not tRPC).
- Every multipart route in `app/api/` caps its body with `capRequestBody` from `server/http/body-cap.ts` **before** calling `request.formData()`, which buffers the whole body before anything can read a file's size. `server/http/` is domain-neutral on purpose: this cap lived under `server/ingest/transcript/` and the profile-picture route never found it.
- Tests colocate as `*.spec.ts` next to server code; mock repositories, not the database.
- Domain words: `CONTEXT.md`. Decisions: `docs/adr/NNNN-slug.md`.
- Design: `docs/design_ref/` holds the artboards, in one dated folder per export.
  **The newest dated folder is the authority** — today `docs/design_ref/2026-09-06/`.
  It governs layout, spacing, type, colour, copy, states and responsive behaviour.
  Where it contradicts the schema or `CONTEXT.md`, those win and the design adapts by
  the smallest edit that keeps it intact. Style against the `--cc-*` tokens, which
  mirror its `cc-theme.css`.
- Cite an artboard by its full dated path. Earlier exports lived at `docs/design/`
  and `docs/design_ref_new/`; both are gone, and the artboards are **revised** at each
  export rather than merely moved — so a comment citing an older path may be wrong
  about the design itself, not just about the path. Re-read the artboard before
  trusting such a comment. This has already produced three wrong conclusions.
- When a new export lands, sweep every citation to the new dated path in the same
  commit. A citation that survives pointing at a superseded revision is worse than no
  citation, because it reads as current.
- Prefer documenting real behavior from code, not intended behavior.

## Repo Agent Files

- `CLAUDE.md`: concise repo guidance for Claude-oriented workflows
- `AGENTS.md`: same project guidance for OpenAI/Codex-style agents
- `CONTEXT.md`: the project's domain language
- `docs/adr/`: architecture decision records
- `docs/design_ref/<date>/`: the artboards and `cc-theme.css` — the visual authority;
  the newest dated folder wins
- Repo-local skills live under `.agents/skills/`
- `apps/web/AGENTS.md` is generated by `next dev` — do not put project conventions there
