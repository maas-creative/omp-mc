# omp-mc — Maas Creative Distribution of oh-my-pi

> **This is a fork of [can1357/oh-my-pi](https://github.com/can1357/oh-my-pi)**, extended with Maas Creative's opinionated BDD-driven development and mechanical auditing standards.

[![Sync with upstream](https://github.com/maas-creative/omp-mc/actions/workflows/sync-upstream.yml/badge.svg)](https://github.com/maas-creative/omp-mc/actions/workflows/sync-upstream.yml)

---

## What's different from upstream?

`omp-mc` adds a strict quality enforcement layer on top of `oh-my-pi`. AI agents running under this distribution are **legally** bound (by prompt rules) to:

| Rule | File | What it enforces |
|------|------|-----------------|
| 🛑 BDD First | `.omp/rules/01-gherkin-enforcer.md` | Prohibits writing code before a `.feature` (Gherkin) spec exists |
| 🛡️ Mechanical Audit | `.omp/rules/02-mechanical-audit.md` | Forces `cucumber-js`, `depcruise`, `spectral`, `stryker`, `npm audit` to all pass (Exit Code 0) before resolving any task |
| 🚷 Anti-Laziness | `.omp/rules/03-anti-laziness.md` | Bans `any`, `@ts-ignore`, giant functions, and hardcoded secrets |
| 🤖 Spec Agent | `.omp/agents/spec.md` | A dedicated subagent that writes Gherkin, OpenAPI, and arch rules — never code |

The philosophy: **replace AI's subjective "looks good to me" with OSS tools that give an objective Exit Code.**

---

## Prerequisites

Install the audit OSS tools globally:

```bash
npm install -g @cucumber/cucumber @stoplight/spectral-cli dependency-cruiser stryker-cli
```

## Installation

```bash
# Clone this fork
git clone https://github.com/maas-creative/omp-mc.git ~/.omp-mc

# Apply custom rules & agents globally to oh-my-pi
ln -sf ~/.omp-mc/.omp/rules/* ~/.omp/rules/
ln -sf ~/.omp-mc/.omp/agents/* ~/.omp/agent/agents/
```

## Keeping up-to-date

This repo auto-syncs with upstream `can1357/oh-my-pi` weekly via GitHub Actions.
To pull the latest manually:

```bash
git fetch upstream
git merge upstream/main
git push origin main
```

---

## Original README

For the base `oh-my-pi` documentation, see the [upstream repository](https://github.com/can1357/oh-my-pi).
