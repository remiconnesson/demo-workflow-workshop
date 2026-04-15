# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md
@.impeccable.md

## Commands

- `pnpm dev` — start dev server
- `pnpm build` — production build
- `pnpm lint` — ESLint (flat config, next/core-web-vitals + typescript)
- `pnpm typecheck` — `tsc --noEmit`
- `pnpm test:e2e` — Playwright end-to-end tests (config in `playwright.config.ts`, specs in `tests/`)

## Architecture

- **Next.js 16** with App Router. Read `node_modules/next/dist/docs/` before writing any Next.js code — APIs have breaking changes from earlier versions.
- **Workflow SDK** — `next.config.ts` wraps with `withWorkflow` from `@workflow/next`. Workflow definitions live in `src/workflows/`.
- **Path alias** — `@/*` maps to `src/*`.

## Key Rules

- **CLS is a presentation-breaking bug.** Follow every rule in `.impeccable.md` principle #7 and #8. Fixed heights, opacity transitions, pre-rendered slots — no conditional DOM insertion that shifts layout.
- **No developer consoles on stage.** Event feeds, scrolling logs, config chips, and terminal-like UI are banned from slides. Use ambient visual overlays (glows, status pills, color transitions). Developer detail goes in the debug drawer only.
