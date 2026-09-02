# KTH-Course-Community

KTH-Course-Community is a full-stack application designed to help KTH students search for and explore courses. It features a Next.js frontend and a NestJS backend, powered by ElasticSearch for searching and PostgreSQL for data storage.

## Open Source Contribution
All contributions to the project are very welcome! 
To make a contribution:
-   Open a new issue
    - Usually good to await comment from code admins before starting working on the feature.      
-   Create a new branch or fork
-   Implement new feature / ticket
-   Create a PR into the Dev branch
    - Link issue in PR. 
-   Wait for approval or comment by code admins

If you have any suggestions you are always welcome to open an issue in the repository!

## Prerequisites

Before you begin, ensure you have the following installed on your local machine:

-   [Node.js](https://nodejs.org/) (v18 or later recommended)
-   [Bun](https://bun.sh/)
-   [Docker Desktop](https://www.docker.com/products/docker-desktop/)

## Getting Started

Follow these steps to get the project up and running on your local machine.

### 1. Clone the Repository

```bash
git clone https://github.com/kthaisociety/KTH-Course-Community.git
cd KTH-Course-Community
```

### 2. Install Dependencies

Install all the necessary dependencies for both the frontend and backend from the root directory.

```bash
bun i
```

### 3. Set Up Environment Variables

You'll need to create two `.env` files, one for the backend and one for the frontend.

**Backend (`apps/backend-nest/.env`)**

Create a file at `apps/backend-nest/.env` and add the following variables.

```env
# PostgreSQL database connection string
DATABASE_URL=postgresql://user:password@host:port/database

# Auth (Better Auth, mounted inside Nest at /api/auth)
# BETTER_AUTH_URL is the frontend/site URL, not this API's, because /api/auth/* is
# proxied there by Next. Pointing it at the API sets the session cookie on a host
# the browser never talks to directly, and sign-in silently stops working.
BETTER_AUTH_URL=http://localhost:3000
BETTER_AUTH_SECRET= # Generate with: openssl rand -base64 32

# Google OAuth credentials: https://console.cloud.google.com/apis/credentials
# Add ${BETTER_AUTH_URL}/api/auth/callback/google as an authorised redirect URI.
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# ElasticSearch credentials
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD= # The password you get after starting ElasticSearch

# Application URLs and Port
PORT=8080
WEBSITE_DOMAIN=http://localhost:3000
API_DOMAIN=http://localhost:8080

# Extra CORS origins (comma-separated). WEBSITE_DOMAIN is always included.
# This list is also Better Auth's trustedOrigins, so an origin missing here is
# rejected as a post-sign-in redirect target.
CORS_ORIGINS=
```

See `apps/backend-nest/.env.example` for the full list, including the ingestion and AI
variables used later in this guide.

**Frontend (`apps/frontend/.env`)**

Create a file at `apps/frontend/.env` and add the following variables.

```env
# What the browser calls: REST base URL and the Socket.IO origin.
NEXT_PUBLIC_BACKEND_DOMAIN=http://localhost:8080
NEXT_PUBLIC_WEBSITE_DOMAIN=http://localhost:3000

# Server-side only, and read by `next.config.ts` at build time. It is the target
# of the rewrites that put the backend on the site origin:
#   /api/auth/* -> Better Auth on the Nest host (so the session cookie is set on
#                  the origin the browser is already on)
#   /api/nest/* -> every other Nest route, same-origin, so the cookie is sent
# Without it there are no rewrites and sign-in cannot complete.
BACKEND_DOMAIN=http://localhost:8080
```

### 4. Set Up the Database

This project uses PostgreSQL and `drizzle-orm`. Make sure you have a running PostgreSQL instance and that the `DATABASE_URL` in `apps/backend-nest/.env` is configured correctly.

Once configured, run the database migrations to set up the schema:

```bash
cd apps/backend-nest
bun run db:generate
bun run db:push
```

### 5. Start ElasticSearch

You can run a local instance of ElasticSearch using Docker. The following command will download and start it.

```bash
curl -fsSL https://elastic.co/start-local | sh
```

When the process has finished, it will print a password for the `elastic` user. **Make sure to copy this password and add it to the `ELASTICSEARCH_PASSWORD` variable in your `apps/backend-nest/.env` file.**

### 6. Start the Development Servers

Start both the frontend and backend from the repo root:

```bash
bun run dev
```

The frontend will be available at [http://localhost:3000](http://localhost:3000). To run one side only, use `bun run dev:fe` or `bun run dev:be`.

### 7. Ingest Data

```bash
bun run dev:be
```
After the backend has started, you can ingest course data. 
1) Set correct INGEST_SECRET in .env. 
2) Test the endpoint by running: 
```bash
export INGEST_SECRET=$(grep '^INGEST_SECRET=' apps/backend-nest/.env | cut -d= -f2-)
curl -X POST http://localhost:8080/ingest/test-neon -H "x-ingest-key: $INGEST_SECRET"
```

3) To do the full ingestion, run: 
```bash
export INGEST_SECRET=$(grep '^INGEST_SECRET=' apps/backend-nest/.env | cut -d= -f2-)
curl -X POST http://localhost:8080/ingest/courses/neon -H "x-ingest-key: $INGEST_SECRET"
```

This process may take some time. You can monitor the logs from the backend server for progress.

### 8. Build Docker Image (optionally if want to run through containers)
To build the Docker image, run

```bash
docker build -t your-dockerhub-username/course-compass-frontend:latest -f Dockerfile.frontend .
docker build -t your-dockerhub-username/course-compass-backend:latest -f Dockerfile.backend .
```

## AI Integration

Search and ingest use the Vercel AI SDK for embeddings via `apps/backend-nest/src/ai/ai.service.ts`.

Add `AI_GATEWAY_API_KEY` to `apps/backend-nest/.env.local`:

```env
AI_GATEWAY_API_KEY=your_key_here
```

Get a key at [vercel.com/dashboard → AI Gateway → API Keys](https://vercel.com/dashboard/ai-gateway/api-keys).

## Agent Files

This repo also includes short root-level agent instruction files:

- `AGENTS.md` for Codex/OpenAI-style agents
- `CLAUDE.md` for Claude-oriented workflows

Both files are intentionally concise and point agents to the same core project facts: workspace layout, common commands, and where the AI SDK integration lives.

Repo-local agent skills live under `.agents/skills/`. Right now the repo includes:

- `.agents/skills/ai-sdk/SKILL.md` for AI SDK-specific guidance used in this codebase

## Available Scripts

The following scripts are available to be run from the root directory:

| Script         | Description                                        |
| -------------- | -------------------------------------------------- |
| `bun run dev`      | Starts the frontend and backend development servers. |
| `bun run dev:fe`   | Starts the frontend development server.            |
| `bun run dev:be`   | Starts the backend development server.             |
| `bun run add:fe`   | Adds a dependency to the frontend workspace.     |
| `bun run add:be`   | Adds a dependency to the backend workspace.      |
| `bun run rm:fe`    | Removes a dependency from the frontend workspace.  |
| `bun run rm:be`    | Removes a dependency from the backend workspace.   |

Other scripts can be found in the `package.json` files within the `apps/frontend` and `apps/backend-nest` directories.
