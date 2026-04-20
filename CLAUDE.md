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

## Deck Shape

The deck is a 33-slide, ~1-hour workshop organized around **three verbs**: `retry`, `suspend`, `rollback`. Each verb follows a three-beat rhythm: **Demo → Solution → Pattern**. Acts IV–VI then reuse the same verbs for three durable-agent demos (First Agent, Observer, Analyst), and Act VII closes with `the-mirror`, `it-is-that-easy`, six `closer/*` per-line recap slides, and `close` — the side-by-side payoff, the overview, the line-by-line walk, then the shipping coda.

Routes use nested paths that mirror the concept groupings: `/slides/retry/demo`, `/slides/retry/solution`, `/slides/retry/pattern`, etc. Each grouped slide displays a breadcrumb label (e.g., "retry / demo") in the top-left corner.

See `STORY.md` for the narrative and `src/app/slides/config.ts` for the authoritative slide list. Do not reintroduce "four failures", "naive-slide", or "nine concepts" framing — that terminology was retired.

## Architecture

- **Next.js 16** with App Router. Read `node_modules/next/dist/docs/` before writing any Next.js code — APIs have breaking changes from earlier versions.
- **Workflow SDK** — `next.config.ts` wraps with `withWorkflow` from `@workflow/next`. Workflow definitions live in `src/workflows/`.
- **Path alias** — `@/*` maps to `src/*`.

## Key Rules

- **CLS is a presentation-breaking bug.** Follow every rule in `.impeccable.md` principle #7 and #8. Fixed heights, opacity transitions, pre-rendered slots — no conditional DOM insertion that shifts layout.
- **No developer consoles on stage.** Event feeds, scrolling logs, config chips, and terminal-like UI are banned from slides. Use ambient visual overlays (glows, status pills, color transitions). Developer detail goes in the debug drawer only.
