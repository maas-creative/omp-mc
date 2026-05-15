# omp-mc Monorepo Governance

`omp-mc` governs the whole repository, not only `packages/coding-agent`.

Package names may remain upstream-compatible (`@oh-my-pi/*`) while the repository is operated as the Maas Creative distribution. Rename npm packages only after upstream divergence is intentional and permanent.

## Core package roles

- `packages/coding-agent`: user-facing CLI, tool execution, hooks, rules, audit gates.
- `packages/agent`: runtime state machine and tool-call lifecycle boundary.
- `packages/ai`: role-based model policy and provider behavior.
- `packages/tui`: user-visible status, audit failures, approvals, and warnings.
- `packages/utils`: shared enforcement helpers, logging, environment and filesystem utilities.
- `packages/stats`: audit/session evidence and observability surfaces.
- `packages/natives`: low-level search, terminal, text, image, and native execution primitives.
- `packages/swarm-extension`: multi-agent orchestration under the same governance gates.

## Required gates

A task is not complete until:

1. a Gherkin feature exists for implementation work;
2. edit/write operations are blocked when no feature exists;
3. completion/resolve operations are blocked until the audit evidence says pass;
4. the latest audit evidence records command, exit status, timestamp, and check results.

## Upstream compatibility

Keep upstream names, exports, and public bin names unless a change is explicitly part of a release plan. `omp-mc` may add wrappers, hooks, rules, commands, and audit policy without renaming upstream packages.
