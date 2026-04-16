# Workflow GA Slides

A Next.js 16 presentation app for the Workflow SDK GA story. The root `/` redirects to the deck at `/slides/title`; everything is a slide.

## Running It

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000/`.

### Observing runs

Every scenario slide fires a real Workflow run. Two CLI tools, used throughout the demo, let you watch and poke at those runs from another terminal while `pnpm dev` is up:

```bash
# Live, browser-based dashboard — timeline, step state, payloads, streams
npx workflow web
npx workflow web <runId>          # jump straight to a specific run

# Terminal-native inspection — great for scripting and quick checks
npx workflow inspect runs         # list recent runs
npx workflow inspect run <runId>  # full run detail
npx workflow inspect steps -d     # step outputs and errors
npx workflow inspect sleeps -r <runId>  # sleeping timers for a run
```

When a slide starts a run, the on-screen debug drawer surfaces the `runId` and an "Open in `workflow web`" link so you can pivot from the presentation to the inspector in one click. The workflow code itself (`src/workflows/place-order.ts`) references these commands in comments next to the behaviour they expose.

## Deck Structure

The deck is defined in `src/app/slides/config.ts` — a 23-slide, ~1-hour workshop built around **three verbs**: `retry`, `suspend`, `rollback`. Those same primitives then carry into two durable-agent demos. The arc:

- **Act I · Setup** (1–5) — cold open, happy-path demo, the naive code, the three verbs, workshop map.
- **Act II · Three scenarios × three beats** (6–14) — each scenario runs the same three-beat rhythm:
  1. **Demo** — a real run fires, the scenario plays out on stage.
  2. **Workflow Code** — the Workflow SDK version. Directives, hooks, compensations. Short and obvious.
  3. **Pattern** — names the SDK pattern and links to the cookbook/docs URL.

  The three scenarios: **Retry** (idempotency), **Slow Restaurant** (suspend / hooks), **Dispute** (rollback / saga).
- **Act III · The Pivot** (15) — same primitives, new surface: agents.
- **Act IV · Observer agent** (16–18) — demo / code / pattern for a long-running durable agent.
- **Act V · Analyst agent** (19–21) — demo / code / pattern for a human-in-the-loop durable agent.
- **Act VI · Close** (22–23) — **The Mirror** (workflow ↔ agent side-by-side) and ship-it.

## Routes

Important routes:

- `/` redirects to `/slides/title`
- `/slides/title` opening slide — Workshop intro
- `/slides/the-demo` slide 2 — happy-path order demo
- `/slides/three-verbs` slide 4 — introduces the retry / suspend / rollback framing
- `/slides/the-pivot` slide 15 — the workflows-to-agents hinge
- `/slides/the-mirror` slide 22 — workflow/agent side-by-side payoff
- `/slides/close` final slide
- `/experiments` 21 DurableAgent experiment demos (7 per verb) for narrative exploration
- `/variations` index of older visual experiments

The demo slides use the Workflow runtime through Next route handlers under `src/app/api/*` and the workflow in `src/workflows/place-order.ts`.

## Slide Controls

The slide shell is implemented in `src/app/slides/layout.tsx`.

Keyboard shortcuts:

- `ArrowRight`: next slide
- `ArrowLeft`: previous slide
- `Home`: jump back to `/slides/title`
- `r`: trigger the current slide demo run
- `R`: reset the current slide demo
- `n`: toggle speaker notes

The bottom-right nav shows only the slide arrows and counter — the old standalone "Demo" link has been removed now that the demo lives inside the deck.

When a slide starts a workflow run, the layout can also show a debug drawer with run details and an optional Workflow Web UI link.

## Testing

The repo now includes browser smoke tests for the main demo and the presentation deck.

Run them with:

```bash
pnpm test:e2e
```

What the suite does:

- Starts the real Next.js app with Playwright using `playwright.config.ts`
- Verifies `/` redirects into the deck
- Verifies every slide route in `SLIDES` renders successfully
- Asserts route-specific content, slide numbering, and shared deck navigation

The tests live in `tests/e2e/slides.spec.ts`.

The slide tests are generated from `src/app/slides/config.ts`, so when you add or rename a slide in the deck config, the test coverage updates automatically with the route list.

## File Guide

High-signal files:

- `src/app/page.tsx`: root redirect to `/slides/title`
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
- The browser tests currently target the `/slides/*` deck (via the `/` redirect), not the `/v*` variations.
