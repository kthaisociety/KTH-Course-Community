# KTH-Course-Community

Monorepo for a KTH course community app. Next.js hosts the UI, Better Auth, Drizzle/Neon, and the tRPC API.

## Quick Reference

- Package manager: `bun` workspaces
- App: `apps/frontend`
- Shared types: `packages/shared`
- Install: `bun i`
- Run: `bun run dev`
- Tests: `bun run test:fe`
- Ingest: `bun run ingest`

## Project Notes

- Product UI lives in `apps/frontend/features/<name>`. `app/` only routes. Feature `index.ts` is the cross-feature API (hooks, shared UI); pages import from `features/<name>/components`. tRPC routers stay in `server/api/routers`.
- Drizzle (schema, client, kit config, migrations) lives in `apps/frontend/server/db`; tRPC server in `apps/frontend/server/api`; browser tRPC client in `apps/frontend/trpc`.
- Embedding helpers live in `apps/frontend/server/ai.ts` (used by search/ingest).
- Browser calls same-origin `/api/trpc` and `/api/auth`.
- Prefer documenting real behavior from code, not intended behavior.

## Repo Agent Files

- `AGENTS.md`: concise repo guidance for OpenAI/Codex-style agents
- `CLAUDE.md`: same project guidance for Claude-oriented workflows
- `CONTEXT.md`: the project's domain language — the words to use for the people it serves
- `docs/adr/`: architecture decision records, numbered `NNNN-slug.md`
- Repo-local skills live under `.agents/skills/`
- Current repo-local skill: `.agents/skills/ai-sdk/SKILL.md`
