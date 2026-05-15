---
description: Prevent AI shortcuts — ban `any`, giant functions, and hardcoded secrets
triggers:
  - "(?i)edit"
  - "(?i)write"
  - "(?i)create"
  - "(?i)implement"
---

# Anti-Laziness Law — Absolute Enforcement

## 1. Type Evasion — Prohibited

- Using `any` is completely forbidden.
- Using `// @ts-ignore` or `// @ts-expect-error` to silence errors is forbidden.
- When type errors arise, design the correct interface/type instead.

## 2. Giant Functions / Spaghetti Code — Prohibited

- Do not cram multiple responsibilities into a single function.
- Split responsibilities into small functions and compose them as modules.

## 3. Hardcoded Secrets — Prohibited

- API keys, tokens, and passwords MUST NOT appear in source code.
- Always read from environment variables (`.env`, `process.env`, or equivalent).
