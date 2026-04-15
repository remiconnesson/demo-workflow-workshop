export type SlideInfo = {
  slug: string;
  title: string;
  number: number;
  notes: string;
};

/**
 * The 28-slide workshop arc (~1 hour).
 *
 * Act I — Setup (1–5): cold open, happy-path demo, code, the four failures, workshop map.
 * Act II — Three workflow failures × 4 beats each (6–17): retry, slow restaurant, dispute.
 * Act III — Pivot (18): workflows → agents.
 * Act IV — Observer agent (19–22): demo, naive, fix, pattern.
 * Act V — Analyst agent (23–26): demo, naive, fix, pattern.
 * Act VI — Close (27–28): the mirror, ship it.
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
    slug: "the-four-failures",
    title: "The Four Failures",
    number: 4,
    notes: "POINT at the four failure modes: \"For each one, I'm going to ask — what do you do now?\"",
  },
  {
    slug: "how-it-works",
    title: "How This Workshop Works",
    number: 5,
    notes: "SAY: \"Here's the shape of the next hour. A handful of failures. Each one gets four beats: demo, naive, workflow code, pattern. See it break, see the pain, see the fix, learn the name. Then we pivot to agents.\"",
  },

  // ─── Act II · Three workflow failures × 4 beats ────────────

  // --- Retry ---
  {
    slug: "failure-retry-demo",
    title: "The Retry · Demo",
    number: 6,
    notes: "PRESS r to run the idempotency scenario. Watch the retry fire with the same stepId.\n\nSAY: \"Retries happen. Networks flake. Same step can run twice. You charge your customer twice. What do you do now?\"",
  },
  {
    slug: "failure-retry-naive",
    title: "The Retry · Naive",
    number: 7,
    notes: "POINT at the code: \"An idempotency keys table. Another column on orders for attempt number. A second database for your first database.\"",
  },
  {
    slug: "failure-retry-fix",
    title: "The Retry · Workflow Code",
    number: 8,
    notes: "SAY: \"Every step gets a stable ID. Pass it to Stripe. Second call deduplicates. One line.\"",
  },
  {
    slug: "failure-retry-pattern",
    title: "The Retry · Pattern",
    number: 9,
    notes: "SAY: \"This is the Idempotency pattern. getStepMetadata().stepId gives you a stable key per step per retry.\"\n\nPOINT at the URL.",
  },

  // --- Slow restaurant ---
  {
    slug: "failure-slow-restaurant-demo",
    title: "Slow Restaurant · Demo",
    number: 10,
    notes: "PRESS r. It pauses at notifyRestaurant. Click 'Restaurant accept'.\n\nSAY: \"Restaurant takes ten minutes to accept. What do you do now?\"",
  },
  {
    slug: "failure-slow-restaurant-naive",
    title: "Slow Restaurant · Naive",
    number: 11,
    notes: "POINT at the code: \"202 Accepted. Background job. A webhook endpoint. A pipeline-resume worker. Three endpoints and two workers for one logical order.\"",
  },
  {
    slug: "failure-slow-restaurant-fix",
    title: "Slow Restaurant · Workflow Code",
    number: 12,
    notes: "SAY: \"createHook. Function suspends. Token goes to the restaurant's dashboard. They tap accept. The same workflow resumes from that line. No custom resume worker.\"",
  },
  {
    slug: "failure-slow-restaurant-pattern",
    title: "Slow Restaurant · Pattern",
    number: 13,
    notes: "SAY: \"This is the Human-in-the-Loop pattern. createHook suspends the workflow and generates a token. Any external system can resume it.\"\n\nPOINT at the URL.",
  },

  // --- Dispute (driver refuses) ---
  {
    slug: "failure-driver-refuses-demo",
    title: "Dispute · Demo",
    number: 14,
    notes: "PRESS r. Let every step go green. When the fuchsia 'Dispute order' button lights up, CLICK it.\n\nSAY: \"Order delivered. All six steps green. Customer says the food never arrived. What do you do now?\"",
  },
  {
    slug: "failure-driver-refuses-naive",
    title: "Dispute · Naive",
    number: 15,
    notes: "POINT at the code: \"A compensation coordinator that walks every completed step. Refund. Cancel. Release. Get the order wrong — you refund before you cancel and now you owe the restaurant. And this only runs if your admin remembers to call it.\"",
  },
  {
    slug: "failure-driver-refuses-fix",
    title: "Dispute · Workflow Code",
    number: 16,
    notes: "SAY: \"Push an undo for each step. The workflow's catch pops compensations in reverse. Receipts voided. Driver released. Restaurant cancelled. Payment refunded. Automatically.\"",
  },
  {
    slug: "failure-driver-refuses-pattern",
    title: "Dispute · Pattern",
    number: 17,
    notes: "SAY: \"This is the Saga pattern — Transactions and Rollbacks. Push compensations, the workflow-body error triggers the reverse unwind. Each compensation is itself a durable step.\"\n\nPOINT at the URL.",
  },

  // ─── Act III · The Pivot ───────────────────────────────────
  {
    slug: "the-pivot",
    title: "The Pivot",
    number: 18,
    notes: "SAY: \"Same primitives — steps, hooks, compensations — now power something that looks completely different. Agents.\"\n\nPAUSE. Let the audience re-orient.",
  },

  // ─── Act IV · Observer agent ───────────────────────────────
  {
    slug: "agent-observer-demo",
    title: "Observer · Demo",
    number: 19,
    notes: "PRESS r. Let the observer agent run autonomously. Watch tool calls land as durable steps.\n\nSAY: \"An agent that monitors the system while you sleep. Long-running. Survives restarts. Resumes from its last tool call.\"",
  },
  {
    slug: "agent-observer-naive",
    title: "Observer · Naive",
    number: 20,
    notes: "POINT at the code: \"A chat-loop in a serverless function. Hope the process lives long enough. Re-feed context from scratch on every retry. Lose state the moment anything times out.\"",
  },
  {
    slug: "agent-observer-fix",
    title: "Observer · Workflow Code",
    number: 21,
    notes: "SAY: \"DurableAgent. Tools are steps. The agent loop is a workflow. Restarts resume mid-thought from the last tool call.\"",
  },
  {
    slug: "agent-observer-pattern",
    title: "Observer · Pattern",
    number: 22,
    notes: "SAY: \"This is the Durable Agent pattern. The same workflow primitives — steps, replay, idempotency — now wrap an LLM loop.\"\n\nPOINT at the URL.",
  },

  // ─── Act V · Analyst agent ─────────────────────────────────
  {
    slug: "agent-analyst-demo",
    title: "Analyst · Demo",
    number: 23,
    notes: "PRESS r. The analyst reaches a decision point and pauses for human approval.\n\nSAY: \"An agent that waits for you. Mid-task, it asks a human. Then picks up exactly where it left off.\"",
  },
  {
    slug: "agent-analyst-naive",
    title: "Analyst · Naive",
    number: 24,
    notes: "POINT at the code: \"Persist conversation state to Redis. Poll for approval. Reconstruct the agent on every callback. Pray nothing drifts.\"",
  },
  {
    slug: "agent-analyst-fix",
    title: "Analyst · Workflow Code",
    number: 25,
    notes: "SAY: \"defineHook inside the agent loop. The agent suspends. A human taps approve. The same loop resumes — no re-prompt, no reconstructed context.\"",
  },
  {
    slug: "agent-analyst-pattern",
    title: "Analyst · Pattern",
    number: 26,
    notes: "SAY: \"This is the Human-in-the-Loop Agent pattern. Pair DurableAgent with defineHook. The hook you already learned, now inside the agent.\"\n\nPOINT at the URL.",
  },

  // ─── Act VI · Close ────────────────────────────────────────
  {
    slug: "the-mirror",
    title: "The Mirror",
    number: 27,
    notes: "THIS IS THE PAYOFF. Take your time.\n\nSAY: \"Left side: a workflow. Right side: an agent. Same primitives. Same durability model. One mental model for every long-running thing you build.\"\n\nPAUSE.",
  },
  {
    slug: "close",
    title: "Ship It",
    number: 28,
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
