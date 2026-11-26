# KTH-Course-Community

KTH-Course-Community helps KTH students search for and explore courses.

This is a [Bun](https://bun.sh/) workspace monorepo (`workspaces: ["apps/*"]`).
The only app today is `apps/web`: Next.js 16 hosts the UI, Better Auth,
Drizzle/Postgres, and the tRPC API. There is no `packages/` workspace yet.

## Open Source Contribution

All contributions to the project are very welcome!
To make a contribution:

- Open a new issue
  - Usually good to await comment from code admins before starting working on the feature.
- Create a new branch or fork
- Implement new feature / ticket
- Create a PR into the Dev branch
  - Link issue in PR.
- Wait for approval or comment by code admins

If you have any suggestions you are always welcome to open an issue in the repository!

## Prerequisites

- [Bun](https://bun.sh/) 1.3.14 (`packageManager` in the root `package.json`)
- [Docker](https://docs.docker.com/get-docker/) with Compose, for the local Postgres

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/kthaisociety/KTH-Course-Community.git
cd KTH-Course-Community
```

### 2. Install Dependencies

```bash
bun i
```

### 3. Set Up Environment Variables

Copy `apps/web/.env.example` to `apps/web/.env.local` and fill in:

- `DATABASE_URL`
- `BETTER_AUTH_URL` (the public site origin, e.g. `http://localhost:3000`)
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`
- `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` / `AWS_REGION` (SES magic-link email)
- `SES_SENDER` / `SES_REPLY_TO`
- `AI_GATEWAY_API_KEY` (embeddings for search/ingest)

Google OAuth authorised redirect URI: `${BETTER_AUTH_URL}/api/auth/callback/google`.
GitHub OAuth authorised callback URL: `${BETTER_AUTH_URL}/api/auth/callback/github`.
Magic-link sign-in sends mail through Amazon SES from `SES_SENDER`.

### 4. Set Up the Database

Development runs on a local Postgres in Docker (`docker-compose.yml`), on the same
image as staging and production. `apps/web/.env.example` already points
`DATABASE_URL` at it. From the repo root:

```bash
docker compose up -d   # Postgres on 127.0.0.1:5438
bun run db:migrate     # builds the schema from the committed migrations
```

The data stays in a Docker volume between restarts. `docker compose down -v`
removes the database, to start over from an empty one.

### 5. Start the Development Server

```bash
bun run dev
```

The app is at [http://localhost:3000](http://localhost:3000).

### 6. Ingest Data

The database starts without courses. To fill it, from the repo root:

```bash
bun run ingest -- --test       # 50 random established courses
bun run ingest -- --test 200   # as many random courses as you ask for
bun run ingest                 # every course
```

A test ingest is enough for most work, and you can run one again to add more
courses. Ingest needs `AI_GATEWAY_API_KEY`, to embed the courses for search.

This reads KTH's public course pages on www.kth.se (KOPPS is closed, see `docs/adr/0012-ingest-from-kth-course-pages.md`) and writes into the database in `DATABASE_URL` (including embeddings). A full run fetches about 4,800 courses in two languages and takes a while.

### 7. Build Docker Image

From the repo root:

```bash
docker build -t your-dockerhub-username/course-compass-web:latest -f Dockerfile.web .
```

The container can apply the committed migrations (`apps/web/server/db/drizzle/`)
before the server starts. It does so only when `MIGRATE_ON_START=true`; otherwise
it leaves the database alone. If a migration fails, the container exits and the
server does not start.

### 8. Run a Job in a Deployed Container

A deployed database can only be reached from inside its environment, so ingest
and the backfills run in the app's own container, from its terminal in Dokploy.
Choose `/bin/sh`: the image is Alpine and has no Bash. The terminal opens in `/`,
so start with `cd /app`, where the commands below expect to be.

The image holds each job as one file, built for Node:

| Job | Command |
| --- | --- |
| Ingest | `node apps/web/scripts/ingest.mjs` (add `--test` for 50 random courses, `--test <n>` for n) |
| Backfill earned personalization tiers | `node apps/web/scripts/backfill-personalization-tiers.mjs` |
| Backfill missing graph nodes | `node apps/web/scripts/backfill-graph-placements.mjs` |

They use the container's own settings (`DATABASE_URL`, and `AI_GATEWAY_API_KEY`
for ingest), so there is nothing to configure. None of them runs on its own.

A full ingest reads every course page and takes a while, and closing the
terminal can stop a job that runs in it. Start a long job with `nohup`, so it
keeps running, and follow its log:

```sh
cd /app
nohup node apps/web/scripts/ingest.mjs > /tmp/ingest.log 2>&1 &
tail -f /tmp/ingest.log
```

Ctrl+C stops only `tail`, not the job. To check on it later:

```sh
ps | grep '[i]ngest'         # a line while it runs, nothing once it has stopped
tail -n 20 /tmp/ingest.log   # a full run ends with "Ingest finished"
```

The log lives in the container, so a redeploy removes it. A job stopped halfway
can be run again: ingest only updates the courses it reads, and both backfills
change nothing on a second run.

## Adding a feature

Product code is split by layer: **server owns data and auth, features own UI and
client queries, `app/` only routes.** Do not put tRPC routers under `features/` —
that mixes server-only modules into the browser graph.

```text
apps/web/
  app/                         # routes and layouts only
  features/<name>/
    api/                       # tRPC useQuery / useMutation hooks
    components/                # feature UI
    hooks/                     # feature-local UI state
    index.ts                   # hooks and shared UI for other features
  components/ui/               # shadcn primitives
  lib/                         # browser helpers
  types/                       # shared server + UI types
  trpc/                        # browser client + QueryClient
  server/
    api/routers/<name>.ts      # thin procedures
    api/root.ts                # register the router
    services/<name>.ts         # business logic
    repositories/<name>.ts     # Drizzle queries
    db/                        # schema, client, drizzle-kit, migrations
```

Path alias `@/*` maps to `apps/web/*`.

### 1. Server

Keep queries in `server/repositories/<name>.ts` (import `db`, run Drizzle).
Keep business logic in `server/services/<name>.ts` (call the repository).
The router stays thin: validate input, pick `baseProcedure` or
`protectedProcedure`, call the service.

`protectedProcedure` requires a Better Auth session (`ctx.session.user`).
Visitors may browse courses, search, and read reviews; everything else should be
protected. `proxy.ts` (Next 16; not `middleware.ts`) only checks that a cookie
exists on `/profile` and `/saved` — the procedure is the real gate.

```ts
// server/api/routers/reviews.ts
export const reviewsRouter = createTRPCRouter({
  list: baseProcedure
    .input(z.object({ courseCode: z.string().optional() }))
    .query(({ ctx, input }) =>
      findAllReviews(input.courseCode, ctx.session?.user.id),
    ),
  create: protectedProcedure
    .input(reviewInput.extend({ courseCode: z.string().min(1) }))
    .mutation(({ ctx, input }) => {
      const { courseCode, ...reviewData } = input;
      return createReview(courseCode, ctx.session.user.id, reviewData);
    }),
});
```

Register it on `appRouter` in `server/api/root.ts`. If you need a new table, add
it in `server/db/schema.ts` (or `auth-schema.ts` for identity), then run
`bun run db:generate` and `bun run db:migrate` from the repo root, and commit
the generated migration with it. Staging and production get their schema only
from the committed migrations, so applying yours locally first checks it.
`bun run db:push` skips the migration and is only for trying a schema out on
your local database. Types that
both server and UI share go in `types/`.

### 2. Frontend

Add `apps/web/features/<name>/`. Expose wrapped `useQuery` / `useMutation`
hooks in `api/` — components call those hooks, they do not reach for
`queryOptions` themselves:

```ts
// features/reviews/api/queries.ts
export function useReviewList(courseCode: string | undefined) {
  const trpc = useTRPC();
  return useQuery(
    trpc.reviews.list.queryOptions(
      { courseCode: courseCode ?? "" },
      { enabled: Boolean(courseCode) },
    ),
  );
}
```

```ts
// features/reviews/api/mutations.ts
export function useCreateReview() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  return useMutation(
    trpc.reviews.create.mutationOptions({
      onSuccess: (_data, { courseCode }) => {
        void queryClient.invalidateQueries({
          queryKey: trpc.reviews.list.queryKey({ courseCode }),
        });
      },
    }),
  );
}
```

Put feature UI in `components/` — no required `screen`/`view` naming. A feature
route is one component (data + layout). Split a child only when it has its own
name (`CourseCard`, `Review`).

Other features import hooks/shared UI from `features/<name>` (`index.ts`).
**Pages import the route component from `features/<name>/components`** so a
barrel does not pull that page into unrelated routes.

```tsx
// app/(service)/search/page.tsx
import { Search } from "@/features/search/components/search";

export default function Page() {
  return <Search />;
}
```

Reuse existing features instead of duplicating them (`useMe` / session from
`auth`, course cards from `courses`, `useSetCourseSaved` from `saved`).
Leave shadcn primitives in `components/ui`.

See `features/search` + `server/services/search.ts` +
`server/repositories/search.ts` + `server/api/routers/search.ts` for a complete
slice.

## AI Integration

Search and ingest use the Vercel AI SDK for embeddings via `apps/web/server/ai.ts`.

Get a key at [vercel.com/dashboard → AI Gateway → API Keys](https://vercel.com/dashboard/ai-gateway/api-keys).

## Agent Files

- `AGENTS.md` for Codex/OpenAI-style agents
- `CLAUDE.md` for Claude-oriented workflows
- `CONTEXT.md` for domain language
- `docs/adr/` for architecture decisions

Repo-local agent skills live under `.agents/skills/`.
`apps/web/AGENTS.md` is generated by `next dev` — do not put project conventions there.

## Delivery

The app is built and deployed by the KTHAIS delivery pipeline. The workflows in
`.github/workflows/` only call [`kthaisociety/workflows`](https://github.com/kthaisociety/workflows).

- **Pull requests** are squash-merged, so the PR title becomes the commit on
  `main`. It must be a Conventional Commit (`feat: …`, `fix: …`, `docs: …`); the
  `title` check enforces it. A code owner (`.github/CODEOWNERS`) approves.
- **Every merge to `main`** runs the checks, builds
  `ghcr.io/kthaisociety/kth-course-community`, and deploys it to staging.
- **Releases** come from the release PR that release-please keeps open (next
  version and `CHANGELOG.md`). Merging it tags the version and deploys the same
  image to production.

What each environment runs with (hosts, settings, secret names) is declared in
`kthaisociety/deployments`, under `projects/kth-course-community/`.

## Available Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Starts the Next.js development server |
| `bun run test:web` | Runs Vitest (`apps/web/server/**/*.spec.ts`) |
| `bun run lint` | Biome check (writes fixes) |
| `bun run format` | Biome format |
| `bun run db:push` | Pushes the Drizzle schema to the local database, without a migration |
| `bun run db:generate` | Generates Drizzle migrations |
| `bun run db:migrate` | Applies the committed migrations |
| `bun run ingest` | Ingests KTH courses from www.kth.se into the database |
| `bun run add:web` | Adds a dependency to the web workspace |
| `bun run rm:web` | Removes a dependency from the web workspace |
 