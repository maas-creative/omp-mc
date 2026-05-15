[English](README.md) | [日本語](README.ja.md)

<p align="center">
  <img src="https://github.com/can1357/oh-my-pi/blob/main/assets/hero.png?raw=true" alt="omp-mc" width="600">
</p>

<h1 align="center">omp-mc</h1>
<p align="center">
  <strong>Maas Creative distribution of <a href="https://github.com/can1357/oh-my-pi">oh-my-pi</a></strong><br>
  AI agents that cannot ship bad code — mechanically enforced.
</p>

<p align="center">
  <a href="https://github.com/maas-creative/omp-mc/actions/workflows/sync-upstream.yml">
    <img src="https://github.com/maas-creative/omp-mc/actions/workflows/sync-upstream.yml/badge.svg" alt="Sync with upstream">
  </a>
  <a href="https://github.com/can1357/oh-my-pi/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/can1357/oh-my-pi?style=flat&colorA=222222&colorB=58A6FF" alt="MIT License">
  </a>
</p>

---

## What is omp-mc?

`omp-mc` is a fork of [oh-my-pi](https://github.com/can1357/oh-my-pi) that adds **mandatory BDD-driven development and mechanical auditing** on top of the base agent.

The philosophy: **replace AI's subjective "looks good to me" with OSS tools that return an objective Exit Code.**

An AI agent running under `omp-mc` cannot:
- Write code before a Gherkin spec exists
- Mark a task as done before `cucumber-js`, `depcruise`, `spectral`, `stryker`, and `npm audit` all pass
- Use `any`, `@ts-ignore`, hardcoded secrets, or write giant functions
- Call itself "done" while Exit Code is anything other than `0`

---

## What's added vs upstream

### Rules (`.omp/rules/`)

| File | When it fires | What it enforces |
|------|--------------|-----------------|
| `01-gherkin-enforcer.md` | Before any `edit` / `write` / `implement` | A `.feature` (Gherkin) spec **must** exist before touching code |
| `02-mechanical-audit.md` | Before any `resolve` / task completion | All 5 OSS audit commands must return Exit Code 0 |
| `03-anti-laziness.md` | Before any `edit` / `write` / `implement` | Bans `any`, `@ts-ignore`, giant functions, hardcoded secrets |

### Agents (`.omp/agents/`)

| File | Role |
|------|------|
| `spec.md` | Spec-only subagent. Writes Gherkin, OpenAPI, ArchUnit rules — never code. Called automatically when a spec is missing. |

### Audit pipeline (`npm run audit`)

The 5 OSS tools enforced at every task resolution:

1. **`cucumber-js`** — Gherkin scenario pass rate must be 100%
2. **`depcruise src`** — No architecture dependency violations
3. **`spectral lint openapi.yaml`** — API contract must match spec (when applicable)
4. **`stryker run`** — Mutation testing: tests must fail when code is broken
5. **`npm audit`** — No High or Critical vulnerabilities

---

## Installation

### Step 0 — Install the base oh-my-pi binary

`omp-mc` is a **configuration fork** — it layers on top of the base `oh-my-pi` binary. Install it first:

```bash
# macOS / Linux
curl -fsSL https://omp.sh/install | sh

# Bun (recommended)
bun install -g @oh-my-pi/pi-coding-agent
```

### Step 1 — Install the OSS audit tools

```bash
npm install -g @cucumber/cucumber @stoplight/spectral-cli dependency-cruiser stryker-cli
```

### Step 2 — Clone omp-mc and run the installer

```bash
git clone https://github.com/maas-creative/omp-mc.git
cd omp-mc

# Edit your preferred models (3 lines)
nano models.env

# Apply rules, agents, and model config globally
./install.sh
```

`install.sh` will:
- Verify the 5 OSS audit tools are installed globally
- Symlink `.omp/rules/` and `.omp/agents/` into `~/.omp/`
- Write model assignments to `~/.zshrc` (idempotent — safe to re-run)

---

## Model configuration

Edit **`models.env`** to change which model handles each agent role.
Re-run `./install.sh` (or `source models.env`) to apply.

```bash
# models.env

# 🧠 監査役・思考役 (設計、仕様解読、コードレビュー)
PI_SLOW_MODEL="openai-codex/gpt-5.5:low"

# 📐 設計役 (アーキテクチャ設計・タスク計画)
PI_PLAN_MODEL="openai-codex/gpt-5.5:low"

# ⚡ 実装ワーカー (コーディング、テスト作成、監査ループ消化)
PI_SMOL_MODEL="opencode-go/deepseek-v4-pro"
```

Available provider examples:

| Model ID | Description |
|----------|-------------|
| `openai-codex/gpt-5.5:low` | Codex via OpenCode subscription (low thinking) |
| `openai-codex/gpt-5.5:high` | Codex high-thinking mode |
| `opencode-go/deepseek-v4-pro` | DeepSeek V4 Pro — fast and cost-effective |
| `opencode-go/kimi-k2` | Kimi K2 |
| `opencode-go/qwen-3-235b` | Qwen3 235B |

---

## Keeping up-to-date

This repo auto-syncs with upstream `can1357/oh-my-pi` **every Monday at 09:00 JST** via GitHub Actions.

To sync manually:

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

---


## Remote access (omp-mc-remote)

`omp-mc` bundles [`@kimuson/remote-agent`](https://github.com/d-kimuson/remote-agent) integration. Once installed, you can control `omp` from your phone or another PC via a PWA — including tool approval, notifications, and session browsing.

```bash
# Start remote access (configured in models.env)
omp-mc-remote
```

### Configuration

Edit `models.env`:

```bash
# "tailscale" (default) | "lan" | "disabled"
REMOTE_MODE="tailscale"

# Port
REMOTE_PORT="44444"

# Expose via Tailscale Funnel (accessible outside VPN) — use with caution
REMOTE_TAILSCALE_FUNNEL="false"
```

Then re-run `./install.sh` to apply.

| Mode | What happens |
|------|-------------|
| `tailscale` (default) | HTTPS via Tailscale Serve. PWA + push notifications work. Auto-falls back to `lan` if Tailscale isn't installed. |
| `lan` | HTTP on the local network only. |
| `disabled` | `omp-mc-remote` alias is not created. |

> **Security**: `tailscale` mode restricts access to your tailnet. Do not use `--funnel` unless you understand the implications.

## How the enforcement loop works

```
User: "Build the login feature"
        ↓
[Rule: 01-gherkin-enforcer]
  → Is there a features/login.feature? No.
  → Delegate to spec agent: write the Gherkin first.
        ↓
[Agent: spec]
  → Writes features/login.feature (Given/When/Then)
        ↓
[Worker: PI_SMOL_MODEL = deepseek-v4-pro]
  → Implements the feature
        ↓
[Rule: 02-mechanical-audit fires on resolve]
  → Runs: cucumber-js → depcruise → spectral → stryker → npm audit
  → Exit Code 1? Back to worker. Repeat until Exit Code 0.
        ↓
✅ Task resolved. Ship it.
```

---

## License

MIT — same as upstream [oh-my-pi](https://github.com/can1357/oh-my-pi/blob/main/LICENSE).

© Maas Creative
