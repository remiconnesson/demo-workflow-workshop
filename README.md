# Workflow GA Slides

This repo is a Next.js 16 presentation app for the Workflow SDK GA story.

It has three main surfaces:

- `/` is the main live demo: a Triangle Donuts order flow with a phone UI on the left and a workflow dashboard on the right.
- `/slides/*` is the presentation deck: a 42-slide failure tour that starts from a happy-path order and walks through crashes, retries, hooks, sleeps, rollbacks, streaming, fan-out, and the DurableAgent close.
- `/variations` and `/v1` through `/v28` are design explorations and alternate slide/demo treatments.

## What The App Contains

The presentation deck is defined in `src/app/slides/config.ts`.

The deck is structured as:

1. Act 1: cold open, the happy-path demo, and setup.
2. Act 2: failure groups, each in a four-slide rhythm.
3. Demo: show the failure visually.
4. Naive: show the ad hoc code you would otherwise write.
5. Workflow code: show the Workflow SDK solution.
6. Pattern: name the concept and point to the relevant docs.
7. Act 3+: the reveal, DurableAgent, and close.

The current failure groups are:

- Crash / replay
- Retry / idempotency
- Slow restaurant / hooks
- Ghost restaurant / timeout race
- Prep window / sleep
- Driver refusal / saga rollback
- Admin cancel / wake-up
- Live updates / streaming
- Fan-out / parallel delivery

## Routes

Important routes:

- `/` main presenter-friendly demo
- `/slides/title` first deck slide
- `/slides/the-demo` happy-path presentation demo
- `/slides/close` final slide
- `/variations` index of older visual experiments

The root demo uses the Workflow runtime through Next route handlers under `src/app/api/*` and the workflow in `src/workflows/place-order.ts`.

## Slide Controls

The slide shell is implemented in `src/app/slides/layout.tsx`.

Keyboard shortcuts:

- `ArrowRight`: next slide
- `ArrowLeft`: previous slide
- `d` or `Home`: return to `/`
- `r`: trigger the current slide demo run
- `R`: reset the current slide demo
- `n`: toggle speaker notes

When a slide starts a workflow run, the layout can also show a debug drawer with run details and an optional Workflow Web UI link.

## Local Development

Install dependencies:

```bash
pnpm install
```

Start the app:

```bash
pnpm dev
```

Then open:

- `http://localhost:3000/` for the main demo
- `http://localhost:3000/slides/title` for the deck
- `http://localhost:3000/variations` for the visual variations index

## Testing

The repo now includes browser smoke tests for the main demo and the presentation deck.

Run them with:

```bash
pnpm test:e2e
```

What the suite does:

- Starts the real Next.js app with Playwright using `playwright.config.ts`
- Verifies `/` renders the main demo controls
- Verifies every slide route in `SLIDES` renders successfully
- Asserts route-specific content, slide numbering, and shared deck navigation

The tests live in `tests/e2e/slides.spec.ts`.

The slide tests are generated from `src/app/slides/config.ts`, so when you add or rename a slide in the deck config, the test coverage updates automatically with the route list.

## File Guide

High-signal files:

- `src/app/page.tsx`: main live demo
- `src/app/slides/config.ts`: deck registry, ordering, and speaker notes
- `src/app/slides/layout.tsx`: slide shell, navigation, and keyboard controls
- `src/app/slides/*/page.tsx`: individual slide routes
- `src/app/variations/page.tsx`: variations index
- `src/workflows/place-order.ts`: workflow logic used by the demos
- `src/lib/order-run-client.ts`: client-side run orchestration and resume helpers
- `playwright.config.ts`: browser test harness
- `tests/e2e/slides.spec.ts`: root and slide smoke tests

## Notes

- This project uses `@workflow/next` via `withWorkflow(nextConfig)` in `next.config.ts`.
- The repo also contains older visual experiments under `/v1` to `/v28`. They are useful for design exploration, but the primary presentation surface is the `/slides/*` deck.
- The browser tests currently target the main demo and the `/slides/*` deck, not the `/v*` variations.
