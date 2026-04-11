import {
  FatalError,
  RetryableError,
  createHook,
  getStepMetadata,
  getWritable,
  sleep,
} from "workflow";
import {
  type CompensationAction,
  type DemoMode,
  type FailStep,
  hookTokens,
} from "@/lib/order-contract";

export type { CompensationAction, DemoMode, FailStep } from "@/lib/order-contract";
export { hookTokens } from "@/lib/order-contract";

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
  demoMode?: DemoMode;
  driverTimeout?: string; // e.g. "1s", "2m" — defaults to "2m"
  /**
   * Optional race: wrap the restaurant-accept hook in a Promise.race
   * against a sleep of this duration. If the sleep wins, a FatalError
   * fires and compensation unwinds. Drives the `ghostRestaurant` scenario.
   */
  restaurantTimeout?: string;
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

// ---------- Hook tokens (re-exported from @/lib/order-contract) ----------

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

    // 2b. Prep-window sleep (demo mode only — visible pause between
    //     chargePayment and notifyRestaurant for the failure-prep-window
    //     slide. Real 20 minutes compressed to a few seconds for stage.)
    if (input.demoMode === "prepWindowSleep") {
      await emit({
        type: "log",
        message: "Waiting for bakery prep window (20m compressed to ~3s)",
      });
      await sleep("3s");
      await emit({ type: "log", message: "Prep window open" });
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

    // Optional race: if `restaurantTimeout` is set, wrap the hook in a
    // Promise.race against a sleep. Drives the `ghostRestaurant` scenario
    // where the restaurant never answers and the order routes elsewhere.
    let restaurantResult: { accepted: boolean; reason?: string };
    if (input.restaurantTimeout) {
      const raced = await Promise.race([
        restaurantHook.then((r) => ({ kind: "resolved" as const, r })),
        sleep(input.restaurantTimeout as "2m").then(() => ({
          kind: "timeout" as const,
        })),
      ]);
      if (raced.kind === "timeout") {
        const timeoutLabel = input.restaurantTimeout;
        await emit({ type: "log", message: "Restaurant did not accept in time" });
        await emit({
          type: "step_failed",
          step: "notifyRestaurant",
          label: "Notify restaurant",
          error: `Restaurant never answered (timed out after ${timeoutLabel})`,
        });
        console.info("[workflow] restaurant_timeout", {
          orderId,
          restaurantTimeout: timeoutLabel,
        });
        throw new FatalError(
          `Restaurant acceptance timed out for order ${orderId}`,
        );
      }
      restaurantResult = raced.r;
    } else {
      restaurantResult = await restaurantHook;
    }

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

    // 3c. Admin-cancel window (demo mode only — the failure-admin-cancel
    //     slide demonstrates Run.wakeUp() by opening a short sleep that
    //     support can interrupt from the admin dashboard. External code
    //     resumes the admin-cancel hook AND calls run.wakeUp() so the
    //     sleep returns immediately and the workflow reads the cancel
    //     signal via Promise.race.)
    if (input.demoMode === "adminSleepBeforeDriver") {
      const adminCancelHook = createHook<{
        cancelled: boolean;
        reason?: string;
      }>({
        token: hookTokens.adminCancel(orderId),
      });
      // Emit a log rather than waiting_for_hook so the client doesn't
      // try to auto-resume this via the standard restaurant/driver
      // path — the admin-cancel hook is resumed out-of-band by the
      // /api/orders/[orderId]/admin-cancel route.
      await emit({
        type: "log",
        message: "Admin cancel window open — sleeping 6s before dispatch",
      });
      const adminResult = await Promise.race([
        adminCancelHook.then((r) => ({
          kind: "cancelled" as const,
          reason: r.reason,
        })),
        sleep("6s").then(() => ({ kind: "slept" as const })),
      ]);
      if (adminResult.kind === "cancelled") {
        await emit({
          type: "log",
          message: `Admin cancel signal received: ${adminResult.reason ?? "support"}`,
        });
        throw new FatalError(
          `Admin cancel: ${adminResult.reason ?? "support intervened"}`,
        );
      }
      await emit({
        type: "log",
        message: "Support cancel window closed, continuing to dispatch",
      });
    }

    // 3b. Replay probe (demo mode only — injects a retry before assignDriver)
    await replayProbe(input);

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
      sleep((input.driverTimeout ?? "2m") as "2m").then(() => ({
        kind: "timeout" as const,
      })),
    ]);
    if (driverResult.kind === "timeout") {
      const timeoutLabel = input.driverTimeout ?? "2m";
      await emit({ type: "log", message: "Driver did not accept in time" });
      await emit({
        type: "step_failed",
        step: "assignDriver",
        label: "Assign driver",
        error: `Timed out after ${timeoutLabel}`,
      });
      console.info("[workflow] driver_timeout", {
        orderId,
        driverTimeout: timeoutLabel,
      });
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

async function replayProbe(input: OrderInput): Promise<void> {
  "use step";
  if (input.demoMode !== "replayProbeBeforeAssignDriver") return;
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    const { stepId, attempt } = getStepMetadata();
    await writer.write({
      type: "log",
      message: `replayProbe stepId=${stepId} attempt=${attempt}`,
    });
    if (attempt === 1) {
      throw new Error("Injected replay probe before assignDriver");
    }
  } finally {
    writer.releaseLock();
  }
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
    const { stepId, attempt } = getStepMetadata();
    await writer.write({
      type: "step_running",
      step: "chargePayment",
      label: "Charge payment",
    });
    await writer.write({
      type: "log",
      message: `chargePayment stepId=${stepId} attempt=${attempt}`,
    });
    console.info("[workflow] chargePayment", {
      orderId: input.orderId,
      stepId,
      attempt,
      failAt: input.failAt ?? null,
      demoMode: input.demoMode ?? "standard",
    });
    if (input.demoMode === "chargePaymentUnhandledOnce" && attempt === 1) {
      await writer.write({
        type: "log",
        message:
          "chargePayment throwing uncaught Error to demonstrate default retry",
      });
      throw new Error("Transient payment gateway outage");
    }
    await delay(600);
    if (input.failAt === "chargePaymentRetryable" && attempt === 1) {
      await writer.write({
        type: "log",
        message: `Payment API rate limited. Retrying with same stepId ${stepId}`,
      });
      throw new RetryableError("Payment API rate limited", {
        retryAfter: "2s",
      });
    }
    if (shouldFail) {
      await writer.write({
        type: "step_failed",
        step: "chargePayment",
        label: "Charge payment",
        error: "Card declined",
      });
      throw new FatalError(`chargePayment failed for ${input.orderId}`);
    }
    const paymentId = `pay_${stepId}`;
    const total = input.items.reduce((s, i) => s + i.price * i.qty, 0);
    await writer.write({
      type: "step_succeeded",
      step: "chargePayment",
      label: "Charge payment",
      detail: `Charged $${total.toFixed(2)} (${paymentId}) key=${stepId}`,
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
      type: "log",
      message: "Restaurant ticket sent to kitchen; awaiting acceptance",
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
      type: "log",
      message: `Dispatched ${driverId}; awaiting acceptance`,
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
    // Fan-out demo mode: emit per-channel log events that visualize a
    // Promise.allSettled of three notification channels, with one
    // channel failing and retrying under durability guarantees.
    if (input.demoMode === "fanOutSendReceipt") {
      await writer.write({
        type: "log",
        message: "fan-out → email dispatched (channel 1 of 3)",
      });
      await delay(180);
      await writer.write({
        type: "log",
        message: "fan-out → push dispatched (channel 2 of 3)",
      });
      await delay(180);
      await writer.write({
        type: "log",
        message: "fan-out → loyalty dispatched (channel 3 of 3)",
      });
      await delay(220);
      await writer.write({
        type: "log",
        message: "fan-out → email 5xx, queued for retry; push + loyalty ok",
      });
      await delay(220);
      await writer.write({
        type: "log",
        message: "fan-out → 3 of 3 eventually delivered",
      });
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
