---
description: omp-mc monorepo governance scope
condition:
  - "(?i)package"
  - "(?i)release"
  - "(?i)audit"
  - "(?i)complete"
---

# omp-mc Monorepo Governance

This repository is governed as the Maas Creative `omp-mc` distribution as a whole. Do not treat `packages/coding-agent` as the only governed package when a change touches runtime, model policy, TUI, stats, native tools, or shared utilities.

## Scope

All packages are under the same BDD + mechanical-audit governance:

- `packages/coding-agent`: CLI, tool execution, rules, hooks, and completion gates.
- `packages/agent`: tool-call lifecycle and runtime state transitions.
- `packages/ai`: model/provider policy and role separation.
- `packages/tui`: visible audit status, warnings, approvals, and failures.
- `packages/utils`: shared enforcement utilities.
- `packages/stats`: audit/session evidence and observability.
- `packages/natives`: native search, terminal, and text primitives.
- `packages/swarm-extension`: multi-agent orchestration.

## Naming

Keep upstream package names unless a task explicitly approves namespace migration. `omp-mc` is the distribution and governance layer first; npm namespace migration is a separate release decision.

## Completion

Before claiming completion, run `bun run audit` from the repo root or the target project root and ensure `.omp/audit/last-run.json` records `"result": "pass"`.
