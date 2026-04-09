export type SlideInfo = {
  slug: string;
  title: string;
  number: number;
  notes: string;
};

export const SLIDES: SlideInfo[] = [
  // ─── ACT 1: The Setup ───────────────────────────────────────
  {
    slug: "title",
    title: "Cold Open",
    number: 1,
    notes: [
      "SAY: \"Tonight we're going to order some donuts — and along the way, I'm going to show you how durable execution works.\"",
      "",
      "Let the title breathe. Don't explain the directives yet.",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "demo",
    title: "The Demo",
    number: 2,
    notes: [
      "SAY: \"This is Triangle Donuts. A food delivery app. 6 steps to get donuts to your door.\"",
      "",
      "POINT to phone: \"This is what the customer sees.\"",
      "POINT to step list: \"This is what happens behind the scenes.\"",
      "",
      "SAY: \"Let me run it for you.\"",
      "",
      "TRANSITION: Press r to run the live workflow on this slide. Press Shift+R to reset.",
    ].join("\n"),
  },
  {
    slug: "naive",
    title: "What If It Crashes?",
    number: 3,
    notes: [
      "SAY: \"That was pretty smooth. But here's how it's actually built — if you were writing it the normal way.\"",
      "",
      "POINT to code: \"Six awaits. Clean, right?\"",
      "",
      "POINT to the crash comment: \"Now imagine the server restarts right there. The card was charged. The restaurant was never notified. No undo. No record.\"",
      "",
      "PAUSE — let the failure card sink in. This is the pain the audience needs to feel.",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // ─── ACT 2: The Fix ─────────────────────────────────────────
  {
    slug: "directives",
    title: "Two Lines That Change Everything",
    number: 4,
    notes: [
      "SAY: \"Here's the fix. Two words: 'use workflow' and 'use step'.\"",
      "",
      "POINT left: \"Same code as before — fragile.\"",
      "POINT right: \"Same code — but now every await is a save point. If the server crashes, it picks up where it left off.\"",
      "",
      "SAY: \"The workflow orchestrates. The steps do the work. The runtime keeps them safe.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "workflow-code",
    title: "The Real Code",
    number: 5,
    notes: [
      "SAY: \"Here's the actual file from the demo. Same structure, but with compensations and hooks wired in.\"",
      "",
      "POINT to the mini timeline on the right: \"See how it maps? Each circle is a step. The ▲ means done. The II means waiting.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "replay",
    title: "Pick Up Where You Left Off",
    number: 6,
    notes: [
      "SAY: \"So what actually happens when the server crashes?\"",
      "",
      "POINT to top timeline: \"First run. Steps 1-3 finished. Then — crash.\"",
      "POINT to bottom timeline: \"Restart. Steps 1-3? Already done. Skipped. The runtime jumps straight to step 4.\"",
      "",
      "SAY: \"The customer is never double-charged. That's the whole point.\"",
      "",
      "TRANSITION: Press r to run the live workflow on this slide. Press Shift+R to reset.",
    ].join("\n"),
  },

  // ─── ACT 3: Waiting Without Burning Money ───────────────────
  {
    slug: "sleep",
    title: "Wait Without Paying",
    number: 7,
    notes: [
      "SAY: \"New problem. What if you need to wait? Not milliseconds — days. How do you wait 7 days in a serverless function?\"",
      "",
      "POINT left: \"The old way. setTimeout dies on restart. Cron jobs are extra infrastructure. SQS maxes at 15 minutes.\"",
      "POINT right: \"sleep('7d'). One line. The workflow suspends — nothing running, nothing billing. It just... waits.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "hooks",
    title: "Wait for a Human",
    number: 8,
    notes: [
      "SAY: \"Same idea, but for people. The restaurant needs to accept the order. That could take 10 minutes.\"",
      "",
      "POINT to code: \"createHook makes a pause point. The workflow sleeps.\"",
      "POINT to the Suspended state: \"Nothing running. No cost.\"",
      "POINT to Resumed: \"When the restaurant clicks Accept, a POST wakes it up.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "tokens",
    title: "Resume from Anywhere",
    number: 9,
    notes: [
      "SAY: \"The hook has a name — a token. 'order-123-restaurant-accept'. It's predictable. You control it.\"",
      "",
      "POINT to the amber card: \"This is what the demo shows when a hook is waiting. Those accept/reject buttons? They just POST to the token.\"",
      "",
      "SAY: \"Put the token in a Slack button. An email link. A webhook. The workflow doesn't care who wakes it up.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "approval-gate",
    title: "What If They Say No?",
    number: 10,
    notes: [
      "SAY: \"Combine a hook with a timeout and you get an approval gate. Wait for the manager — but not forever.\"",
      "",
      "POINT to three outcomes: \"Approved. Rejected. Or nobody responded — auto-cancel after an hour.\"",
      "",
      "SAY: \"Let me show you hooks in the demo.\"",
      "",
      "TRANSITION: Press r to run the live workflow on this slide. Hooks are manual — accept or reject from the slide buttons. Press Shift+R to reset.",
    ].join("\n"),
  },
  {
    slug: "timeout-race",
    title: "Two Minutes or You're Out",
    number: 11,
    notes: [
      "SAY: \"This is from the actual demo code. The driver has 2 minutes to accept.\"",
      "",
      "SAY: \"Promise.race — the hook vs sleep('2m'). Whoever finishes first wins.\"",
      "",
      "POINT to outcomes: \"Accept → continue. Timeout → cancel and compensate.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // ─── ACT 4: When Things Go Wrong ────────────────────────────
  {
    slug: "saga",
    title: "Undo Everything",
    number: 12,
    notes: [
      "SAY: \"Okay — the hard question. What happens when something fails AFTER you've already charged the card?\"",
      "",
      "POINT to the stack: \"Each step registers an undo. Refund the payment. Cancel the restaurant. Release the driver.\"",
      "POINT to the code: \"On failure, pop the stack. Last in, first out.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "compensation-timeline",
    title: "Watch It Roll Back",
    number: 13,
    notes: [
      "SAY: \"The driver hook resolves with a decline, and that business outcome triggers rollback.\"",
      "",
      "POINT to fuchsia pills: \"Release driver. Cancel restaurant. Refund payment. Reverse order — last in, first out.\"",
      "",
      "SAY: \"Let me show you this live.\"",
      "",
      "TRANSITION: Press r to run the live workflow on this slide. Scripted resumes will accept the restaurant then reject the driver. Watch the fuchsia compensation pills appear in reverse order. Press Shift+R to reset.",
    ].join("\n"),
  },

  // ─── ACT 5: Composition ─────────────────────────────────────
  {
    slug: "parallel",
    title: "Do Three Things at Once",
    number: 14,
    notes: [
      "SAY: \"Now let's talk about composing workflows. What if you need to do three things at once?\"",
      "",
      "SAY: \"Promise.all. That's it. Same JavaScript you already know. Each branch is a durable step.\"",
      "",
      "POINT to the timing: \"Total time is the slowest branch — 2 seconds, not 4.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "fan-out",
    title: "Tell Everyone",
    number: 15,
    notes: [
      "SAY: \"Delivery's delayed. You need to tell everyone — customer, restaurant, driver, support. All at once.\"",
      "",
      "POINT to the results: \"allSettled. The driver notification failed, but the other three still went through. No one gets blocked by someone else's failure.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "process-manager",
    title: "The Whole Lifecycle",
    number: 16,
    notes: [
      "SAY: \"The full order lifecycle as a state machine. But there's no state machine library. It's just if/else and await.\"",
      "",
      "POINT to branches: \"Payment fails → cancel. Out of stock → sleep and recheck. The runtime makes the branching durable.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // ─── ACT 6: The Payoff ──────────────────────────────────────
  {
    slug: "streaming",
    title: "Watch It Happen",
    number: 17,
    notes: [
      "SAY: \"Last piece. Every colored line you saw in the event feed? That's a real workflow event, streamed to the browser.\"",
      "",
      "POINT to code: \"getWritable() gives you a stream in any step. Write events, they show up as lines on the dashboard.\"",
      "",
      "SAY: \"No polling. No WebSockets. Just HTTP.\"",
      "",
      "TRANSITION: Press r to run the live workflow on this slide. Point at the live event feed. \"That's getWritable in action.\" Then press →.",
    ].join("\n"),
  },

  // ─── ACT 7: The Details ─────────────────────────────────────
  {
    slug: "idempotency",
    title: "Never Charge Twice",
    number: 18,
    notes: [
      "SAY: \"Here's a detail that matters. Every step gets a unique, deterministic ID — stepId. And the runtime tracks which attempt you're on.\"",
      "",
      "POINT to the idempotencyKey line: \"Pass stepId to any external API as a deduplication key. If the step retries, the same key goes out — the API deduplicates.\"",
      "",
      "SAY: \"You get this for free. No UUIDs. No database. The demo proves it — run 'Rate limit payment once' and watch the same stepId appear on both attempts.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "errors",
    title: "Three Kinds of Failure",
    number: 19,
    notes: [
      "SAY: \"Three levels of errors. An uncaught Error? The runtime retries automatically. A FatalError? Stop retrying — start compensating. A RetryableError? You choose exactly when to retry.\"",
      "",
      "POINT to the retry timeline: \"Two attempts. First one throws RetryableError with retryAfter: '2s'. Second one succeeds — same stepId. That's the exact demo behavior.\"",
      "",
      "SAY: \"The demo 'Rate limit payment once' scenario shows this live. One retry, same stepId, controlled backoff.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "serialization",
    title: "Data Crosses Boundaries",
    number: 20,
    notes: [
      "SAY: \"One gotcha before we wrap up. Data between workflows and steps is copied, not shared.\"",
      "",
      "POINT to the trap: \"If you mutate an object inside a step, the workflow doesn't see it. You have to return the new value.\"",
      "",
      "SAY: \"This is why it works — each step gets a snapshot, not a shared reference.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // ─── ACT 8: Go Build ────────────────────────────────────────
  {
    slug: "close",
    title: "Ship It",
    number: 21,
    notes: [
      "SAY: \"That's the Workflow SDK. Two words — 'use workflow' and 'use step'. Everything else follows from there.\"",
      "",
      "POINT to each pill: \"Hooks for waiting. Streaming for real-time. Sagas for cleanup.\"",
      "",
      "SAY: \"The open-source Workflow Development Kit is the SDK on stage tonight. Vercel Workflow is the managed platform built on top of it.\"",
      "NOTE: Public docs still label managed Vercel Workflow Beta. Only switch to: \"Workflow is GA tonight\" after same-day product confirmation.",
      "",
      "PAUSE for applause.",
      "",
      "OPTIONAL: Press d to jump to the main demo for one final victory lap.",
    ].join("\n"),
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
