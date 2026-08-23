# KTH-Course-Community

Monorepo for a KTH course community app with a Next.js frontend and a NestJS backend.

## Quick Reference

- Package manager: `npm` workspaces
- Frontend: `frontend`
- Backend: `backend-nest`
- Install: `npm i`
- Run frontend: `npm run dev:fe`
- Run backend: `npm run dev:be`
- Backend tests: `npm run test:be`
- Frontend tests: `npm run test:fe`

## Project Notes

- Main AI SDK backend code lives in `backend-nest/src/ai`.
- Main AI SDK frontend demo lives in `frontend/app/(public)/ai-demo/page.tsx`.
- Frontend talks to the backend using `NEXT_PUBLIC_BACKEND_DOMAIN`.
- Prefer documenting real behavior from code, not intended behavior.

## Repo Agent Files

- `CLAUDE.md`: concise repo guidance for Claude-oriented workflows
- `AGENTS.md`: same project guidance for OpenAI/Codex-style agents
- Repo-local skills live under `.agents/skills/`
- Current repo-local skill: `.agents/skills/ai-sdk/SKILL.md`

## Agent skills

### Issue tracker

Issues and specs are tracked in GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

The default triage labels are used: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, and `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

This is a multi-context repo; use `CONTEXT-MAP.md` to locate relevant context files. See `docs/agents/domain.md`.
