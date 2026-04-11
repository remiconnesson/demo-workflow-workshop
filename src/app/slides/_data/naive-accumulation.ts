export type NaiveFile = {
  name: string;
  lines: number;
  code: string;
  addedOnSlide: string;
};

export type NaiveAccumulationEntry = {
  slide: string;
  focusFile: string;
  focusHighlight?: [number, number];
  allFiles: NaiveFile[];
};

const FILE_ORDERS_TABLE: NaiveFile = {
  name: "orders-table.ts",
  lines: 42,
  addedOnSlide: "failure-crash",
  code: `// One row per order, updated before and after every step.
// If the process dies between an update and the next step,
// the "recovery worker" has to guess what actually happened.
export async function transitionOrderStatus(
  id: string,
  from: OrderStatus,
  to: OrderStatus,
  fields?: Partial<OrderRow>,
) {
  await db.orders.update({
    where: { id, status: from },
    data: { status: to, updatedAt: new Date(), ...fields },
  });
}

await transitionOrderStatus(id, "new", "charging");
const payment = await stripe.charges.create({ amount })
await transitionOrderStatus(id, "charging", "notifying", { paymentId: payment.id })
await sendToRestaurant(id)
await transitionOrderStatus(id, "notifying", "assigning")
// ...and four more of these`,
};

const FILE_RECOVERY_WORKER: NaiveFile = {
  name: "recovery-worker.ts",
  lines: 38,
  addedOnSlide: "failure-crash",
  code: `// Runs on boot. Finds orphans. Doesn't actually know whether
// the interrupted external call landed or not.
const STUCK_STATES = ["charging", "notifying", "assigning", "tracking"] as const

setInterval(async () => {
  const stuck = await db.orders.findMany({
    where: { status: { in: STUCK_STATES } },
  })
  for (const order of stuck) {
    // we don't know if stripe/kitchen/dispatch actually got the call
    // we need to query each external system and reconcile
    // ???
    await reconcile(order)
  }
}, 5_000)`,
};

const FILE_IDEMPOTENCY_KEYS: NaiveFile = {
  name: "idempotency-keys.ts",
  lines: 31,
  addedOnSlide: "failure-retry",
  code: `// Every external call needs a stable key per retry.
// Which means we need to know which retry we're on.
// Which means another column on orders. Of course.
export async function idempotentCharge(orderId: string, amount: number) {
  const attempt = await db.orders
    .findUniqueOrThrow({ where: { id: orderId } })
    .then((o) => o.chargeAttempt + 1)
  const key = \`charge:\${orderId}:\${attempt}\`
  const existing = await db.idempotencyKeys.findUnique({ where: { key } })
  if (existing) return existing.result as Charge
  const result = await stripe.charges.create({ amount, idempotencyKey: key })
  await db.idempotencyKeys.create({ data: { key, result } })
  await db.orders.update({
    where: { id: orderId },
    data: { chargeAttempt: attempt },
  })
  return result
}`,
};

const FILE_RESTAURANT_WEBHOOK: NaiveFile = {
  name: "restaurant-webhook.ts",
  lines: 54,
  addedOnSlide: "failure-slow-restaurant",
  code: `// We can't hold an HTTP request open for 10 minutes, so
// place-order returns 202, the pipeline splits, and the
// restaurant answers back through a webhook endpoint.
export async function POST(req: Request) {
  const sig = req.headers.get("x-restaurant-signature")
  if (!verifySig(sig, await req.text())) return new Response("bad sig", { status: 401 })
  const { orderId, accepted, reason } = await req.json()
  await db.orders.update({
    where: { id: orderId, status: "awaiting_restaurant" },
    data: {
      status: accepted ? "assigning" : "rejected",
      restaurantAcceptedAt: new Date(),
      restaurantRejectReason: reason ?? null,
    },
  })
  if (accepted) {
    await pipelineQueue.enqueue({ orderId, resumeAt: "assignDriver" })
  } else {
    await compensationQueue.enqueue({ orderId })
  }
  return new Response("ok")
}`,
};

const FILE_PIPELINE_RESUME_WORKER: NaiveFile = {
  name: "pipeline-resume-worker.ts",
  lines: 62,
  addedOnSlide: "failure-slow-restaurant",
  code: `// Picks up where the place-order endpoint left off.
// A second copy of the pipeline, keyed off which step to resume at.
pipelineQueue.process(async (job) => {
  const { orderId, resumeAt } = job.data
  const order = await db.orders.findUniqueOrThrow({ where: { id: orderId } })
  switch (resumeAt) {
    case "assignDriver": {
      const driver = await dispatcher.assign(order)
      await transitionOrderStatus(order.id, "assigning", "awaiting_driver", { driverId: driver.id })
      await dispatcher.sendOffer(driver.id, order.id)
      return
    }
    case "trackDelivery": { /* ... */ return }
    case "sendReceipt":   { /* ... */ return }
  }
})`,
};

const FILE_TIMEOUT_SCANNER: NaiveFile = {
  name: "timeout-scanner.ts",
  lines: 36,
  addedOnSlide: "failure-ghost-restaurant",
  code: `// A separate scheduled job that scans for orders stuck
// in each waiting state beyond their deadline, flips them
// to a timeout state, and kicks a reroute worker.
const TIMEOUTS = {
  awaiting_restaurant: 2 * 60_000,
  awaiting_driver: 2 * 60_000,
} as const

setInterval(async () => {
  for (const [status, deadline] of Object.entries(TIMEOUTS)) {
    const stuck = await db.orders.findMany({
      where: { status, updatedAt: { lt: new Date(Date.now() - deadline) } },
    })
    for (const order of stuck) {
      await db.orders.update({
        where: { id: order.id },
        data: { status: "timed_out" },
      })
      await rerouteQueue.enqueue({ orderId: order.id })
    }
  }
}, 10_000)`,
};

const FILE_SLEEP_SCHEDULER: NaiveFile = {
  name: "sleep-scheduler.ts",
  lines: 44,
  addedOnSlide: "failure-prep-window",
  code: `// Rebuilding setTimeout on top of SQL. We store the rest
// of the pipeline as a payload so the worker can resume
// where we left off — which means the payload has to know
// what was going to happen next.
export async function scheduleResume(orderId: string, at: Date, next: ResumeStep, payload: unknown) {
  await db.sleepQueue.create({
    data: { orderId, at, next, payload: JSON.stringify(payload) },
  })
}

setInterval(async () => {
  const due = await db.sleepQueue.findMany({
    where: { at: { lte: new Date() } },
    take: 50,
  })
  for (const row of due) {
    await db.sleepQueue.delete({ where: { id: row.id } })
    await pipelineQueue.enqueue({
      orderId: row.orderId,
      resumeAt: row.next,
      payload: JSON.parse(row.payload),
    })
  }
}, 1_000)`,
};

const FILE_COMPENSATION_COORDINATOR: NaiveFile = {
  name: "compensation-coordinator.ts",
  lines: 72,
  addedOnSlide: "failure-driver-refuses",
  code: `// When something fatal happens, walk backwards through the
// order's state and run reverse operations in the right order.
// Get the order wrong and you refund before you cancel — now
// you owe the restaurant for food you told them to throw out.
export async function compensate(orderId: string, reason: string) {
  const order = await db.orders.findUniqueOrThrow({ where: { id: orderId } })
  const ops: (() => Promise<void>)[] = []

  if (order.driverId) {
    ops.push(() => dispatcher.releaseDriver(order.driverId!))
  }
  if (order.restaurantAcceptedAt) {
    ops.push(() => kitchen.cancel(order.id))
  }
  if (order.paymentId) {
    ops.push(() => stripe.refunds.create({ charge: order.paymentId! }))
  }

  // And now what if one of these throws? Retry? Queue it?
  // Congratulations, you're building a compensation-compensation.
  for (const op of ops) {
    try { await op() } catch (err) { await deadLetter.enqueue({ orderId, err }) }
  }

  await db.orders.update({
    where: { id: orderId },
    data: { status: "rolled_back", rollbackReason: reason },
  })
}`,
};

const FILE_ADMIN_CANCEL_BRIDGE: NaiveFile = {
  name: "admin-cancel-bridge.ts",
  lines: 48,
  addedOnSlide: "failure-admin-cancel",
  code: `// Admin dashboard needs to reach inside the sleep-scheduler's
// table, delete the row, and then manually kick the compensation
// coordinator. Two systems. Not in a transaction. Good luck.
export async function adminCancelOrder(orderId: string, actor: string) {
  const sleeping = await db.sleepQueue.findFirst({ where: { orderId } })
  if (sleeping) {
    await db.sleepQueue.delete({ where: { id: sleeping.id } })
  }
  const waitingHook = await db.hookWaits.findFirst({ where: { orderId } })
  if (waitingHook) {
    await db.hookWaits.delete({ where: { id: waitingHook.id } })
  }
  // If the compensator fails after we've already deleted the sleep row,
  // we've orphaned the compensation and nothing will re-drive it.
  await compensate(orderId, \`admin:\${actor}\`)
  await auditLog.create({ data: { orderId, actor, action: "admin_cancel" } })
}`,
};

const FILE_PUBSUB: NaiveFile = {
  name: "pubsub.ts",
  lines: 59,
  addedOnSlide: "failure-live-updates",
  code: `// A realtime layer the app didn't have yesterday. Every step
// publishes a status event. Clients subscribe by order ID. Handle
// reconnects. Handle backpressure. Handle out-of-order delivery.
const pub = new Redis(env.REDIS_URL)
const subs = new Map<string, Set<WritableStreamDefaultWriter>>()

export function publishStatus(orderId: string, status: OrderStatus) {
  return pub.publish(\`orders:\${orderId}\`, JSON.stringify({ status, at: Date.now() }))
}

export function subscribe(orderId: string, writer: WritableStreamDefaultWriter) {
  let set = subs.get(orderId)
  if (!set) { set = new Set(); subs.set(orderId, set) }
  set.add(writer)
  return () => set!.delete(writer)
}

// And another Redis client for the subscribe side, because the
// pub client can't be both. And a WebSocket server. And a gateway.
const sub = new Redis(env.REDIS_URL)
sub.psubscribe("orders:*")
sub.on("pmessage", (_pattern, channel, payload) => {
  const orderId = channel.split(":")[1]
  const set = subs.get(orderId)
  if (!set) return
  for (const w of set) void w.write(new TextEncoder().encode(payload + "\\n"))
})`,
};

const FILE_NOTIFICATION_COORDINATOR: NaiveFile = {
  name: "notification-coordinator.ts",
  lines: 64,
  addedOnSlide: "failure-fan-out",
  code: `// Per-channel state. Per-channel retries. Per-channel
// idempotency. Partial-success tracking. This file is bigger
// than the entire place-order flow it's supporting.
type ChannelStatus = "pending" | "sent" | "failed"

export async function sendAllNotifications(order: Order) {
  const row = await db.notificationState.upsert({
    where: { orderId: order.id },
    create: {
      orderId: order.id,
      email: "pending",
      push: "pending",
      loyalty: "pending",
    },
    update: {},
  })

  await Promise.all([
    trySend("email", row, () => email.send(order)),
    trySend("push", row, () => push.send(order)),
    trySend("loyalty", row, () => loyalty.award(order)),
  ])
}

async function trySend(
  channel: "email" | "push" | "loyalty",
  row: NotificationStateRow,
  op: () => Promise<void>,
) {
  const key = \`notify:\${row.orderId}:\${channel}\`
  const existing = await db.idempotencyKeys.findUnique({ where: { key } })
  if (existing) return
  try {
    await op()
    await db.notificationState.update({
      where: { orderId: row.orderId },
      data: { [channel]: "sent" satisfies ChannelStatus },
    })
    await db.idempotencyKeys.create({ data: { key, result: {} } })
  } catch (err) {
    await db.notificationState.update({
      where: { orderId: row.orderId },
      data: { [channel]: "failed" satisfies ChannelStatus },
    })
    await retryQueue.enqueue({ channel, orderId: row.orderId })
  }
}`,
};

function buildAccumulation(): Record<string, NaiveAccumulationEntry> {
  const accumulation: Record<string, NaiveAccumulationEntry> = {};

  const addSlide = (slide: string, focusFile: string, filesForSlide: NaiveFile[]) => {
    accumulation[slide] = {
      slide,
      focusFile,
      allFiles: filesForSlide,
    };
  };

  const afterCrash = [FILE_ORDERS_TABLE, FILE_RECOVERY_WORKER];
  addSlide("failure-crash", FILE_RECOVERY_WORKER.name, afterCrash);

  const afterRetry = [...afterCrash, FILE_IDEMPOTENCY_KEYS];
  addSlide("failure-retry", FILE_IDEMPOTENCY_KEYS.name, afterRetry);

  const afterSlowRestaurant = [
    ...afterRetry,
    FILE_RESTAURANT_WEBHOOK,
    FILE_PIPELINE_RESUME_WORKER,
  ];
  addSlide(
    "failure-slow-restaurant",
    FILE_RESTAURANT_WEBHOOK.name,
    afterSlowRestaurant,
  );

  const afterGhost = [...afterSlowRestaurant, FILE_TIMEOUT_SCANNER];
  addSlide("failure-ghost-restaurant", FILE_TIMEOUT_SCANNER.name, afterGhost);

  const afterPrepWindow = [...afterGhost, FILE_SLEEP_SCHEDULER];
  addSlide("failure-prep-window", FILE_SLEEP_SCHEDULER.name, afterPrepWindow);

  const afterDriver = [...afterPrepWindow, FILE_COMPENSATION_COORDINATOR];
  addSlide(
    "failure-driver-refuses",
    FILE_COMPENSATION_COORDINATOR.name,
    afterDriver,
  );

  const afterAdminCancel = [...afterDriver, FILE_ADMIN_CANCEL_BRIDGE];
  addSlide(
    "failure-admin-cancel",
    FILE_ADMIN_CANCEL_BRIDGE.name,
    afterAdminCancel,
  );

  const afterLive = [...afterAdminCancel, FILE_PUBSUB];
  addSlide("failure-live-updates", FILE_PUBSUB.name, afterLive);

  const afterFanOut = [...afterLive, FILE_NOTIFICATION_COORDINATOR];
  addSlide(
    "failure-fan-out",
    FILE_NOTIFICATION_COORDINATOR.name,
    afterFanOut,
  );

  return accumulation;
}

export const NAIVE_ACCUMULATION = buildAccumulation();

export function getNaiveAccumulation(slide: string): NaiveAccumulationEntry | null {
  return NAIVE_ACCUMULATION[slide] ?? null;
}

export function getFullNaiveCatalog(): NaiveFile[] {
  return NAIVE_ACCUMULATION["failure-fan-out"]?.allFiles ?? [];
}

export function getFocusCode(slide: string): string {
  const entry = NAIVE_ACCUMULATION[slide];
  if (!entry) return "";
  const file = entry.allFiles.find((f) => f.name === entry.focusFile);
  return file?.code ?? "";
}
