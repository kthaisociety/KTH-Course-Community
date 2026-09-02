# KTH-Course-Community

KTH-Course-Community helps KTH students search for and explore courses. Next.js
hosts the UI, Better Auth, Drizzle/Neon, and the tRPC API.

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

- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [Bun](https://bun.sh/)

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

```bash
cd apps/web
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

```bash
docker build -t your-dockerhub-username/course-compass-web:latest -f Dockerfile.web .
```

## Adding a feature

Product code is split by layer: **server owns data and auth, features own UI and client queries, `app/` only routes.** Do not put tRPC routers under `features/` — that mixes server-only modules into the browser graph.

```text
apps/web/
  app/                         # routes and layouts only
  features/<name>/
    api/queries.ts             # tRPC queryOptions factories
    api/mutations.ts           # tRPC mutationOptions factories
    components/                # feature UI
    hooks/                     # feature-local UI state
    index.ts                   # hooks and shared UI for other features
  server/
    <name>.ts                  # domain logic
    db/                        # schema, client, drizzle-kit, migrations
    api/routers/<name>.ts      # procedures
    api/root.ts                # register the router
  trpc/                        # client + QueryClient
  types/                       # shared server + UI types
```

### 1. Server

Keep I/O in `server/<name>.ts`. The router should stay thin: validate input, pick `baseProcedure` or `protectedProcedure`, call the domain function.

`protectedProcedure` requires a Better Auth session (`ctx.session.user`). Visitors may browse courses, search, and read reviews; everything else should be protected. `proxy.ts` only checks that a cookie exists — the procedure is the real gate.

```ts
// server/api/routers/notes.ts
export const notesRouter = createTRPCRouter({
  list: protectedProcedure
    .input(z.object({ courseCode: z.string() }))
    .query(({ ctx, input }) => listNotes(ctx.db, ctx.session.user.id, input)),
  create: protectedProcedure
    .input(createNoteSchema)
    .mutation(({ ctx, input }) => createNote(ctx.db, ctx.session.user.id, input)),
});
```

Register it on `appRouter` in `server/api/root.ts`. If you need a new table, add it in `server/db/schema.ts` (or `auth-schema.ts` for identity) and run `bun run db:push` from `apps/web`. Types that both server and UI share go in `types/`.

### 2. Frontend

Add `apps/web/features/<name>/`. Expose query/mutation **options**, not wrapped `useQuery` hooks, so components compose TanStack Query themselves:

```ts
// features/notes/api/queries.ts
export function useNotesQueries() {
  const trpc = useTRPC();
  return {
    list: (courseCode: string) =>
      trpc.notes.list.queryOptions({ courseCode }),
  };
}
```

```ts
// features/notes/api/mutations.ts
export function useNotesMutations() {
  const trpc = useTRPC();
  return {
    create: () => trpc.notes.create.mutationOptions(),
  };
}
```

Put feature UI in `components/` — no required `screen`/`view` naming. Other features import hooks/shared UI from `features/<name>` (`index.ts`). **Pages import the route component from `features/<name>/components`** so a barrel does not pull that page into unrelated routes.

```tsx
// app/(service)/notes/page.tsx
import { NoteList } from "@/features/notes/components/note-list";

export default function Page() {
  return <NoteList />;
}
```

Reuse existing features instead of duplicating them (`useMe` / session from `auth`, course cards from `courses`, `useToggleFavorite` from `favorites`). Leave shadcn primitives in `components/ui`.

See `features/search` and `server/api/routers/search.ts` for a complete slice.

## AI Integration

Search and ingest use the Vercel AI SDK for embeddings via `apps/web/server/ai.ts`.

Get a key at [vercel.com/dashboard → AI Gateway → API Keys](https://vercel.com/dashboard/ai-gateway/api-keys).

## Agent Files

- `AGENTS.md` for Codex/OpenAI-style agents
- `CLAUDE.md` for Claude-oriented workflows

Repo-local agent skills live under `.agents/skills/`.

## Available Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Starts the Next.js development server |
| `bun run test:web` | Runs Vitest |
| `bun run ingest` | Ingests KOPPS courses into Neon |
| `bun run add:web` | Adds a dependency to the web workspace |
| `bun run rm:web` | Removes a dependency from the web workspace |
