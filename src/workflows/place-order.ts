import {
  FatalError,
  createHook,
  getWritable,
  sleep,
} from "workflow";

// ---------- Types ----------

export type FailStep =
  | "validateOrder"
  | "chargePayment"
  | "notifyRestaurant"
  | "assignDriver"
  | "trackDelivery"
  | "sendReceipt"
  | null;

export type CompensationAction =
  | "refundPayment"
  | "cancelRestaurantOrder"
  | "releaseDriver";

export type OrderItem = {
  id: string;
  name: string;
  price: number;
  qty: number;
};

export type OrderInput = {
  orderId: string;
  customerName: string;
  address: string;
  items: OrderItem[];
  // Demo controls
  failAt?: FailStep;
  autoAck?: boolean; // automatically resume hooks after a short delay
};

export type OrderEvent =
  | { type: "step_running"; step: string; label: string }
  | { type: "step_succeeded"; step: string; label: string; detail?: string }
  | { type: "step_failed"; step: string; label: string; error: string }
  | { type: "step_skipped"; step: string; label: string }
  | { type: "waiting_for_hook"; step: string; token: string; label: string }
  | { type: "hook_resolved"; step: string; token: string; detail?: string }
  | { type: "compensation_pushed"; action: CompensationAction; forStep: string }
  | { type: "compensating"; action: CompensationAction }
  | { type: "compensated"; action: CompensationAction }
  | { type: "log"; message: string }
  | {
      type: "done";
      status: "completed" | "rolled_back";
      orderId: string;
      compensationOrder: CompensationAction[];
    };

export type OrderResult = {
  orderId: string;
  status: "completed" | "rolled_back";
  failedStep: FailStep;
  compensationOrder: CompensationAction[];
};

// ---------- Hook tokens ----------

export const hookTokens = {
  restaurantAccept: (orderId: string) => `order:${orderId}:restaurant-accept`,
  driverAccept: (orderId: string) => `order:${orderId}:driver-accept`,
  delivered: (orderId: string) => `order:${orderId}:delivered`,
};

// ---------- Workflow ----------

type Compensation = {
  action: CompensationAction;
  undo: () => Promise<void>;
};

export async function placeOrderWorkflow(
  input: OrderInput,
): Promise<OrderResult> {
  "use workflow";

  const compensations: Compensation[] = [];
  const { orderId, failAt = null, autoAck = true } = input;

  try {
    // 1. Validate order
    await validateOrder(input, failAt === "validateOrder");

    // 2. Charge payment
    const paymentId = await chargePayment(
      input,
      failAt === "chargePayment",
    );
    {
      const paymentToRefund = paymentId;
      compensations.push({
        action: "refundPayment",
        undo: () => refundPayment(orderId, paymentToRefund),
      });
      await emit({
        type: "compensation_pushed",
        action: "refundPayment",
        forStep: "chargePayment",
      });
    }

    // 3. Notify restaurant + wait for acceptance hook
    await notifyRestaurant(input, failAt === "notifyRestaurant");
    compensations.push({
      action: "cancelRestaurantOrder",
      undo: () => cancelRestaurantOrder(orderId),
    });
    await emit({
      type: "compensation_pushed",
      action: "cancelRestaurantOrder",
      forStep: "notifyRestaurant",
    });

    const restaurantHook = createHook<{ accepted: boolean; reason?: string }>({
      token: hookTokens.restaurantAccept(orderId),
    });
    await emit({
      type: "waiting_for_hook",
      step: "notifyRestaurant",
      token: hookTokens.restaurantAccept(orderId),
      label: "Waiting for restaurant to accept",
    });
    const restaurantResult = await restaurantHook;
    await emit({
      type: "hook_resolved",
      step: "notifyRestaurant",
      token: hookTokens.restaurantAccept(orderId),
      detail: restaurantResult.accepted ? "Restaurant accepted" : "Restaurant rejected",
    });
    if (!restaurantResult.accepted) {
      throw new FatalError(
        `Restaurant rejected order ${orderId}${restaurantResult.reason ? `: ${restaurantResult.reason}` : ""}`,
      );
    }

    // 4. Assign driver + wait for acceptance (with timeout)
    const driverId = await assignDriver(input, failAt === "assignDriver");
    {
      const driverToRelease = driverId;
      compensations.push({
        action: "releaseDriver",
        undo: () => releaseDriver(orderId, driverToRelease),
      });
      await emit({
        type: "compensation_pushed",
        action: "releaseDriver",
        forStep: "assignDriver",
      });
    }

    const driverHook = createHook<{ accepted: boolean }>({
      token: hookTokens.driverAccept(orderId),
    });
    await emit({
      type: "waiting_for_hook",
      step: "assignDriver",
      token: hookTokens.driverAccept(orderId),
      label: "Waiting for driver to accept",
    });
    const driverResult = await Promise.race([
      driverHook.then((r) => ({ kind: "resolved" as const, r })),
      sleep("2m").then(() => ({ kind: "timeout" as const })),
    ]);
    if (driverResult.kind === "timeout") {
      await emit({ type: "log", message: "Driver did not accept in time" });
      throw new FatalError(`Driver assignment timed out for order ${orderId}`);
    }
    await emit({
      type: "hook_resolved",
      step: "assignDriver",
      token: hookTokens.driverAccept(orderId),
      detail: driverResult.r.accepted ? "Driver accepted" : "Driver declined",
    });
    if (!driverResult.r.accepted) {
      throw new FatalError(`Driver declined order ${orderId}`);
    }

    // 5. Track delivery (wait for delivered hook)
    await emit({
      type: "step_running",
      step: "trackDelivery",
      label: "Driver en route",
    });
    const deliveredHook = createHook<{ photo?: string }>({
      token: hookTokens.delivered(orderId),
    });
    await emit({
      type: "waiting_for_hook",
      step: "trackDelivery",
      token: hookTokens.delivered(orderId),
      label: "Waiting for delivery confirmation",
    });
    const delivered = await deliveredHook;
    if (failAt === "trackDelivery") {
      await emit({
        type: "step_failed",
        step: "trackDelivery",
        label: "Track delivery",
        error: "Delivery reported missing by customer",
      });
      throw new FatalError("Delivery failed verification");
    }
    await emit({
      type: "step_succeeded",
      step: "trackDelivery",
      label: "Track delivery",
      detail: delivered.photo ? "Photo received" : "Delivered",
    });

    // 6. Send receipt
    await sendReceipt(input, paymentId, failAt === "sendReceipt");

    await emit({
      type: "done",
      status: "completed",
      orderId,
      compensationOrder: compensations.map((c) => c.action),
    });

    return {
      orderId,
      status: "completed",
      failedStep: null,
      compensationOrder: compensations.map((c) => c.action),
    };
  } catch (error) {
    if (!(error instanceof FatalError)) throw error;

    await emit({
      type: "log",
      message: `Saga failed: ${error.message}. Rolling back…`,
    });

    const executed: CompensationAction[] = [];
    while (compensations.length > 0) {
      const c = compensations.pop()!;
      await emit({ type: "compensating", action: c.action });
      await c.undo();
      await emit({ type: "compensated", action: c.action });
      executed.push(c.action);
    }

    await emit({
      type: "done",
      status: "rolled_back",
      orderId,
      compensationOrder: executed,
    });

    return {
      orderId,
      status: "rolled_back",
      failedStep: failAt,
      compensationOrder: executed,
    };
  }
}

// ---------- Steps ----------

async function emit(event: OrderEvent): Promise<void> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writer.write(event);
  } finally {
    writer.releaseLock();
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function validateOrder(
  input: OrderInput,
  shouldFail: boolean,
): Promise<void> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writer.write({
      type: "step_running",
      step: "validateOrder",
      label: "Validate order",
    });
    await delay(400);
    if (shouldFail || input.items.length === 0) {
      await writer.write({
        type: "step_failed",
        step: "validateOrder",
        label: "Validate order",
        error: "Invalid order — empty cart",
      });
      throw new FatalError(`validateOrder failed for ${input.orderId}`);
    }
    const total = input.items.reduce((s, i) => s + i.price * i.qty, 0);
    await writer.write({
      type: "step_succeeded",
      step: "validateOrder",
      label: "Validate order",
      detail: `${input.items.length} items, total $${total.toFixed(2)}`,
    });
  } finally {
    writer.releaseLock();
  }
}

async function chargePayment(
  input: OrderInput,
  shouldFail: boolean,
): Promise<string> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writer.write({
      type: "step_running",
      step: "chargePayment",
      label: "Charge payment",
    });
    await delay(600);
    if (shouldFail) {
      await writer.write({
        type: "step_failed",
        step: "chargePayment",
        label: "Charge payment",
        error: "Card declined",
      });
      throw new FatalError(`chargePayment failed for ${input.orderId}`);
    }
    const paymentId = `pay_${input.orderId}_${Date.now().toString(36)}`;
    const total = input.items.reduce((s, i) => s + i.price * i.qty, 0);
    await writer.write({
      type: "step_succeeded",
      step: "chargePayment",
      label: "Charge payment",
      detail: `Charged $${total.toFixed(2)} (${paymentId})`,
    });
    return paymentId;
  } finally {
    writer.releaseLock();
  }
}

async function notifyRestaurant(
  input: OrderInput,
  shouldFail: boolean,
): Promise<void> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writer.write({
      type: "step_running",
      step: "notifyRestaurant",
      label: "Notify restaurant",
    });
    await delay(500);
    if (shouldFail) {
      await writer.write({
        type: "step_failed",
        step: "notifyRestaurant",
        label: "Notify restaurant",
        error: "Restaurant system unreachable",
      });
      throw new FatalError(`notifyRestaurant failed for ${input.orderId}`);
    }
    await writer.write({
      type: "step_succeeded",
      step: "notifyRestaurant",
      label: "Notify restaurant",
      detail: "Ticket sent to kitchen",
    });
  } finally {
    writer.releaseLock();
  }
}

async function assignDriver(
  input: OrderInput,
  shouldFail: boolean,
): Promise<string> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writer.write({
      type: "step_running",
      step: "assignDriver",
      label: "Assign driver",
    });
    await delay(500);
    if (shouldFail) {
      await writer.write({
        type: "step_failed",
        step: "assignDriver",
        label: "Assign driver",
        error: "No drivers available",
      });
      throw new FatalError(`assignDriver failed for ${input.orderId}`);
    }
    const driverId = `drv_${Math.floor(Math.random() * 9000 + 1000)}`;
    await writer.write({
      type: "step_succeeded",
      step: "assignDriver",
      label: "Assign driver",
      detail: `Dispatched ${driverId}`,
    });
    return driverId;
  } finally {
    writer.releaseLock();
  }
}

async function sendReceipt(
  input: OrderInput,
  paymentId: string,
  shouldFail: boolean,
): Promise<void> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writer.write({
      type: "step_running",
      step: "sendReceipt",
      label: "Send receipt",
    });
    await delay(300);
    if (shouldFail) {
      await writer.write({
        type: "step_failed",
        step: "sendReceipt",
        label: "Send receipt",
        error: "Email provider error",
      });
      throw new FatalError(`sendReceipt failed for ${input.orderId}`);
    }
    await writer.write({
      type: "step_succeeded",
      step: "sendReceipt",
      label: "Send receipt",
      detail: `Receipt for ${paymentId} emailed to ${input.customerName}`,
    });
  } finally {
    writer.releaseLock();
  }
}

// ---------- Compensations ----------

async function refundPayment(orderId: string, paymentId: string): Promise<void> {
  "use step";
  await delay(400);
  console.info("[saga] refunded", { orderId, paymentId });
}

async function cancelRestaurantOrder(orderId: string): Promise<void> {
  "use step";
  await delay(400);
  console.info("[saga] cancelled restaurant order", { orderId });
}

async function releaseDriver(orderId: string, driverId: string): Promise<void> {
  "use step";
  await delay(300);
  console.info("[saga] released driver", { orderId, driverId });
}

// Auto-ack is handled client-side: when the UI sees a `waiting_for_hook`
// event and autoAck is enabled, it POSTs to /api/orders/[orderId]/resume.
