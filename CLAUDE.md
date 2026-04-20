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

The deck is a 34-slide, ~1-hour workshop organized around **three properties** of reliable software: `stable`, `suspendable`, `undoable`. Each property follows a three-beat rhythm: **Demo → Code → Pattern**. A dedicated `observability` slide (slide 6) frames `npx workflow web` and `npx workflow inspect` as the human + agent dual-consumer surfaces before the first failure demo. Three durable-agent demos (Hello World, Autonomous, Optimize) reuse the same properties, and the close sequence lands on `the-mirror`, `it-is-that-easy`, six `closer/*` per-line recap slides, and `close` — the side-by-side payoff, the overview, the line-by-line walk, and the shipping coda with the `npx skills add …` CTA.

Route dirs retain the original verb slugs (`/slides/retry/*`, `/slides/suspend/*`, `/slides/rollback/*`) for backlink stability; only the audience-facing labels, breadcrumbs (`stable / demo`, `suspendable / code`, `undoable / pattern`, …), and presenter notes use the new vocabulary. Presenter voice still uses verbs ("retry safely", "park", "unwind") as the bridge into each property.

Every pattern slide also renders a static **inspector band** at the bottom: one live `npx workflow inspect run <id>` command on the left (auto-filled from the latest run, clickable to the workflow web UI), one "Paste to your agent" caption on the right. No scrolling, no feed — one static command per `.impeccable.md` rule #8.

See `STORY.md` for the narrative and `src/app/slides/config.ts` for the authoritative slide list. Do not reintroduce retired framings: "four failures", "naive-slide", "nine concepts", the verb-based trio label (the old name for what is now *three properties* / stable·suspendable·undoable), or "Act I/II/…" structure.

## Architecture

- **Next.js 16** with App Router. Read `node_modules/next/dist/docs/` before writing any Next.js code — APIs have breaking changes from earlier versions.
- **Workflow SDK** — `next.config.ts` wraps with `withWorkflow` from `@workflow/next`. Workflow definitions live in `src/workflows/`.
- **Path alias** — `@/*` maps to `src/*`.

## Key Rules

- **CLS is a presentation-breaking bug.** Follow every rule in `.impeccable.md` principle #7 and #8. Fixed heights, opacity transitions, pre-rendered slots — no conditional DOM insertion that shifts layout.
- **No developer consoles on stage.** Event feeds, scrolling logs, config chips, and terminal-like UI are banned from slides. Use ambient visual overlays (glows, status pills, color transitions). Developer detail goes in the debug drawer only.
