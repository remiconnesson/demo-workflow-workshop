export type SlideInfo = {
  slug: string;
  title: string;
  number: number;
  notes: string;
  breadcrumb?: string;
};

/**
 * The 34-slide workshop arc (~1 hour).
 *
 * Setup (1–6): cold open, happy-path demo, code, reliability properties, workshop map, observability.
 * Three properties × 3 beats each (7–15): stable, suspendable, undoable.
 * Pivot (16): workflows → agents.
 * Hello World agent (17–19): demo (F5 proof), workflow code, pattern.
 * Autonomous agent (20–22): demo, code, pattern — the forever loop.
 * Optimize agent (23–25): demo, code, pattern — restaurant manager approvals + undo.
 * Close (26–34): the mirror, closer overview, six per-line recaps, ship it.
 */
export const SLIDES: SlideInfo[] = [
  // ─── Setup ─────────────────────────────────────────────────
  {
    slug: "title",
    title: "Cold Open",
    number: 1,
    notes: "SAY: \"Tonight we're shipping the Workflow SDK to general availability. I'm going to show you an app you've already seen — a food delivery order — break it a few different ways, and then show you how the same primitives power durable agents. Let's go.\"",
  },
  {
    slug: "the-demo",
    title: "The Demo",
    number: 2,
    notes: "PRESS r to run. Let all six steps go green.\n\nSAY: \"Six steps. Validate, charge, notify, assign, track, receipt. Millions of times a day. Remember this feeling when it works — for the next hour, we're going to stress it.\"",
  },
  {
    slug: "the-setup",
    title: "The Setup",
    number: 3,
    notes: "POINT at the code: \"Six awaits. Fifteen lines. No framework. This is the version we're about to break.\"",
  },
  {
    slug: "three-verbs",
    title: "Reliable Software",
    number: 4,
    notes: "POINT at the three properties: \"Stable. Suspendable. Undoable. For each one, I'm going to ask — so what do you need from the system now?\"",
  },
  {
    slug: "how-it-works",
    title: "How This Workshop Works",
    number: 5,
    notes: "SAY: \"Here's the shape of the next hour. Three properties. Each one gets three beats: break it, fix it, name it. Same rhythm for nine slides. Then we pivot to agents.\"",
  },
  {
    slug: "observability",
    title: "Observability",
    number: 6,
    notes: "SAY: \"Before we break anything, look at how you see it. Every run leaves an event log. Humans read it in the dashboard — `npx workflow web`. Agents read it from the CLI — `npx workflow inspect`. Same run, two consumers. You'll see this link on every demo from here on.\"",
  },

  // ─── Three properties × 3 beats ────────────────────────────

  // --- Stable ---
  {
    slug: "retry/demo",
    title: "Stable · Demo",
    number: 7,
    breadcrumb: "stable / demo",
    notes: "PRESS r to run the idempotency scenario. Watch the retry fire with the same stepId.\n\nSAY: \"Retries happen. Networks flake. Same step can run twice. You charge your customer twice. So what do you need from the system now? You need the step to run again without doing the work twice. That's retrying safely. That's stable.\"",
  },
  {
    slug: "retry/solution",
    title: "Stable · Code",
    number: 8,
    breadcrumb: "stable / code",
    notes: "SAY: \"Every step gets a stable ID. Pass it to Stripe. Second call deduplicates. One line.\"",
  },
  {
    slug: "retry/pattern",
    title: "Stable · Pattern",
    number: 9,
    breadcrumb: "stable / pattern",
    notes: "SAY: \"This is the Idempotency pattern. getStepMetadata().stepId gives you a stable key per step per retry.\"\n\nPOINT at the URL.",
  },

  // --- Suspendable ---
  {
    slug: "suspend/demo",
    title: "Suspendable · Demo",
    number: 10,
    breadcrumb: "suspendable / demo",
    notes: "PRESS r. It pauses at pingRestaurant. Click 'Accept'.\n\nSAY: \"Restaurant takes ten minutes to accept. So what do you need from the system now? You need the run to park until the world catches up. That's suspendable.\"",
  },
  {
    slug: "suspend/solution",
    title: "Suspendable · Code",
    number: 11,
    breadcrumb: "suspendable / code",
    notes: "SAY: \"createWebhook. One line gives you a URL. That URL goes to the restaurant's dashboard. They tap accept. The same workflow resumes from that line. No custom route, no resume worker.\"",
  },
  {
    slug: "suspend/pattern",
    title: "Suspendable · Pattern",
    number: 12,
    breadcrumb: "suspendable / pattern",
    notes: "SAY: \"This is the Human-in-the-Loop pattern. createHook suspends the workflow and generates a token. Any external system can resume it.\"\n\nPOINT at the URL.",
  },

  // --- Undoable ---
  {
    slug: "rollback/demo",
    title: "Undoable · Demo",
    number: 13,
    breadcrumb: "undoable / demo",
    notes: "PRESS r. Let every step go green. When the fuchsia 'Dispute order' button lights up, CLICK it.\n\nSAY: \"Order delivered. All six steps green. Customer says the food never arrived. So what do you need from the system now? You need side effects to unwind when reality changes. That's undoable.\"",
  },
  {
    slug: "rollback/solution",
    title: "Undoable · Code",
    number: 14,
    breadcrumb: "undoable / code",
    notes: "SAY: \"Push an undo for each step. The workflow's catch pops compensations in reverse. Receipts voided. Driver released. Restaurant cancelled. Payment refunded. Automatically.\"",
  },
  {
    slug: "rollback/pattern",
    title: "Undoable · Pattern",
    number: 15,
    breadcrumb: "undoable / pattern",
    notes: "SAY: \"This is the Saga pattern — Transactions and Rollbacks. Push compensations, the workflow-body error triggers the reverse unwind. Each compensation is itself a durable step.\"\n\nPOINT at the URL.",
  },

  // ─── The Pivot ─────────────────────────────────────────────
  {
    slug: "the-pivot",
    title: "The Pivot",
    number: 16,
    notes: "SAY: \"Same durable run. Now the caller is an agent. Same steps, hooks, compensations — new surface.\"\n\nPAUSE. Let the audience re-orient.",
  },

  // ─── Agents ────────────────────────────────────────────────

  // --- Hello World agent (the F5 proof) ---
  {
    slug: "first-agent/demo",
    title: "Hello World · Demo",
    number: 17,
    breadcrumb: "hello world / demo",
    notes: "PRESS 'Open ticket'. Let the agent stream its acknowledgement and start the tool call. While the sky-blue 'agent working — reload safe' card is pulsing, HIT F5.\n\nSAY: \"Every chat you've ever built loses the response on refresh. This one doesn't. Same run id. Same sentence. Same tool call. The stream just reconnects.\"",
  },
  {
    slug: "first-agent/solution",
    title: "Hello World · Code",
    number: 18,
    breadcrumb: "hello world / code",
    notes: "SAY: \"Two directives. 'use step' makes the tool call durable. 'use workflow' makes the agent loop a run. WorkflowChatTransport on the client handles the reconnect.\"\n\nPOINT at the three numbered steps.\n\nIF ASKED about idempotency: DurableAgent handles replay automatically — no caller-supplied idempotency key needed. Run-level: start() auto-generates a runId, returned via x-workflow-run-id header. Step-level: each 'use step' tool call is cached in the event log — on reconnect the SDK replays results without re-executing. For outbound side effects (e.g. charging a card), you should still pass getStepMetadata().stepId as an idempotency key to the external API.",
  },
  {
    slug: "first-agent/pattern",
    title: "Hello World · Pattern",
    number: 19,
    breadcrumb: "hello world / pattern",
    notes: "SAY: \"This is the Resumable Streams pattern. DurableAgent plus WorkflowChatTransport. The client stores the run id, reconnects to the live stream, and picks up where it left off.\"\n\nPOINT at the URL.\n\nThen: \"From here we make the agent stable, suspendable, and undoable.\"",
  },

  // ─── Autonomous agent (forever loop) ───────────────────────
  {
    slug: "observer/demo",
    title: "Autonomous · Demo",
    number: 20,
    breadcrumb: "autonomous / demo",
    notes: "PRESS r. Watch the three tool-call nodes light up — scan, analyze, report — then the loop sleeps and starts again.\n\nOn Loop 2, the 'Kill server' button glows red. CLICK it mid-tool-call.\n\nWatch: dark overlay — 'SERVER DOWN'. Then 'REPLAYING EVENT LOG'. The first node comes back with a green 'cached' badge. The agent finishes without re-executing.\n\nSAY: \"A forever loop the server can't kill. Same stable primitive you already learned — step-backed tools are durable, the event log replays them. Zero re-execution.\"",
  },
  {
    slug: "observer/solution",
    title: "Autonomous · Code",
    number: 21,
    breadcrumb: "autonomous / code",
    notes: "SAY: \"DurableAgent. Tools are steps. The agent loop is a workflow that never stops. Restarts resume mid-thought from the last tool call.\"",
  },
  {
    slug: "observer/pattern",
    title: "Autonomous · Pattern",
    number: 22,
    breadcrumb: "autonomous / pattern",
    notes: "SAY: \"This is the Durable Agent pattern — autonomous forever loop. The same workflow primitives — steps, replay, idempotency — now wrap an LLM loop that runs unattended.\"\n\nPOINT at the URL.",
  },

  // ─── Optimize agent (restaurant manager) ───────────────────
  {
    slug: "analyst/demo",
    title: "Optimize · Demo",
    number: 23,
    breadcrumb: "optimize / demo",
    notes: "POINT at the phone — it IS the restaurant manager's surface. Live menu up top, suggestion chips, text input, Reset and Undo at the bottom. The big panel to the left is a read-only record of what the agent and manager are doing together.\n\nTAP \"What's going wrong?\" on the phone. The agent queries orders, proposes a menu optimization, and suspends on requestApproval. Phone glows amber and flips to the approval card: sku, item name, price → price, rationale.\n\nTAP Approve. An emerald dashed \"manager approved\" pill lands in the unified history column, right between requestApproval and applyMenuChange. Menu on the phone updates live — the affected item dims and picks up a hidden badge. Phone returns to idle. \"Undo previous (1)\" now lights up fuchsia.\n\nTAP a suggestion chip again or type a new question. Agent proposes another optimization and suspends. Approval card now also offers an Undo… button.\n\nTAP Undo previous. Checklist slides in over the phone. CHECK one or more applied changes → TAP Roll back. A fuchsia dashed \"manager requested undo\" pill lands in the history, the current approval clears, a synthetic user turn reaches the agent, and one fuchsia rollbackMenuChange pill drops for every sku.\n\nSAY: \"One phone. One history. The agent and the manager both write to the same timeline — approve, continue, undo, any decision, any time.\"",
  },
  {
    slug: "analyst/solution",
    title: "Optimize · Code",
    number: 24,
    breadcrumb: "optimize / code",
    notes: "THIS IS THE RECAP. Point at each property in the status pill as you name it.\n\nSAY: \"Look at this file. It's the whole workshop.\n\nStable — every tool on this agent is a step. If the server crashes mid-turn, the event log replays the finished tool calls. Same primitive that made the charge idempotent earlier.\n\nSuspendable — the approval hook. The agent awaits it. That line parks the whole loop until the manager taps the phone. Same primitive that waited for the slow restaurant.\n\nUndoable — rollbackMenuChange is just another tool. The manager asks the agent to undo an optimization, the agent calls it, the compensation fires as a durable step. Same saga unwind from the dispute — but the manager is driving it through the agent.\n\nStable, suspendable, undoable. Three properties, one file, one loop. That's the point of the whole SDK.\"\n\nPOINT at the three highlighted lines: 11 (stable), 19 (suspendable), 25 (undoable).",
  },
  {
    slug: "analyst/pattern",
    title: "Optimize · Pattern",
    number: 25,
    breadcrumb: "optimize / pattern",
    notes: "SAY: \"Human-in-the-Loop Agent pattern. A DurableAgent plus a handful of workflow-level tools. One hook — created and awaited inside requestApproval — gates every optimization behind a manager tap. A separate rollback tool stands by; the manager can point the agent at any prior applied change, any turn, and the agent calls that tool to compensate.\n\nSame primitives the workflow slides opened with — suspend and rollback — now running inside an agent loop. The manager never talks to the server directly; they talk to the agent, and the agent owns every write.\"\n\nPOINT at the URL.",
  },

  // ─── Close ─────────────────────────────────────────────────
  {
    slug: "the-mirror",
    title: "The Payoff",
    number: 26,
    notes: "THIS IS THE PAYOFF. Take your time.\n\nSAY: \"That's how you build reliable agents.\"\n\nPAUSE.\n\nPOINT at each pill in turn:\n- STABLE: \"Agents that survive. Streams reconnect. Tool calls replay.\"\n- SUSPENDABLE: \"Agents that wait. Pause for a human, pick up where you left off.\"\n- UNDOABLE: \"Agents that undo. Compensations unwind the loop.\"\n\nSAY: \"Same three properties you already learned. One SDK.\"",
  },
  {
    slug: "it-is-that-easy",
    title: "It is that easy.",
    number: 27,
    notes: "SAY: \"It turns out, it is that easy — same 15 lines, but every one is durable.\"\n\nPAUSE.\n\nSAY: \"Let's walk them.\"",
  },
  {
    slug: "closer/step",
    title: "Closer · Step",
    number: 28,
    notes: "SAY: \"Validate is a step boundary. Bad input stops before charge; on retry, the result replays.\"",
  },
  {
    slug: "closer/idempotency",
    title: "Closer · Idempotency",
    number: 29,
    notes: "SAY: \"The charge line gets a stable stepId. Retry it all day; Stripe returns the first charge.\"",
  },
  {
    slug: "closer/hook",
    title: "Closer · Hook",
    number: 30,
    notes: "SAY: \"The restaurant line is a hook. The workflow parks, the process can disappear, and the tap resumes this exact await.\"",
  },
  {
    slug: "closer/sleep",
    title: "Closer · Sleep + Race",
    number: 31,
    notes: "SAY: \"Driver assignment races acceptance against durable sleep. No driver is a clean timeout, not a forever order.\"",
  },
  {
    slug: "closer/compensation",
    title: "Closer · Compensation",
    number: 32,
    notes: "SAY: \"If delivery fails, that throw walks the compensation stack backward — driver, restaurant, payment.\"",
  },
  {
    slug: "closer/replay",
    title: "Closer · Replay",
    number: 33,
    notes: "SAY: \"If the server dies here, replay resumes from the event log and the receipts still go out.\"\n\nPAUSE.\n\nSAY: \"Stable, suspendable, undoable. Same function. Now it finishes what it starts.\"",
  },
  {
    slug: "close",
    title: "Ship It",
    number: 34,
    notes: "SAY: \"One SDK. Workflows and agents. Stable, suspendable, undoable. It's GA tonight.\"\n\nPOINT at the npx skills block.\n\nSAY: \"Install the skill. Point it at your repo. Make one workflow stable, suspendable, or undoable tonight.\"",
  },
];

export function getSlideNav(slug: string) {
  const idx = SLIDES.findIndex((s) => s.slug === slug);
  return {
    current: SLIDES[idx] ?? null,
    prev: idx > 0 ? SLIDES[idx - 1] : null,
    next: idx < SLIDES.length - 1 ? SLIDES[idx + 1] : null,
    total: SLIDES.length,
  };
}
