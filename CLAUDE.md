# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build and Development Commands

```bash
npm run dev      # Start dev server with hot reload (ts-node-dev)
npm run build    # Compile TypeScript to dist/
npm start        # Run compiled server from dist/server.js
npm test         # Run Jest tests
npm run lint     # Run ESLint
```

Run a single test file:
```bash
npx jest src/__tests__/tools/github.test.ts
```

Run tests matching a pattern:
```bash
npx jest --testNamePattern="should select bugfix"
```

## Architecture Overview

This is an **Agent Skills-first workflow engine** that processes external triggers (GitHub webhooks) through an AI agent that dynamically selects capabilities.

### Three-Layer Architecture

```
External Trigger → Agent (Decision) → Skills (Knowledge) → Tools (Execution)
```

**Key distinction**: Agent decides *what* to do, Skills teach *how* to approach tasks, Tools *execute* actions.

### Core Flow

1. **Route** (`src/routes/github.ts`) receives webhook, validates signature, checks idempotency
2. **Agent** (`src/agent/runAgent.ts`) orchestrates the decision loop:
   - Calls `selectSkills()` to match context against skill triggers
   - Loads matched skill content (SKILL.md + examples.md) into system prompt
   - Enters agent loop: call Claude → execute tool calls → repeat until done
3. **Tools** (`src/tools/`) execute concrete actions (GitHub API, filesystem, HTTP)

### Skill System

Skills are **capability packages** in `src/skills/<skill-name>/`:
- `SKILL.md` - Instructions, policies, do/don't rules
- `examples.md` - Few-shot examples for the agent

Skills are registered in `skillRegistry` array in `src/agent/skillPolicy.ts` with:
- `triggers`: conditions that activate the skill (labels, keywords, event types)
- `priority`: higher priority skills selected first when multiple match

### Idempotency

`IdempotencyGuard` (`src/jobs/IdempotencyGuard.ts`) prevents duplicate webhook processing using delivery IDs. Currently uses in-memory store (stub for persistent storage).

## Configuration

Required environment variables (see `.env.example`):
- `ANTHROPIC_API_KEY` - For Claude API calls
- `GITHUB_TOKEN` - For GitHub API operations
- `GITHUB_WEBHOOK_SECRET` - For webhook signature validation

## Code Style

- TypeScript strict mode enabled
- 2-space indentation, single quotes
- `camelCase` for files, functions, variables
- `PascalCase` for types and classes
