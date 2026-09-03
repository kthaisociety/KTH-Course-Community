# KTH-Course-Community

KTH-Course-Community helps KTH students search for and explore courses.

This is a [Bun](https://bun.sh/) workspace monorepo (`workspaces: ["apps/*"]`).
The only app today is `apps/web`: Next.js 16 hosts the UI, Better Auth,
Drizzle/Neon, and the tRPC API. There is no `packages/` workspace yet.

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
- `BLOB_READ_WRITE_TOKEN` (profile pictures)

Google OAuth authorised redirect URI: `${BETTER_AUTH_URL}/api/auth/callback/google`.
GitHub OAuth authorised callback URL: `${BETTER_AUTH_URL}/api/auth/callback/github`.
Magic-link sign-in sends mail through Amazon SES from `SES_SENDER`.

### 4. Set Up the Database

From the repo root:

```bash
bun run db:push
```

### 5. Start the Development Server

```bash
bun run dev
```

The app is at [http://localhost:3000](http://localhost:3000).

### 6. Ingest Data

```bash
bun run ingest
```

Optional: `bun run ingest -- --test` ingests 10 random established courses.

This talks to KTH KOPPS and writes into Neon (including embeddings). It can take a while.

### 7. Build Docker Image

From the repo root:

```bash
docker build -t your-dockerhub-username/course-compass-web:latest -f Dockerfile.web .
```

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
exists on `/profile` and `/favorites` — the procedure is the real gate.

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
it in `server/db/schema.ts` (or `auth-schema.ts` for identity) and run
`bun run db:push` from the repo root. Types that both server and UI share go in
`types/`.

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
`auth`, course cards from `courses`, `useToggleFavorite` from `favorites`).
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

## Available Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Starts the Next.js development server |
| `bun run test:web` | Runs Vitest (`apps/web/server/**/*.spec.ts`) |
| `bun run lint` | Biome check (writes fixes) |
| `bun run format` | Biome format |
| `bun run db:push` | Pushes the Drizzle schema to Neon |
| `bun run db:generate` | Generates Drizzle migrations |
| `bun run ingest` | Ingests KOPPS courses into Neon |
| `bun run add:web` | Adds a dependency to the web workspace |
| `bun run rm:web` | Removes a dependency from the web workspace |
 