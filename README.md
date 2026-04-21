# Workflow Workshop

A hands-on workshop for the Workflow SDK built on Next.js 16. The root `/` redirects to the deck at `/slides/title`; everything is a slide.

The workshop teaches **three properties of reliable software** (`stable`, `suspendable`, `undoable`) through interactive demos that break, fix, and name each pattern live. Every demo fires a real workflow run, and each pattern slide includes an `npx workflow inspect` command you can paste directly to your coding agent (Claude, Cursor, etc.) to explain the pattern or apply it to your own codebase.

For someone teaching this workshop who did not build it, start with [`PRESENTER_HANDOFF.md`](./PRESENTER_HANDOFF.md). It summarizes the core beats, stage flow, agent scenarios, and final agentic-coding CTA.

## Running It

```bash
pnpm install
pnpm dev
```

Then open `http://localhost:3000/`.

In a second terminal, start the workflow dashboard so you can watch every run as it happens:

```bash
npx workflow web
```

This gives you a live view of each workflow's timeline, step state, and payloads. Keep it open alongside the workshop — every demo fires a real run, and the dashboard lets you see exactly what the SDK is doing under the hood.

### One-time setup for the AI features

The three `DurableAgent` demos (Hello World, Autonomous, Optimize) call the Vercel AI Gateway, which authenticates with an **OIDC token** pulled from your Vercel project environment. Before the first run, link the repo and pull the env once:

```bash
npx vercel link            # associate this checkout with a Vercel project
npx vercel env pull        # writes .env.local with the OIDC token used by the gateway
```

If you skip this step the AI calls will fall back to the scripted **mock mode** described below. That is fine for working on visuals, but the real Haiku/Anthropic completions won't run. Re-run `npx vercel env pull` whenever the token rotates.

### Observing runs with `npx workflow web`

Every scenario slide fires a real Workflow run. Two CLI tools, used throughout the demo, let you watch and poke at those runs from another terminal while `pnpm dev` is up:

```bash
# Live, browser-based dashboard: timeline, step state, payloads, streams
npx workflow web
npx workflow web <runId>          # jump straight to a specific run

# Terminal-native inspection, great for scripting and quick checks
npx workflow inspect runs         # list recent runs
npx workflow inspect run <runId>  # full run detail
npx workflow inspect steps -d     # step outputs and errors
npx workflow inspect sleeps -r <runId>  # sleeping timers for a run
```

The deck surfaces these commands in five places so the audience never has to guess how to pivot from the presentation to a real run:

- **`ObservableCallout`** (slide 3, `the-setup`): an ambient emerald strip under the setup code prints `npx workflow web <run_id>` with the live run ID filled in. Clicking it opens the workflow web UI at the exact run.
- **Observability slide** (slide 6, `/slides/observability`): the dedicated "Every run is observable" payoff beat. Three cards (**Human surface** via `npx workflow web`, **Event log**, **Agent surface** via `npx workflow inspect`) make the dual-consumer story explicit before the first failure demo. Static; no polling.
- **`RunInspectCallout`** (every demo slide, i.e. 7, 10, 13, 17, 20, 23): a fixed-height emerald chip next to the headline prints `npx workflow inspect run <run_id>` with the latest run ID filled in, clickable to the workflow web UI. Lives in `DemoSlideLayout`, so every demo teaches the inspect surface passively.
- **`InspectorBand`** (every pattern slide, i.e. 9, 12, 15, 19, 22, 25): a 180px static band at the bottom renders `npx workflow inspect run <run_id>` on the left and a "Paste to your agent" caption on the right with a **Coding-Agent Friendly** badge. Inspector output is LLM-readable. Hand it to Claude / Cursor / any coding agent and ask it to explain the pattern or apply it to your codebase.
- **Debug drawer** (`Shift+D` from any slide): a single clickable `npx workflow inspect run <id>` line. The older scrolling event feed was removed. The drawer is now just the link, per the "no developer consoles on stage" rule in `.impeccable.md`.

The workflow code itself (`src/workflows/place-order.ts`) also references these commands in comments next to the behaviour they expose.

### Install the skill (the main CTA)

The final slide (`/slides/close`) hands the audience the one command the workshop asks them to run tonight:

```bash
npx skills add https://github.com/vercel/workflow --skill workflow-init
```

This installs a Claude Code / AI-agent skill that teaches coding agents how to work with the Workflow SDK on arbitrary projects. After installing, point an agent at your own repo and ask it to make a step **stable**, a workflow **suspendable**, or an operation **undoable**. The skill plus `npx workflow inspect` output is enough context for the agent to propose the correct SDK migration.

### Running without an AI Gateway

The three `DurableAgent` demos (Hello World, Autonomous, Optimize) call the Vercel AI Gateway by default. When the gateway is unreachable (offline laptop, expired key, transient outage) each demo **falls back automatically** to a scripted mock turn so the stage stays live.

Detection is handled by `src/workflows/_shared/mock-agent.ts`. The fallback triggers when:

- `agent.stream()` throws an error matching known gateway failure signatures (`AI_APICallError`, `AI_AuthenticationError`, `fetch failed`, `ENOTFOUND`, 4xx/5xx, etc.), **or**
- the `WORKFLOW_MOCK_AGENT=1` env var is set (useful to rehearse the fallback deliberately).

In mock mode:

- **Hello World agent** emits a scripted `fetchOrderDetails` turn for `ord-8842`.
- **Autonomous agent** still runs `fetchRecentOrders` / `analyzeWindow` / `appendToReport` as real workflow steps, then emits synthetic text chunks so the chat shows the scan. The report keeps growing even offline.
- **Optimize agent** emits a one-line offline notice (the interactive proposal / manager-approval / rollback dance needs the live model).

Real agent calls are unchanged. The fallback only engages when the gateway actually fails.

## Deck Structure

The deck is defined in `src/app/slides/config.ts`, a 34-slide, ~1-hour workshop built around **three properties** of reliable software: `stable`, `suspendable`, `undoable`. Those same properties then carry into three durable-agent demos. The arc:

- **Setup** (1–6): cold open, happy-path demo, the `placeOrder` starter code with the `ObservableCallout`, the three properties (`/slides/reliable-software`), the Break → Fix → Name rhythm (`/slides/how-it-works`), and the **Observability** payoff slide (`/slides/observability`) that makes the human + agent dual-consumer story explicit before the first failure demo.
- **Three properties × three beats** (7–15): each property runs the same three-beat rhythm:
  1. **Demo**: a real run fires, the scenario plays out on stage. The demo header carries a live `RunInspectCallout` with the current run ID.
  2. **Code**: the Workflow SDK fix. Directives, hooks, compensations. Short and obvious.
  3. **Pattern**: names the SDK pattern, shows real-world examples, and hands the run to an AI agent via the `InspectorBand` (`npx workflow inspect run <id>` + a "Paste to your agent" Coding-Agent Friendly caption).

  The three properties: **Stable** (idempotency), **Suspendable** (hooks), **Undoable** (saga).
- **The Pivot** (16): same durable run, new caller: agents.
- **Hello World agent** (17–19): demo / code / pattern for resumable streams (F5 proof).
- **Autonomous agent** (20–22): demo / code / pattern for a forever-running durable agent that survives a mid-loop server kill.
- **Optimize agent** (23–25): demo / code / pattern for a human-in-the-loop + undoable restaurant-manager agent.
- **Close** (26–34): **The Mirror** (foundation + workflow → agent mapping), **It is that easy** (original placeOrder overview), six `closer/*` per-line recap slides (**Stable / Suspendable / Undoable** titles, one per line of the original function) with a cumulative cadence footer, and **Ship it tonight** with the `npx skills add …` CTA.

Breadcrumbs on the grouped slides show the new vocabulary (`stable / demo`, `suspendable / code`, `undoable / pattern`) while the underlying route paths retain the original verbs (`/slides/retry/*`, `/slides/suspend/*`, `/slides/rollback/*`) for dev-link and test stability. The only route that was actually renamed is `/slides/three-verbs` → `/slides/reliable-software`, which matched the slide's own title and removed the last verb-era URL.

Presenter voice deliberately uses verbs ("retry safely", "park", "unwind") as the bridge into each property, but every audience-visible label is a property.

## Routes

Important routes:

- `/` redirects to `/slides/title`
- `/slides/title` slide 1: workshop intro
- `/slides/the-demo` slide 2: happy-path order demo
- `/slides/the-setup` slide 3: 15-line starter code + `ObservableCallout`
- `/slides/reliable-software` slide 4: introduces the stable / suspendable / undoable framing
- `/slides/how-it-works` slide 5: Break → Fix → Name rhythm
- `/slides/observability` slide 6: "Every run is observable." Human (`npx workflow web`) + Agent (`npx workflow inspect`) payoff slide
- `/slides/retry/demo` ... `/slides/retry/pattern`: **stable** property group (URL retained)
- `/slides/suspend/demo` ... `/slides/suspend/pattern`: **suspendable** property group (URL retained)
- `/slides/rollback/demo` ... `/slides/rollback/pattern`: **undoable** property group (URL retained)
- `/slides/the-pivot` slide 16: the workflows-to-agents hinge
- `/slides/first-agent/demo` ... `/slides/first-agent/pattern`: **Hello World** agent group (F5 proof; routes unchanged for stability)
- `/slides/observer/demo` ... `/slides/observer/pattern`: **Autonomous** agent group (kill-server proof of a forever loop)
- `/slides/analyst/demo` ... `/slides/analyst/pattern`: **Optimize** agent group (suspend + undo inside a restaurant-manager agent)
- `/slides/the-mirror` slide 26: foundation + workflow → agent mapping
- `/slides/it-is-that-easy` slide 27: original placeOrder overview
- `/slides/closer/step` ... `/slides/closer/replay` slides 28–33: per-line primitive recap
- `/slides/close` slide 34: Ship it tonight + `npx skills add …` hero
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
- `src/app/slides/observability/page.tsx` — dedicated observability payoff slide (slide 6)
- `src/app/slides/reliable-software/page.tsx` — the three-properties slide (slide 4; renamed from `three-verbs`)
- `src/app/slides/_components/demo-slide-layout.tsx` — shared Demo slide template; wires the `RunInspectCallout` into every demo header
- `src/app/slides/_components/pattern-slide-layout.tsx` — shared Pattern slide template (includes the inspector band)
- `src/app/slides/_components/run-inspect-callout.tsx` — fixed-height emerald `npx workflow inspect run <id>` chip lifted into every demo
- `src/app/slides/_components/inspector-band.tsx` — live `npx workflow inspect run <id>` band with the Coding-Agent Friendly badge
- `src/app/slides/_components/observable-callout.tsx` — `npx workflow web <id>` ambient callout used on `the-setup`
- `src/app/slides/_components/closer-recap-slide.tsx` — shared template for the six `/closer/*` per-line recap slides (Stable / Suspendable / Undoable titles)
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
