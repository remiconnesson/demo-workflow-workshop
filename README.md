# Workflow GA Slides

A Next.js 16 presentation app for the Workflow SDK GA story. The root `/` redirects to the deck at `/slides/title`; everything is a slide.

## Running It

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000/` — it drops you on the opening slide. Arrow keys move through the deck, `r` runs the current slide's demo, `R` resets it, `n` toggles speaker notes.

### Observing runs

Every failure slide fires a real Workflow run. Two CLI tools, used throughout the demo, let you watch and poke at those runs from another terminal while `pnpm dev` is up:

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

The deck is defined in `src/app/slides/config.ts`. Act 1 is cold open + happy-path demo + setup. Act 2 is a series of **failure groups** — each group is four slides in a fixed rhythm:

1. **User story** — the failure plays out visibly on stage. A real run fires, something breaks, audience sees what goes wrong.
2. **Before** — the ad-hoc, no-framework code you'd otherwise write to cope with it (reconciliation workers, scheduler tables, idempotency tables, custom resume workers).
3. **After** — the same behaviour in Workflow SDK code: directives, hooks, sleeps, sagas, streaming. Short, durable, obvious.
4. **Agent Exploration** — names the SDK pattern and points to the cookbook/docs URL, so attendees (and their coding agents) can go explore further.

Act 3+ closes with the reveal, DurableAgent, and the ship-it slide.

The failure groups, in order:

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

- `/` redirects to `/slides/title`
- `/slides/title` opening slide — Workflow SDK intro with the follow-along repo URL (`github.com/vercel-labs/workflow-workshop`) and clone/install instructions
- `/slides/the-demo` slide 2 — happy-path order demo
- `/slides/close` final slide
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
