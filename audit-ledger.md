# Cross-route audit ledger — issue #134

**Base SHA:** `1e09ea574d549a84c92990a81bf8d5443a559039` (`origin/feat/frontend`, tip at
branch time and unmoved through the audit).
**Branch:** `feat/recon-audit2`.
**Date:** 2026-09-05.

## Mandate

This pass is **audit only**, per the product owner's comment "This audit is AUDIT
ONLY" on #134 (2026-09-05), which revokes step 2 of that issue's
"Implementation and PR workflow" and its "safe reconciliation fixes in one PR"
deliverable. Nothing in the application was changed. Every defect below is
recorded rather than repaired: the defect, its root cause, the file and line,
what the fix would be, and the confidence behind the claim.

The only files this branch adds are this ledger and the follow-up issues it
links. The diff contains no `.ts`, `.tsx`, `.css` or configuration change.

## Confidence key

Each finding carries a confidence rating for the *claim*, not for the fix.

- **High** — read directly off the code, or off the artboard and the code side
  by side. No inference.
- **Medium** — the code says this and the reasoning is short, but it depends on
  a runtime behaviour I did not execute (a breakpoint, an animation frame, a
  provider's internals).
- **Low** — a suspicion worth recording so it is not lost. Stated as such.

## Severity key

- **S1** — a reader loses data, or reaches a dead end with no way out.
- **S2** — a control does nothing, or does something other than what it says.
- **S3** — visible divergence from the artboard, or a parity gap between
  desktop and mobile.
- **S4** — dead code, unread fields, documentation drift. No user-visible effect.

## Gates

Run from the repository root in the audit worktree, with
`export PATH="$PATH:/c/Users/harri/.bun/bin"`.

| Gate | Baseline at `1e09ea5` | At audit end | Verdict |
|---|---|---|---|
| `bun run lint` | 400 files, 8 warnings | 400 files, 8 warnings | unchanged |
| `bun run typecheck` | exit 0 | exit 0 | unchanged |
| `bun run test:web` | 843 passed / 70 files | 843 passed / 70 files | unchanged |

The 8 lint warnings are the known baseline: unused Drizzle imports in the schema
and four other pre-existing suggestions. No test OOMed; the run completed in
37s with `Exited with code 0`, so this is a genuine pass and not the
"green report that OOMs" failure mode #134 warns about.

Because this pass changes no code, the gates are a control rather than a
verification: identical numbers at both ends confirm the environment, not the
work.

