export type SlideInfo = {
  slug: string;
  title: string;
  number: number;
  notes: string;
};

/**
 * The 24-slide failure-tour arc. Every failure concept is split
 * into two slides: a "naive" slide showing the mess you'd write
 * without the SDK, then a "fix" slide showing the Workflow SDK
 * solution + running lab. The two-slide rhythm makes the
 * comparison visible at projector scale.
 */
export const SLIDES: SlideInfo[] = [
  // ─── Act 1 · "This works." ─────────────────────────────────
  {
    slug: "title",
    title: "Cold Open",
    number: 1,
    notes: [
      "SAY: \"Tonight we're shipping the Workflow SDK to general availability. I'm going to show you an app you've already seen — a food delivery order — and then spend ten minutes breaking it in every way I can think of. For each break, I'll ask one question: what do you do now? Let's go.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "the-demo",
    title: "The Order",
    number: 2,
    notes: [
      "PRESS r to run. Let all six steps go green.",
      "",
      "SAY: \"Six steps. Validate, charge, notify, assign, track, receipt. Millions of times a day. Remember this feeling when it works — for the next ten minutes, it's not going to.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "the-setup",
    title: "One Bad Day",
    number: 3,
    notes: [
      "POINT at the code: \"Six awaits. Fifteen lines. No framework.\"",
      "POINT at the red list: \"For each one of these, I'm going to ask — what do you do now?\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // ─── Act 2 · "What do we do now?" ──────────────────────────
  // Each concept is two slides: naive (the pain) → fix (the SDK).

  // --- Crash ---
  {
    slug: "failure-crash-naive",
    title: "The Crash · Naive",
    number: 4,
    notes: [
      "SAY: \"Server dies between charge and notify. Customer has been charged. Restaurant has not been told. What do you do now?\"",
      "",
      "POINT at the code: \"Persistent orders table. A recovery worker that finds orphans on boot. But — does the recovery worker know if the interrupted call actually made it out? No. You're writing reconciliation code now. You are building a distributed systems project.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "failure-crash-fix",
    title: "The Crash · Fix",
    number: 5,
    notes: [
      "SAY: \"Or. Two directives. Watch.\"",
      "",
      "PRESS r to start the run. Let it reach ~chargePayment.",
      "CLICK 💥 Crash. Wait for the dim + 'process terminated' toast.",
      "WATCH the replay fill in + live events continue.",
      "",
      "SAY: \"Same crash. Same moment. Process came back. The runtime replayed from the event log. Customer gets their donuts. I didn't write a recovery worker. I wrote two strings.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // --- Retry ---
  {
    slug: "failure-retry-naive",
    title: "The Retry · Naive",
    number: 6,
    notes: [
      "SAY: \"Retries happen. Networks flake. Same step can run twice. You charge your customer twice. What do you do now?\"",
      "",
      "POINT at the code: \"An idempotency keys table. Another column on orders for attempt number. A second database for your first database.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "failure-retry-fix",
    title: "The Retry · Fix",
    number: 7,
    notes: [
      "PRESS r to run the idempotency scenario. Watch the retry with the same stepId.",
      "",
      "SAY: \"The SDK hands every step a stable ID. Pass it to Stripe. Second call deduplicates. One line.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // --- Slow restaurant ---
  {
    slug: "failure-slow-restaurant-naive",
    title: "Slow Restaurant · Naive",
    number: 8,
    notes: [
      "SAY: \"Restaurant takes ten minutes to accept. What do you do now?\"",
      "",
      "POINT at the code: \"202 Accepted. Background job. A webhook endpoint. A pipeline-resume worker. Three endpoints and two workers for one logical order.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "failure-slow-restaurant-fix",
    title: "Slow Restaurant · Fix",
    number: 9,
    notes: [
      "PRESS r. It pauses at notifyRestaurant. Click 'Restaurant accept'.",
      "",
      "SAY: \"createHook. Function suspends. Token goes to the restaurant's dashboard. They tap accept. Workflow resumes. No webhook endpoint.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // --- Ghost restaurant ---
  {
    slug: "failure-ghost-restaurant-naive",
    title: "The Ghost · Naive",
    number: 10,
    notes: [
      "SAY: \"Restaurant never answers. What do you do now?\"",
      "",
      "POINT at the code: \"A timeout scanner. Runs every ten seconds. Scans for stuck orders. Flips them to timeout. Kicks a reroute worker you also have to build.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "failure-ghost-restaurant-fix",
    title: "The Ghost · Fix",
    number: 11,
    notes: [
      "PRESS r. The restaurant hook races against sleep('2s'). Sleep wins. FatalError. Compensations fire.",
      "",
      "SAY: \"Promise.race a hook against a sleep. Whichever lands first wins. It's just JavaScript running durably.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // --- Prep window ---
  {
    slug: "failure-prep-window-naive",
    title: "The Wait · Naive",
    number: 12,
    notes: [
      "SAY: \"I want to wait twenty minutes for the bakery's prep window. What do you do now?\"",
      "",
      "POINT at the code: \"Scheduler table. Polling worker. You serialize the pipeline into a database row. You are rebuilding setTimeout on top of SQL.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "failure-prep-window-fix",
    title: "The Wait · Fix",
    number: 13,
    notes: [
      "PRESS r. Watch the visible 3s pause (compressed from 20m) between charge and notify.",
      "",
      "SAY: \"await sleep, twenty minutes. Function suspends. Pay for nothing. Server crashes during the sleep? Still wakes up.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // --- Driver refuses ---
  {
    slug: "failure-driver-refuses-naive",
    title: "The Refusal · Naive",
    number: 14,
    notes: [
      "SAY: \"Only driver refused the job. Fatal. You need to undo the restaurant and the charge. What do you do now?\"",
      "",
      "POINT at the code: \"Compensation coordinator. Reads the orders table. Runs reverse operations. Get the order wrong — you refund before you cancel and now you owe the restaurant.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "failure-driver-refuses-fix",
    title: "The Refusal · Fix",
    number: 15,
    notes: [
      "PRESS r. Restaurant accepts, driver declines. Watch fuchsia compensation pills fire in reverse.",
      "",
      "SAY: \"Declare a compensation on each step. SDK walks back through every success in reverse. Driver released. Restaurant cancelled. Payment refunded. Automatically.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // --- Admin cancel ---
  {
    slug: "failure-admin-cancel-naive",
    title: "Admin Cancel · Naive",
    number: 16,
    notes: [
      "SAY: \"Customer calls support. Wants to cancel the order sitting in a prep-window sleep. What do you do now?\"",
      "",
      "POINT at the code: \"Admin dashboard has to know about the sleep-scheduler table. Delete the row. Manually kick the compensation coordinator. Two systems, not in a transaction.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "failure-admin-cancel-fix",
    title: "Admin Cancel · Fix",
    number: 17,
    notes: [
      "PRESS r. Wait for the admin sleep window. CLICK the amber 'Admin cancel' button.",
      "",
      "The /api/orders/[orderId]/admin-cancel route resumes the hook AND calls getRun(runId).wakeUp(). FatalError fires, compensations unwind.",
      "",
      "SAY: \"Run.wakeUp — shipped tonight. Any sleeping workflow can be interrupted from outside.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // --- Live updates ---
  {
    slug: "failure-live-updates-naive",
    title: "Live Updates · Naive",
    number: 18,
    notes: [
      "SAY: \"Customer is staring at a spinner. What do you do now?\"",
      "",
      "POINT at the code: \"Pubsub service. WebSocket server. Redis for pub and a second Redis for sub. Handle reconnects, backpressure, ordering. Congratulations, you maintain a realtime infrastructure project.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "failure-live-updates-fix",
    title: "Live Updates · Fix",
    number: 19,
    notes: [
      "PRESS r. Watch the lab events stream in. Each step lands in real time.",
      "",
      "SAY: \"getWritable. Steps write to a stream. Client subscribes. Backend and UI stay in sync without a second system.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // --- Fan-out ---
  {
    slug: "failure-fan-out-naive",
    title: "The Fan-out · Naive",
    number: 20,
    notes: [
      "LAST FAILURE PAIR. After the fix slide, the reveal lands.",
      "",
      "SAY: \"Three notifications. Email, push, loyalty. Email is down. What do you do now?\"",
      "",
      "POINT at the code: \"Per-channel state. Per-channel retries. Per-channel idempotency. This one file is bigger than your entire placeOrder function.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },
  {
    slug: "failure-fan-out-fix",
    title: "The Fan-out · Fix",
    number: 21,
    notes: [
      "PRESS r. Watch the fan-out log events in the debug drawer.",
      "",
      "SAY: \"Promise.allSettled on three steps. Each durable independently. Email retries later. The other two finish now. It's just JavaScript, that happens to be durable.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // ─── Act 3 · The Reveal ────────────────────────────────────
  {
    slug: "the-reveal",
    title: "The Reveal",
    number: 22,
    notes: [
      "THIS IS THE WHOLE POINT. Take your time.",
      "",
      "SAY: \"Ten files. Almost nine hundred lines. A reconciliation worker, a scheduler, a coordinator, a bridge, a resume worker. Nine places to be wrong.\"",
      "",
      "PAUSE. Let the audience read the file list.",
      "",
      "POINT right: \"Or. One file. Fifteen lines. Same fifteen lines. Two directives. Every failure mode from tonight — handled.\"",
      "",
      "SAY: \"One more thing.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // ─── Act 4 · One More Thing ────────────────────────────────
  {
    slug: "one-more-thing",
    title: "DurableAgent",
    number: 23,
    notes: [
      "PRESS 'Run' inside the mock to play the scripted agent reasoning.",
      "",
      "SAY: \"Same order. Except the customer just types 'something spicy under fifteen bucks, gluten-free'. An LLM picks the restaurant. Tool calls are durable steps. The agent loop is a workflow. Every guarantee from tonight works on an AI agent out of the box. This is DurableAgent. It ships tonight.\"",
      "",
      "TRANSITION: Press →.",
    ].join("\n"),
  },

  // ─── Act 5 · Close ─────────────────────────────────────────
  {
    slug: "close",
    title: "Ship It",
    number: 24,
    notes: [
      "SAY: \"One workflow. Ten failure modes. Fifteen lines. Two directives. It's GA tonight. Go build something.\"",
      "",
      "PAUSE for applause.",
      "",
      "Press d to return to demo for a victory lap.",
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
