export type SlideInfo = {
  slug: string;
  title: string;
  number: number;
  notes: string;
  breadcrumb?: string;
};

/**
 * The 26-slide workshop arc (~1 hour).
 *
 * Act I — Setup (1–5): cold open, happy-path demo, code, reliability requirements, workshop map.
 * Act II — Three scenarios × 3 beats each (6–14): retry, slow restaurant, dispute.
 * Act III — Pivot (15): workflows → agents.
 * Act IV — First agent (16–18): demo (F5 proof), workflow code, pattern.
 * Act V — Observer agent (19–21): demo, fix, pattern.
 * Act VI — Analyst agent (22–24): demo, fix, pattern.
 * Act VII — Close (25–26): the mirror, ship it.
 */
export const SLIDES: SlideInfo[] = [
  // ─── Act I · Setup ─────────────────────────────────────────
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
    notes: "POINT at the three verbs: \"For each one, I'm going to ask — what do you do now?\"",
  },
  {
    slug: "how-it-works",
    title: "How This Workshop Works",
    number: 5,
    notes: "SAY: \"Here's the shape of the next hour. Three scenarios, three verbs. Each one gets three beats: demo, workflow code, pattern. See it break, see the fix, learn the name. Then we pivot to agents.\"",
  },

  // ─── Act II · Three scenarios × 3 beats ───────────────────

  // --- Retry ---
  {
    slug: "retry/demo",
    title: "The Retry · Demo",
    number: 6,
    breadcrumb: "retry / demo",
    notes: "PRESS r to run the idempotency scenario. Watch the retry fire with the same stepId.\n\nSAY: \"Retries happen. Networks flake. Same step can run twice. You charge your customer twice. What do you do now?\"",
  },
  {
    slug: "retry/solution",
    title: "The Retry · Workflow Code",
    number: 7,
    breadcrumb: "retry / solution",
    notes: "SAY: \"Every step gets a stable ID. Pass it to Stripe. Second call deduplicates. One line.\"",
  },
  {
    slug: "retry/pattern",
    title: "The Retry · Pattern",
    number: 8,
    breadcrumb: "retry / pattern",
    notes: "SAY: \"This is the Idempotency pattern. getStepMetadata().stepId gives you a stable key per step per retry.\"\n\nPOINT at the URL.",
  },

  // --- Slow restaurant ---
  {
    slug: "suspend/demo",
    title: "The Suspend · Demo",
    number: 9,
    breadcrumb: "suspend / demo",
    notes: "PRESS r. It pauses at pingRestaurant. Click 'Accept'.\n\nSAY: \"Restaurant takes ten minutes to accept. What do you do now?\"",
  },
  {
    slug: "suspend/solution",
    title: "The Suspend · Workflow Code",
    number: 10,
    breadcrumb: "suspend / solution",
    notes: "SAY: \"createWebhook. One line gives you a URL. That URL goes to the restaurant's dashboard. They tap accept. The same workflow resumes from that line. No custom route, no resume worker.\"",
  },
  {
    slug: "suspend/pattern",
    title: "The Suspend · Pattern",
    number: 11,
    breadcrumb: "suspend / pattern",
    notes: "SAY: \"This is the Human-in-the-Loop pattern. createHook suspends the workflow and generates a token. Any external system can resume it.\"\n\nPOINT at the URL.",
  },

  // --- Dispute (driver refuses) ---
  {
    slug: "rollback/demo",
    title: "The Rollback · Demo",
    number: 12,
    breadcrumb: "rollback / demo",
    notes: "PRESS r. Let every step go green. When the fuchsia 'Dispute order' button lights up, CLICK it.\n\nSAY: \"Order delivered. All six steps green. Customer says the food never arrived. What do you do now?\"",
  },
  {
    slug: "rollback/solution",
    title: "The Rollback · Workflow Code",
    number: 13,
    breadcrumb: "rollback / solution",
    notes: "SAY: \"Push an undo for each step. The workflow's catch pops compensations in reverse. Receipts voided. Driver released. Restaurant cancelled. Payment refunded. Automatically.\"",
  },
  {
    slug: "rollback/pattern",
    title: "The Rollback · Pattern",
    number: 14,
    breadcrumb: "rollback / pattern",
    notes: "SAY: \"This is the Saga pattern — Transactions and Rollbacks. Push compensations, the workflow-body error triggers the reverse unwind. Each compensation is itself a durable step.\"\n\nPOINT at the URL.",
  },

  // ─── Act III · The Pivot ───────────────────────────────────
  {
    slug: "the-pivot",
    title: "The Pivot",
    number: 15,
    notes: "SAY: \"Same primitives — steps, hooks, compensations — now power something that looks completely different. Agents.\"\n\nPAUSE. Let the audience re-orient.",
  },

  // ─── Act IV · Agents ───────────────────────────────────────

  // --- First agent (the F5 proof) ---
  {
    slug: "first-agent/demo",
    title: "Our First Agent · Demo",
    number: 16,
    breadcrumb: "first agent / demo",
    notes: "PRESS 'Open ticket'. Let the agent stream its acknowledgement and start the tool call. While the sky-blue 'agent working — reload safe' card is pulsing, HIT F5.\n\nSAY: \"Every chat you've ever built loses the response on refresh. This one doesn't. Same run id. Same sentence. Same tool call. The stream just reconnects.\"",
  },
  {
    slug: "first-agent/solution",
    title: "Our First Agent · Workflow Code",
    number: 17,
    breadcrumb: "first agent / solution",
    notes: "SAY: \"Two directives. 'use step' makes the tool call durable. 'use workflow' makes the agent loop a run. WorkflowChatTransport on the client handles the reconnect.\"\n\nPOINT at the three numbered steps.\n\nIF ASKED about idempotency: DurableAgent handles replay automatically — no caller-supplied idempotency key needed. Run-level: start() auto-generates a runId, returned via x-workflow-run-id header. Step-level: each 'use step' tool call is cached in the event log — on reconnect the SDK replays results without re-executing. For outbound side effects (e.g. charging a card), you should still pass getStepMetadata().stepId as an idempotency key to the external API.",
  },
  {
    slug: "first-agent/pattern",
    title: "Our First Agent · Pattern",
    number: 18,
    breadcrumb: "first agent / pattern",
    notes: "SAY: \"This is the Resumable Streams pattern. DurableAgent plus WorkflowChatTransport. The client stores the run id, reconnects to the live stream, and picks up where it left off.\"\n\nPOINT at the URL.\n\nThen: \"From here we add three verbs.\"",
  },

  // ─── Act V · Observer agent ────────────────────────────────

  // --- Observer agent ---
  {
    slug: "observer/demo",
    title: "Observer · Demo",
    number: 19,
    breadcrumb: "observer / demo",
    notes: "PRESS r. Watch the three tool-call nodes light up — scan, analyze, report — then the loop sleeps and starts again.\n\nOn Loop 2, the 'Kill server' button glows red. CLICK it mid-tool-call.\n\nWatch: dark overlay — 'SERVER DOWN'. Then 'REPLAYING EVENT LOG'. The first node comes back with a green 'cached' badge. The agent finishes without re-executing.\n\nSAY: \"Same retry primitive you already learned. Step-backed tools are durable — the event log replays them. Zero re-execution.\"",
  },
  {
    slug: "observer/solution",
    title: "Observer · Workflow Code",
    number: 20,
    breadcrumb: "observer / solution",
    notes: "SAY: \"DurableAgent. Tools are steps. The agent loop is a workflow. Restarts resume mid-thought from the last tool call.\"",
  },
  {
    slug: "observer/pattern",
    title: "Observer · Pattern",
    number: 21,
    breadcrumb: "observer / pattern",
    notes: "SAY: \"This is the Durable Agent pattern. The same workflow primitives — steps, replay, idempotency — now wrap an LLM loop.\"\n\nPOINT at the URL.",
  },

  // ─── Act VI · Analyst agent ─────────────────────────────────
  {
    slug: "analyst/demo",
    title: "Analyst · Demo",
    number: 22,
    breadcrumb: "analyst / demo",
    notes: "POINT at the phone — it IS the operator surface. Live menu up top, suggestion chips, text input, Reset and Undo at the bottom. The big panel to the left is a read-only record of what the agent and operator are doing together.\n\nTAP \"What's going wrong?\" on the phone. The analyst queries orders, proposes a menu change, and suspends on requestApproval. Phone glows amber and flips to the approval card: sku, item name, price → price, rationale.\n\nTAP Approve. An emerald dashed \"operator approved\" pill lands in the unified history column, right between requestApproval and applyMenuChange. Menu on the phone updates live — the affected item dims and picks up a hidden badge. Phone returns to idle. \"Undo previous (1)\" now lights up fuchsia.\n\nTAP a suggestion chip again or type a new question. Agent proposes another change and suspends. Approval card now also offers an Undo… button.\n\nTAP Undo previous. Checklist slides in over the phone. CHECK one or more applied changes → TAP Roll back. A fuchsia dashed \"operator requested undo\" pill lands in the history, the current approval clears, a synthetic user turn reaches the agent, and one fuchsia rollbackMenuChange pill drops for every sku.\n\nSAY: \"One phone. One history. The agent and the operator both write to the same timeline — approve, continue, undo, any decision, any time.\"",
  },
  {
    slug: "analyst/solution",
    title: "Analyst · Workflow Code",
    number: 23,
    breadcrumb: "analyst / solution",
    notes: "THIS IS THE RECAP. Point at each verb in the status pill as you name it.\n\nSAY: \"Look at this file. It's the whole workshop.\n\nRETRY — every tool on this agent is a step. If the server crashes mid-turn, the event log replays the finished tool calls. Same primitive that made the charge idempotent in Act II.\n\nSUSPEND — the approval hook. The agent awaits it. That line parks the whole loop until a human taps the phone. Same primitive that waited for the slow restaurant.\n\nROLLBACK — rollbackMenuChange is just another tool. The operator asks the agent to undo a change, the agent calls it, the compensation fires as a durable step. Same saga unwind from the dispute — but the operator is driving it through the agent.\n\nRetry, suspend, rollback. Three primitives, one file, one loop. That's the point of the whole SDK.\"\n\nPOINT at the three highlighted lines: 11 (retry), 19 (suspend), 25 (rollback).",
  },
  {
    slug: "analyst/pattern",
    title: "Analyst · Pattern",
    number: 24,
    breadcrumb: "analyst / pattern",
    notes: "SAY: \"Human-in-the-Loop Agent pattern. A DurableAgent plus a handful of workflow-level tools. One hook — created and awaited inside requestApproval — gates every change behind a human tap. A separate rollback tool stands by; the operator can point the agent at any prior applied change, any turn, and the agent calls that tool to compensate.\n\nSame primitives the workflow slides opened with — suspend and rollback — now running inside an agent loop. The operator never talks to the server directly; they talk to the agent, and the agent owns every write.\"\n\nPOINT at the URL.",
  },

  // ─── Act VII · Close ───────────────────────────────────────
  {
    slug: "the-mirror",
    title: "The Payoff",
    number: 25,
    notes: "THIS IS THE PAYOFF. Take your time.\n\nSAY: \"That's how you build reliable agents.\"\n\nPAUSE.\n\nPOINT at each pill in turn:\n- RETRY: \"Agents that survive. Streams reconnect. Tool calls replay.\"\n- SUSPEND: \"Agents that wait. Pause for a human, pick up where you left off.\"\n- ROLLBACK: \"Agents that undo. Compensations unwind the loop.\"\n\nSAY: \"Same three verbs you already learned. One SDK.\"",
  },
  {
    slug: "close",
    title: "Ship It",
    number: 26,
    notes: "SAY: \"One SDK. Workflows and agents. Steps, hooks, compensations. It's GA tonight. Go build something.\"\n\nPAUSE for applause.\n\nPress d to return to demo for a victory lap.",
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
