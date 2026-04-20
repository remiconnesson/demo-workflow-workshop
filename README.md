# Workflow GA Slides

A Next.js 16 presentation app for the Workflow SDK GA story. The root `/` redirects to the deck at `/slides/title`; everything is a slide.

The deck reframes the SDK around **three properties of reliable software** — `stable`, `suspendable`, `undoable` — and carries them through matching workflow and durable-agent demos.

## Running It

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000/`.

### Observing runs — `npx workflow web`

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

The deck surfaces these commands in three places so the audience never has to guess how to pivot from the presentation to a real run:

- **Observable callout** (slide 3 — `the-setup`): an ambient emerald strip under the setup code prints `npx workflow web <run_id>` with the live run ID filled in. Clicking it opens the workflow web UI at the exact run.
- **Inspector band** (every pattern slide — 8, 11, 14, 18, 21, 24): a 180px static band at the bottom renders `npx workflow inspect run <run_id>` on the left and a "Paste to your agent" caption on the right with a **Coding-Agent Friendly** badge. Inspector output is LLM-readable — hand it to Claude / Cursor / any coding agent and ask it to explain the pattern or apply it to your codebase.
- **Debug drawer** (`Shift+D` from any slide): a single clickable `npx workflow inspect run <id>` line. The older scrolling event feed was removed — the drawer is now just the link, per the "no developer consoles on stage" rule in `.impeccable.md`.

The workflow code itself (`src/workflows/place-order.ts`) also references these commands in comments next to the behaviour they expose.

### Install the skill — the main CTA

The final slide (`/slides/close`) hands the audience the one command the workshop asks them to run tonight:

```bash
npx skills add https://github.com/vercel/workflow --skill workflow-init
```

This installs a Claude Code / AI-agent skill that teaches coding agents how to work with the Workflow SDK on arbitrary projects. After installing, point an agent at your own repo and ask it to make a step **stable**, a workflow **suspendable**, or an operation **undoable** — the skill plus `npx workflow inspect` output is enough context for the agent to propose the correct SDK migration.

### Running without an AI Gateway

The three `DurableAgent` demos (First Agent, Observer, Analyst) call the Vercel AI Gateway by default. When the gateway is unreachable — offline laptop, expired key, transient outage — each demo **falls back automatically** to a scripted mock turn so the stage stays live.

Detection is handled by `src/workflows/_shared/mock-agent.ts`. The fallback triggers when:

- `agent.stream()` throws an error matching known gateway failure signatures (`AI_APICallError`, `AI_AuthenticationError`, `fetch failed`, `ENOTFOUND`, 4xx/5xx, etc.), **or**
- the `WORKFLOW_MOCK_AGENT=1` env var is set (useful to rehearse the fallback deliberately).

In mock mode:

- **First Agent** emits a scripted `fetchOrderDetails` turn for `ord-8842`.
- **Observer** still runs `fetchRecentOrders` / `analyzeWindow` / `appendToReport` as real workflow steps, then emits synthetic text chunks so the chat shows the scan — the report keeps growing even offline.
- **Analyst** emits a one-line offline notice (the interactive proposal / approval / rollback dance needs the live model).

Real agent calls are unchanged — the fallback only engages when the gateway actually fails.

## Deck Structure

The deck is defined in `src/app/slides/config.ts` — a 33-slide, ~1-hour workshop built around **three properties** of reliable software: `stable`, `suspendable`, `undoable`. Those same properties then carry into three durable-agent demos. The arc:

- **Setup** (1–5) — cold open, happy-path demo, the setup code with the `Observable` callout, the three properties, Break → Fix → Name rhythm.
- **Three properties × three beats** (6–14) — each property runs the same three-beat rhythm:
  1. **Demo** — a real run fires, the scenario plays out on stage.
  2. **Code** — the Workflow SDK fix. Directives, hooks, compensations. Short and obvious.
  3. **Pattern** — names the SDK pattern, shows real-world examples, and hands the run to an AI agent via the inspector band (`npx workflow inspect run <id>` + a "Paste to your agent" Coding-Agent Friendly caption).

  The three properties: **Stable** (idempotency), **Suspendable** (hooks), **Undoable** (saga).
- **The Pivot** (15) — same durable run, new caller: agents.
- **First Agent** (16–18) — demo / code / pattern for resumable streams (F5 proof).
- **Observer agent** (19–21) — demo / code / pattern for a long-running durable agent.
- **Analyst agent** (22–24) — demo / code / pattern for a human-in-the-loop + undoable durable agent.
- **Close** (25–33) — **The Mirror** (foundation + workflow → agent mapping), **It is that easy** (original placeOrder overview), six `closer/*` per-line recap slides with a cumulative cadence footer, and **Ship it tonight** with the `npx skills add …` CTA.

Breadcrumbs on the grouped slides show the new vocabulary — `stable / demo`, `suspendable / code`, `undoable / pattern` — while the underlying route paths keep the original verbs (`/slides/retry/*`, `/slides/suspend/*`, `/slides/rollback/*`) for backlink stability.

Presenter voice deliberately uses verbs ("retry safely", "park", "unwind") as the bridge into each property, but every audience-visible label is a property.

## Routes

Important routes:

- `/` redirects to `/slides/title`
- `/slides/title` slide 1 — workshop intro
- `/slides/the-demo` slide 2 — happy-path order demo
- `/slides/the-setup` slide 3 — 15-line starter code + Observable callout
- `/slides/three-verbs` slide 4 — introduces the stable / suspendable / undoable framing (URL kept for backlink stability)
- `/slides/how-it-works` slide 5 — Break → Fix → Name rhythm
- `/slides/retry/demo` ... `/slides/retry/pattern` — **stable** property group (URL retained)
- `/slides/suspend/demo` ... `/slides/suspend/pattern` — **suspendable** property group (URL retained)
- `/slides/rollback/demo` ... `/slides/rollback/pattern` — **undoable** property group (URL retained)
- `/slides/the-pivot` slide 15 — the workflows-to-agents hinge
- `/slides/first-agent/demo` ... `/slides/first-agent/pattern` — first agent group (F5 proof)
- `/slides/observer/demo` ... `/slides/observer/pattern` — observer agent group (kill-server proof)
- `/slides/analyst/demo` ... `/slides/analyst/pattern` — analyst agent group (suspend + undo inside an agent)
- `/slides/the-mirror` slide 25 — foundation + workflow → agent mapping
- `/slides/it-is-that-easy` slide 26 — original placeOrder overview
- `/slides/closer/step` ... `/slides/closer/replay` slides 27–32 — per-line primitive recap
- `/slides/close` slide 33 — Ship it tonight + `npx skills add …` hero
- `/experiments` 21 DurableAgent experiment demos for narrative exploration
- `/variations` index of older visual experiments

The demo slides use the Workflow runtime through Next route handlers under `src/app/api/*` and the workflow in `src/workflows/place-order.ts`. The three DurableAgent workflows live in `src/workflows/observer-agent.ts`, `src/workflows/analyst-agent.ts`, and `src/workflows/experiments/our-first-agent.ts`.

## Slide Controls

The slide shell is implemented in `src/app/slides/layout.tsx`.

Keyboard shortcuts:

- `ArrowRight` / `ArrowDown`: next slide (on **Code** slides, advances through code reveal steps first)
- `ArrowLeft` / `ArrowUp`: previous slide
- `Home`: jump back to `/slides/title`
- `r`: trigger the current slide demo run
- `R`: reset the current slide demo
- `g`: open the slide picker (Escape to close)
- `Shift+D`: toggle the debug drawer (only works once a slide has fired a run; shows the `npx workflow inspect run <id>` link)

Arrow keys also auto-blur any focused input on a slide (e.g. the phone name/address fields), so navigation never gets stuck after the presenter touches a form element.

The bottom-right nav shows only the slide arrows and counter. When a slide starts a workflow run, the layout can also show the debug drawer with run details and a clickable link to the workflow web UI.

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

- `src/app/page.tsx` — root redirect to `/slides/title`
- `src/app/slides/config.ts` — deck registry, slide ordering, breadcrumbs, and speaker notes
- `src/app/slides/layout.tsx` — slide shell, navigation, and keyboard controls
- `src/app/slides/*/page.tsx` — individual slide routes
- `src/app/slides/_components/pattern-slide-layout.tsx` — shared Pattern slide template (includes the inspector band)
- `src/app/slides/_components/inspector-band.tsx` — live `npx workflow inspect run <id>` band with the Coding-Agent Friendly badge
- `src/app/slides/_components/observable-callout.tsx` — `npx workflow web <id>` ambient callout used on `the-setup`
- `src/app/slides/_components/agent-debug-drawer.tsx` — link-only debug drawer (`Shift+D`)
- `src/app/slides/_data/scenario-groups.ts` — three workflow-demo headlines (stable / suspendable / undoable)
- `src/app/slides/_data/agent-groups.ts` — three agent-demo configs with property labels
- `src/workflows/place-order.ts` — workflow logic used by the three-property demos
- `src/workflows/observer-agent.ts`, `src/workflows/analyst-agent.ts`, `src/workflows/experiments/our-first-agent.ts` — DurableAgent workflows
- `src/workflows/_shared/mock-agent.ts` — AI-gateway fallback helper (`WORKFLOW_MOCK_AGENT=1` forces mock mode)
- `src/lib/order-run-client.ts` — client-side run orchestration and resume helpers
- `playwright.config.ts` — browser test harness
- `tests/e2e/slides.spec.ts` — root and slide smoke tests

## Notes

- This project uses `@workflow/next` via `withWorkflow(nextConfig)` in `next.config.ts`.
- The repo also contains older visual experiments under `/v1` to `/v28`. They are useful for design exploration, but the primary presentation surface is the `/slides/*` deck.
- The browser tests currently target the `/slides/*` deck (via the `/` redirect), not the `/v*` variations.
