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
-   [npm](https://www.npmjs.com/) (comes with Node.js)
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
npm i
```

### 3. Set Up Environment Variables

You'll need to create two `.env` files, one for the backend and one for the frontend.

**Backend (`backend-nest/.env`)**

Create a file at `backend-nest/.env` and add the following variables.

```env
# PostgreSQL database connection string
DATABASE_URL=postgresql://user:password@host:port/database

# ElasticSearch credentials
ELASTICSEARCH_URL=http://localhost:9200
ELASTICSEARCH_USERNAME=elastic
ELASTICSEARCH_PASSWORD= # The password you get after starting ElasticSearch

# SuperTokens Authentication
ST_CONNECTION_URI=https://try.supertokens.com
ST_API_KEY=

# Application URLs and Port
PORT=8080
WEBSITE_DOMAIN=http://localhost:3000
```

**Frontend (`frontend/.env`)**

Create a file at `frontend/.env` and add the following variables.

```env
NEXT_PUBLIC_BACKEND_DOMAIN=http://localhost:8080
NEXT_PUBLIC_WEBSITE_DOMAIN=http://localhost:3000
```

### 4. Set Up the Database

This project uses PostgreSQL and `drizzle-orm`. Make sure you have a running PostgreSQL instance and that the `DATABASE_URL` in `backend-nest/.env` is configured correctly.

Once configured, run the database migrations to set up the schema:

```bash
cd backend-nest
npm run db:generate
npm run db:push
```

### 5. Start ElasticSearch

You can run a local instance of ElasticSearch using Docker. The following command will download and start it.

```bash
curl -fsSL https://elastic.co/start-local | sh
```

When the process has finished, it will print a password for the `elastic` user. **Make sure to copy this password and add it to the `ELASTICSEARCH_PASSWORD` variable in your `backend-nest/.env` file.**

### 6. Start the Development Servers

You can now start the backend and frontend servers.

**Start the Backend**

```bash
npm run dev:be
```

**Start the Frontend**

```bash
npm run dev:fe
```

The frontend will be available at [http://localhost:3000](http://localhost:3000).

### 7. Ingest Data

After the backend has started, you can ingest course data into ElasticSearch by running the following command:

```bash
curl -X POST "http://localhost:8080/ingest/courses"
```

This process may take some time. You can monitor the logs from the backend server for progress.

### 8. Build Docker Image (optionally if want to run through containers)
To build the Docker image, run

```bash
docker build -t your-dockerhub-username/course-compass-frontend:latest -f Dockerfile.frontend .
docker build -t your-dockerhub-username/course-compass-backend:latest -f Dockerfile.backend .
```

## AI Integration

This app uses the Vercel AI SDK in both workspaces:

- `backend-nest` uses `ai` for the agent, tool calling, streaming responses, and embeddings.
- `frontend` uses `@ai-sdk/react` and `ai` for chat transport, typed UI messages, and rendering tool results.

### Setup

Add `AI_GATEWAY_API_KEY` to `backend-nest/.env.local`:

```env
AI_GATEWAY_API_KEY=your_key_here
```

Get a key at [vercel.com/dashboard → AI Gateway → API Keys](https://vercel.com/dashboard/ai-gateway/api-keys).

The frontend does not need a model provider key. It only needs `NEXT_PUBLIC_BACKEND_DOMAIN`, which is already part of the frontend setup above.

### End-to-End Flow

```
Browser (/ai-demo, useChat + DefaultChatTransport)
  → POST <NEXT_PUBLIC_BACKEND_DOMAIN>/ai/chat
  → NestJS AiController
  → kthCourseAgent (ToolLoopAgent)
    → retrieveKthCourses / getWeather
    → AI Gateway → openai/gpt-5.4-mini
  ← UI message stream
```

The demo currently sends requests directly from the browser to the NestJS backend. A Next.js proxy route also exists at `frontend/app/api/ai/chat/route.ts` if you want to switch to a same-origin `/api/ai/chat` path later.

### Backend Usage

| File | Role |
|---|---|
| `backend-nest/src/ai/ai.controller.ts` | Exposes `POST /ai/chat`, validates `locale` and `preferredDifficulty`, then streams the agent response with `pipeAgentUIStreamToResponse` |
| `backend-nest/src/ai/kth-course-agent.ts` | Defines the `ToolLoopAgent`, the model (`openai/gpt-5.4-mini`), base instructions, call options schema, `prepareCall` logic, and first-step tool routing |
| `backend-nest/src/ai/tools.ts` | Defines AI SDK `tool(...)` handlers for `retrieveKthCourses` and `getWeather` |
| `backend-nest/src/ai/ai.service.ts` | Provides reusable AI SDK embedding helpers via `embed`, `embedMany`, and `cosineSimilarity` using `gateway.embeddingModel(...)` |

The backend is where the actual model call happens. The current chat request body is:

```json
{
  "messages": [],
  "locale": "en",
  "preferredDifficulty": "beginner"
}
```

`locale` and `preferredDifficulty` are optional. They are parsed by `kthCourseAgentCallOptionsSchema` and injected into the agent instructions in `prepareCall(...)`.

### Frontend Usage

| File | Role |
|---|---|
| `frontend/app/(public)/ai-demo/page.tsx` | Demo chat page at `/ai-demo`, uses `useChat<KthCourseAgentUIMessage>()` with `DefaultChatTransport` |
| `frontend/types/ai/kth-course-agent.ts` | Mirrors the backend tool input/output types so tool parts are strongly typed in the UI |
| `frontend/app/api/ai/chat/route.ts` | Optional proxy route that forwards the request to the backend and preserves the AI SDK data stream headers |

The demo page renders AI SDK message parts directly:

- `text` parts become normal assistant messages.
- `tool-retrieveKthCourses` parts render tool input/output cards.
- `tool-getWeather` parts render tool input/output cards.

The frontend currently does not choose the model. The active model is fixed on the backend in `backend-nest/src/ai/kth-course-agent.ts`.

### Changing the model

Edit the `model` field in `backend-nest/src/ai/kth-course-agent.ts`:

```ts
export const kthCourseAgent = new ToolLoopAgent({
  model: "openai/gpt-5.4-mini",
  // ...
});
```

List all available models:

```bash
curl -s https://ai-gateway.vercel.sh/v1/models | jq -r '.data[].id'
```

### Demo

With both servers running, open [http://localhost:3000/ai-demo](http://localhost:3000/ai-demo).

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
| `npm run dev:fe`   | Starts the frontend development server.            |
| `npm run dev:be`   | Starts the backend development server.             |
| `npm run add:fe`   | Adds a dependency to the frontend workspace.     |
| `npm run add:be`   | Adds a dependency to the backend workspace.      |
| `npm run rm:fe`    | Removes a dependency from the frontend workspace.  |
| `npm run rm:be`    | Removes a dependency from the backend workspace.   |

Other scripts can be found in the `package.json` files within the `frontend` and `backend-nest` directories.
