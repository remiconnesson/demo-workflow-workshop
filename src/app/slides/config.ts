export type SlideInfo = {
  slug: string;
  title: string;
  number: number;
  notes: string;
};

/**
 * The 26-slide workshop arc (~1 hour).
 *
 * Act I — Setup (1–5): cold open, happy-path demo, code, three verbs, workshop map.
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
    title: "Three Verbs",
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
    slug: "retry-demo",
    title: "The Retry · Demo",
    number: 6,
    notes: "PRESS r to run the idempotency scenario. Watch the retry fire with the same stepId.\n\nSAY: \"Retries happen. Networks flake. Same step can run twice. You charge your customer twice. What do you do now?\"",
  },
  {
    slug: "retry-fix",
    title: "The Retry · Workflow Code",
    number: 7,
    notes: "SAY: \"Every step gets a stable ID. Pass it to Stripe. Second call deduplicates. One line.\"",
  },
  {
    slug: "retry-pattern",
    title: "The Retry · Pattern",
    number: 8,
    notes: "SAY: \"This is the Idempotency pattern. getStepMetadata().stepId gives you a stable key per step per retry.\"\n\nPOINT at the URL.",
  },

  // --- Slow restaurant ---
  {
    slug: "suspend-demo",
    title: "Slow Restaurant · Demo",
    number: 9,
    notes: "PRESS r. It pauses at notifyRestaurant. Click 'Restaurant accept'.\n\nSAY: \"Restaurant takes ten minutes to accept. What do you do now?\"",
  },
  {
    slug: "suspend-fix",
    title: "Slow Restaurant · Workflow Code",
    number: 10,
    notes: "SAY: \"createHook. Function suspends. Token goes to the restaurant's dashboard. They tap accept. The same workflow resumes from that line. No custom resume worker.\"",
  },
  {
    slug: "suspend-pattern",
    title: "Slow Restaurant · Pattern",
    number: 11,
    notes: "SAY: \"This is the Human-in-the-Loop pattern. createHook suspends the workflow and generates a token. Any external system can resume it.\"\n\nPOINT at the URL.",
  },

  // --- Dispute (driver refuses) ---
  {
    slug: "rollback-demo",
    title: "Dispute · Demo",
    number: 12,
    notes: "PRESS r. Let every step go green. When the fuchsia 'Dispute order' button lights up, CLICK it.\n\nSAY: \"Order delivered. All six steps green. Customer says the food never arrived. What do you do now?\"",
  },
  {
    slug: "rollback-fix",
    title: "Dispute · Workflow Code",
    number: 13,
    notes: "SAY: \"Push an undo for each step. The workflow's catch pops compensations in reverse. Receipts voided. Driver released. Restaurant cancelled. Payment refunded. Automatically.\"",
  },
  {
    slug: "rollback-pattern",
    title: "Dispute · Pattern",
    number: 14,
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
    slug: "agent-first-demo",
    title: "Our First Agent · Demo",
    number: 16,
    notes: "PRESS 'Open ticket'. Let the agent stream its acknowledgement and start the tool call. While the sky-blue 'agent working — reload safe' card is pulsing, HIT F5.\n\nSAY: \"Every chat you've ever built loses the response on refresh. This one doesn't. Same run id. Same sentence. Same tool call. The stream just reconnects.\"",
  },
  {
    slug: "agent-first-fix",
    title: "Our First Agent · Workflow Code",
    number: 17,
    notes: "SAY: \"Two directives. 'use step' makes the tool call durable. 'use workflow' makes the agent loop a run. WorkflowChatTransport on the client handles the reconnect.\"\n\nPOINT at the three numbered steps.\n\nIF ASKED about idempotency: DurableAgent just works — no idempotency key needed from the caller. Run-level: start() auto-generates a runId, returned via x-workflow-run-id header. Step-level: each 'use step' tool call is cached in the event log — on reconnect the SDK replays results without re-executing. For extra safety (e.g. charging a card), getStepMetadata() exposes a stepId you CAN use as an idempotency key, but it's opt-in, not required.",
  },
  {
    slug: "agent-first-pattern",
    title: "Our First Agent · Pattern",
    number: 18,
    notes: "SAY: \"This is the Resumable Streams pattern. DurableAgent plus WorkflowChatTransport. The client stores the run id, reconnects to the live stream, and picks up where it left off.\"\n\nPOINT at the URL.\n\nThen: \"From here we add three verbs.\"",
  },

  // ─── Act V · Observer agent ────────────────────────────────

  // --- Observer agent ---
  {
    slug: "agent-observer-demo",
    title: "Observer · Demo",
    number: 19,
    notes: "PRESS r. Let the observer agent run autonomously. Watch tool calls land as durable steps.\n\nSAY: \"An agent that monitors the system while you sleep. Long-running. Survives restarts. Resumes from its last tool call.\"",
  },
  {
    slug: "agent-observer-fix",
    title: "Observer · Workflow Code",
    number: 20,
    notes: "SAY: \"DurableAgent. Tools are steps. The agent loop is a workflow. Restarts resume mid-thought from the last tool call.\"",
  },
  {
    slug: "agent-observer-pattern",
    title: "Observer · Pattern",
    number: 21,
    notes: "SAY: \"This is the Durable Agent pattern. The same workflow primitives — steps, replay, idempotency — now wrap an LLM loop.\"\n\nPOINT at the URL.",
  },

  // ─── Act VI · Analyst agent ─────────────────────────────────
  {
    slug: "agent-analyst-demo",
    title: "Analyst · Demo",
    number: 22,
    notes: "PRESS r. The analyst reaches a decision point and pauses for human approval.\n\nSAY: \"An agent that waits for you. Mid-task, it asks a human. Then picks up exactly where it left off.\"",
  },
  {
    slug: "agent-analyst-fix",
    title: "Analyst · Workflow Code",
    number: 23,
    notes: "SAY: \"defineHook inside the agent loop. The agent suspends. A human taps approve. The same loop resumes — no re-prompt, no reconstructed context.\"",
  },
  {
    slug: "agent-analyst-pattern",
    title: "Analyst · Pattern",
    number: 24,
    notes: "SAY: \"This is the Human-in-the-Loop Agent pattern. Pair DurableAgent with defineHook. The hook you already learned, now inside the agent.\"\n\nPOINT at the URL.",
  },

  // ─── Act VII · Close ───────────────────────────────────────
  {
    slug: "the-mirror",
    title: "The Mirror",
    number: 25,
    notes: "THIS IS THE PAYOFF. Take your time.\n\nSAY: \"Left side: a workflow. Right side: an agent. Same primitives. Same durability model. One mental model for every long-running thing you build.\"\n\nPAUSE.",
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
