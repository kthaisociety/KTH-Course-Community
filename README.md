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

Copy `apps/frontend/.env.example` to `apps/frontend/.env.local` and fill in:

- `DATABASE_URL`
- `BETTER_AUTH_URL` (the public site origin, e.g. `http://localhost:3000`)
- `BETTER_AUTH_SECRET`
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
- `AI_GATEWAY_API_KEY` (embeddings for search/ingest)
- `BLOB_READ_WRITE_TOKEN` (profile pictures)

Google OAuth authorised redirect URI: `${BETTER_AUTH_URL}/api/auth/callback/google`.

### 4. Set Up the Database

```bash
cd apps/frontend
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
docker build -t your-dockerhub-username/course-compass-frontend:latest -f Dockerfile.frontend .
```

## AI Integration

Search and ingest use the Vercel AI SDK for embeddings via `apps/frontend/server/ai.ts`.

Get a key at [vercel.com/dashboard → AI Gateway → API Keys](https://vercel.com/dashboard/ai-gateway/api-keys).

## Agent Files

- `AGENTS.md` for Codex/OpenAI-style agents
- `CLAUDE.md` for Claude-oriented workflows

Repo-local agent skills live under `.agents/skills/`.

## Available Scripts

| Script | Description |
| --- | --- |
| `bun run dev` | Starts the Next.js development server |
| `bun run test:fe` | Runs Vitest |
| `bun run ingest` | Ingests KOPPS courses into Neon |
| `bun run add:fe` | Adds a dependency to the frontend workspace |
| `bun run rm:fe` | Removes a dependency from the frontend workspace |
