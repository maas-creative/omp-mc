---
description: Absolute enforcement of the mechanical audit pipeline
triggers:
  - "(?i)resolve"
  - "(?i)I have finished"
  - "(?i)task complete"
  - "(?i)finish"
---

# Mechanical Audit — Absolute Enforcement (Global)

Before marking any task as complete, you MUST run `bun run audit` from the repo or project root.

`bun run audit` inspects what artifacts exist and only runs applicable checks:

| Check | Required artifact | What happens when missing |
|---|---|---|
| Gherkin | `features/**/*.feature` | Skipped — write specs first |
| Architecture | `src/` or `packages/` | Skipped — add code first |
| OpenAPI | `openapi.yaml` or `openapi.yml` | Skipped — add spec first |
| Mutation | Stryker config | Skipped — add config first |
| Security | Lockfile | Runs — always applicable |

**If any applicable check fails, fix and re-run. The task is NOT complete until audit evidence records `result: "pass"`.**
