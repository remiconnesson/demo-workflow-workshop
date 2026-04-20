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

When a slide starts a run, the opt-in debug drawer (`Shift+D`) surfaces the `runId` and an "Open in `workflow web`" link so you can pivot from the presentation to the inspector in one click. The workflow code itself (`src/workflows/place-order.ts`) references these commands in comments next to the behaviour they expose.

## Deck Structure

The deck is defined in `src/app/slides/config.ts` — a 33-slide, ~1-hour workshop built around **three verbs**: `retry`, `suspend`, `rollback`. Those same primitives then carry into three durable-agent demos. The arc:

- **Act I · Setup** (1–5) — cold open, happy-path demo, the setup code, the three verbs, Break → Fix → Name rhythm.
- **Act II · Three scenarios × three beats** (6–14) — each scenario runs the same three-beat rhythm:
  1. **Demo** — a real run fires, the scenario plays out on stage.
  2. **Solution** — the Workflow SDK fix. Directives, hooks, compensations. Short and obvious.
  3. **Pattern** — names the SDK pattern, shows real-world examples, and links to docs.

  The three scenarios: **Retry** (idempotency), **Suspend** (hooks), **Rollback** (saga).
- **Act III · The Pivot** (15) — same durable run, new caller: agents.
- **Act IV · First Agent** (16–18) — demo / solution / pattern for resumable streams (F5 proof).
- **Act V · Observer agent** (19–21) — demo / solution / pattern for a long-running durable agent.
- **Act VI · Analyst agent** (22–24) — demo / solution / pattern for a human-in-the-loop + rollback durable agent.
- **Act VII · Close** (25–33) — **The Mirror** (foundation + workflow → agent mapping), **It is that easy** (original placeOrder overview), six `closer/*` per-line recap slides with a cumulative cadence footer, and **Ship it tonight**.

Routes use nested paths that mirror the concept groupings (e.g., `/slides/retry/demo`, `/slides/retry/solution`, `/slides/retry/pattern`).

## Routes

Important routes:

- `/` redirects to `/slides/title`
- `/slides/title` opening slide — Workshop intro
- `/slides/the-demo` slide 2 — happy-path order demo
- `/slides/three-verbs` slide 4 — introduces the retry / suspend / rollback framing
- `/slides/retry/demo` ... `/slides/retry/pattern` — retry scenario group
- `/slides/suspend/demo` ... `/slides/suspend/pattern` — suspend scenario group
- `/slides/rollback/demo` ... `/slides/rollback/pattern` — rollback scenario group
- `/slides/the-pivot` slide 15 — the workflows-to-agents hinge
- `/slides/first-agent/demo` ... `/slides/first-agent/pattern` — first agent group
- `/slides/observer/demo` ... `/slides/observer/pattern` — observer agent group
- `/slides/analyst/demo` ... `/slides/analyst/pattern` — analyst agent group
- `/slides/the-mirror` slide 25 — foundation + workflow → agent mapping
- `/slides/it-is-that-easy` slide 26 — original placeOrder overview
- `/slides/closer/step` ... `/slides/closer/replay` slides 27–32 — per-line primitive recap
- `/slides/close` slide 33 — Ship it tonight
- `/experiments` 21 DurableAgent experiment demos (7 per verb) for narrative exploration
- `/variations` index of older visual experiments

The demo slides use the Workflow runtime through Next route handlers under `src/app/api/*` and the workflow in `src/workflows/place-order.ts`.

## Slide Controls

The slide shell is implemented in `src/app/slides/layout.tsx`.

Keyboard shortcuts:

- `ArrowRight` / `ArrowDown`: next slide (on solution slides advances through code steps first)
- `ArrowLeft` / `ArrowUp`: previous slide
- `Home`: jump back to `/slides/title`
- `r`: trigger the current slide demo run
- `R`: reset the current slide demo
- `g`: open the slide picker (Escape to close)
- `Shift+D`: toggle the debug drawer (only works once a slide has fired a run)

Arrow keys also auto-blur any focused input on a slide (e.g. the phone name/address fields), so navigation never gets stuck after the presenter touches a form element.

The bottom-right nav shows only the slide arrows and counter. When a slide starts a workflow run, the layout can also show the debug drawer with run details and an optional Workflow Web UI link.

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
