# KTH-Course-Community

Monorepo for a KTH course community app with a Next.js frontend and a NestJS backend.

## Quick Reference

- Package manager: `bun` workspaces
- Frontend: `apps/frontend`
- Backend: `apps/backend-nest`
- Shared types: `packages/shared`
- Install: `bun i`
- Run both: `bun run dev`
- Run frontend: `bun run dev:fe`
- Run backend: `bun run dev:be`
- Backend tests: `bun run test:be`
- Frontend tests: `bun run test:fe`

## Project Notes

- Embedding helpers live in `apps/backend-nest/src/ai` (used by search/ingest).
- Frontend talks to the backend using `NEXT_PUBLIC_BACKEND_DOMAIN`.
- Prefer documenting real behavior from code, not intended behavior.

## Repo Agent Files

- `CLAUDE.md`: concise repo guidance for Claude-oriented workflows
- `AGENTS.md`: same project guidance for OpenAI/Codex-style agents
- Repo-local skills live under `.agents/skills/`
- Current repo-local skill: `.agents/skills/ai-sdk/SKILL.md`
