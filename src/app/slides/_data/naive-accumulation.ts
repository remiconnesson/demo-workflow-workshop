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

const FILE_IDEMPOTENCY_KEYS: NaiveFile = {
  name: "idempotency-keys.ts",
  lines: 31,
  addedOnSlide: "retry",
  code: `export async function idempotentCharge(orderId: string, amount: number) {
  // need a stable key per retry — so track which attempt we're on
  const attempt = await db.orders
    .findUniqueOrThrow({ where: { id: orderId } })
    .then((o) => o.chargeAttempt + 1)
  const key = \`charge:\${orderId}:\${attempt}\`
  // second database for your first database
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
  addedOnSlide: "suspend",
  code: `// place-order returned 202 — the restaurant answers back here
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
  // hand off to the resume-worker — the pipeline is now in two pieces
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
  addedOnSlide: "suspend",
  code: `// a second copy of the pipeline, keyed off which step to resume at
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
    // every downstream step needs its own resume case
    case "trackDelivery": { /* ... */ return }
    case "sendReceipt":   { /* ... */ return }
  }
})`,
};

const FILE_COMPENSATION_COORDINATOR: NaiveFile = {
  name: "dispute-coordinator.ts",
  lines: 88,
  addedOnSlide: "rollback",
  code: `// Customer disputes AFTER the happy path finished.
// Every step already succeeded — status is "completed".
// Now unwind all six of them, in reverse, by hand.
export async function handleDispute(orderId: string, reason: string) {
  const order = await db.orders.findUniqueOrThrow({ where: { id: orderId } })
  if (order.status !== "completed") throw new Error("not completed")

  // Walk the completed-step list backwards. Order matters:
  // void receipts before refund or your books are wrong;
  // refund before cancel and you owe the restaurant for food;
  // release the driver or you keep paying them.
  const ops: (() => Promise<void>)[] = []

  if (order.receiptId) {
    ops.push(() => receipts.void(order.receiptId!))
  }
  if (order.driverId) {
    ops.push(() => dispatcher.releaseDriver(order.driverId!))
  }
  if (order.restaurantAcceptedAt) {
    ops.push(() => kitchen.cancel(order.id))
  }
  if (order.paymentId) {
    ops.push(() => stripe.refunds.create({ charge: order.paymentId! }))
  }

  for (const op of ops) {
    // what if a compensation throws? retry? queue it?
    // congratulations, you're building a compensation-compensation
    try { await op() } catch (err) { await deadLetter.enqueue({ orderId, err }) }
  }

  await db.orders.update({
    where: { id: orderId },
    data: { status: "disputed", disputeReason: reason },
  })
  // And hope nobody marked anything complete in a cache somewhere.
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

  const afterRetry = [FILE_IDEMPOTENCY_KEYS];
  addSlide("retry", FILE_IDEMPOTENCY_KEYS.name, afterRetry);

  const afterSlowRestaurant = [
    ...afterRetry,
    FILE_RESTAURANT_WEBHOOK,
    FILE_PIPELINE_RESUME_WORKER,
  ];
  addSlide(
    "suspend",
    FILE_RESTAURANT_WEBHOOK.name,
    afterSlowRestaurant,
  );

  const afterDispute = [...afterSlowRestaurant, FILE_COMPENSATION_COORDINATOR];
  addSlide(
    "rollback",
    FILE_COMPENSATION_COORDINATOR.name,
    afterDispute,
  );

  return accumulation;
}

export const NAIVE_ACCUMULATION = buildAccumulation();

export function getNaiveAccumulation(slide: string): NaiveAccumulationEntry | null {
  return NAIVE_ACCUMULATION[slide] ?? null;
}

export function getFullNaiveCatalog(): NaiveFile[] {
  return NAIVE_ACCUMULATION["rollback"]?.allFiles ?? [];
}

export function getFocusCode(slide: string): string {
  const entry = NAIVE_ACCUMULATION[slide];
  if (!entry) return "";
  const file = entry.allFiles.find((f) => f.name === entry.focusFile);
  return file?.code ?? "";
}
