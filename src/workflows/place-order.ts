import {
  FatalError,
  RetryableError,
  createHook,
  getStepMetadata,
  getWorkflowMetadata,
  getWritable,
  sleep,
} from "workflow";

// Duration string accepted by workflow's `sleep()` — mirrors `ms`'s
// StringValue (e.g. "500ms", "2s", "1m", "1h"). We declare locally
// rather than importing from `ms` because `ms` is a transitive (not
// direct) dep of this project; pnpm's strict hoisting would reject
// the import. `sleep()` takes the full union, but we only use string
// durations from user input, so narrowing to this shape is accurate.
type DurationString =
  | `${number}ms`
  | `${number}s`
  | `${number}m`
  | `${number}h`
  | `${number}d`;
import {
  type CompensationAction,
  type DemoMode,
  type FailStep,
  hookTokens,
} from "@/lib/order-contract";
import { consumeCrashFlag } from "@/lib/crash-flags";

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
  driverTimeout?: DurationString; // e.g. "1s", "2m" — defaults to "2m"
  /**
   * Optional race: wrap the restaurant-accept hook in a Promise.race
   * against a sleep of this duration. If the sleep wins, an Error is
   * thrown and compensation unwinds. Drives the `ghostRestaurant` scenario.
   */
  restaurantTimeout?: DurationString;
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
  const demoMode = input.demoMode;
  const e = (event: OrderEvent) => emit(event, demoMode);

  // Crash-inject: the /api/orders/[orderId]/crash route sets a flag in
  // the shared crash-flags map. Each step reads + clears the flag at
  // the start of attempt 1. Whichever step runs next after the user
  // clicks crashes its own stepId with RetryableError → step_retrying
  // shows up in `npx workflow inspect` on that exact step.

  try {
    await validateOrder(input, failAt === "validateOrder");

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
      await e({
        type: "compensation_pushed",
        action: "refundPayment",
        forStep: "chargePayment",
      });
    }

    if (input.demoMode === "naiveCrashNoRecover") {
      await naiveCrash();
    }


    // 2b. Prep-window sleep (demo mode only — visible pause between
    //     chargePayment and notifyRestaurant for the failure-prep-window
    //     slide). In production this is `await sleep(PREP_WINDOW)` with
    //     PREP_WINDOW = "20m". For stage we compress to 3s so the demo
    //     fits in the 60-second slot. The sleep is recorded by the
    //     workflow runtime either way — visible via:
    //         npx workflow inspect sleeps -r <runId>
    if (input.demoMode === "prepWindowSleep") {
      const PREP_WINDOW = "3s"; // production: "20m"
      await e({
        type: "log",
        message: `Bakery prep window — sleeping ${PREP_WINDOW} (production: 20m)`,
      });
      await sleep(PREP_WINDOW);
      await e({ type: "log", message: "Prep window elapsed, notifying bakery" });
    }

    if (input.demoMode === "naivePoll") {
      for (let i = 1; i <= 10; i += 1) {
        await naivePollTick(orderId, i);
      }
      await e({
        type: "log",
        message:
          "naive poll exhausted — restaurant never answered, server held compute entire time",
      });
      await e({
        type: "step_failed",
        step: "notifyRestaurant",
        label: "Notify restaurant",
        error: "Naive poll gave up after 10 attempts",
      });
      throw new Error("Naive poll gave up after 10 attempts");
    }

    // 3. Notify restaurant + wait for acceptance hook
    await notifyRestaurant(input, failAt === "notifyRestaurant");
    compensations.push({
      action: "cancelRestaurantOrder",
      undo: () => cancelRestaurantOrder(orderId),
    });
    await e({
      type: "compensation_pushed",
      action: "cancelRestaurantOrder",
      forStep: "notifyRestaurant",
    });

    const restaurantHook = createHook<{ accepted: boolean; reason?: string }>({
      token: hookTokens.restaurantAccept(orderId),
    });
    await e({
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
        sleep(input.restaurantTimeout).then(() => ({
          kind: "timeout" as const,
        })),
      ]);
      if (raced.kind === "timeout") {
        const timeoutLabel = input.restaurantTimeout;
        await e({ type: "log", message: "Restaurant did not accept in time" });
        await e({
          type: "step_failed",
          step: "notifyRestaurant",
          label: "Notify restaurant",
          error: `Restaurant never answered (timed out after ${timeoutLabel})`,
        });
        console.info("[workflow] restaurant_timeout", {
          orderId,
          restaurantTimeout: timeoutLabel,
        });
        throw new Error(
          `Restaurant acceptance timed out for order ${orderId}`,
        );
      }
      restaurantResult = raced.r;
    } else {
      restaurantResult = await restaurantHook;
    }

    await e({
      type: "hook_resolved",
      step: "notifyRestaurant",
      token: hookTokens.restaurantAccept(orderId),
      detail: restaurantResult.accepted ? "Restaurant accepted" : "Restaurant rejected",
    });
    if (!restaurantResult.accepted) {
      throw new Error(
        `Restaurant rejected order ${orderId}${restaurantResult.reason ? `: ${restaurantResult.reason}` : ""}`,
      );
    }

    // 3c. Admin-cancel window (demo mode only — the failure-admin-cancel
    //     slide demonstrates graceful cancellation by racing a cancel
    //     hook against a short decision sleep. resumeHook() from the
    //     /api/orders/[orderId]/admin-cancel route wins the race and
    //     wakes the suspended workflow on its own; no wakeUp needed.)
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
      await e({
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
        await e({
          type: "log",
          message: `Admin cancel signal received: ${adminResult.reason ?? "support"}`,
        });
        throw new Error(
          `Admin cancel: ${adminResult.reason ?? "support intervened"}`,
        );
      }
      await e({
        type: "log",
        message: "Support cancel window closed, continuing to dispatch",
      });
    }

    // 3b. Replay probe (demo mode only — injects a retry before assignDriver)
    await replayProbe(input);

    const driverId = await assignDriver(input, failAt === "assignDriver");
    {
      const driverToRelease = driverId;
      compensations.push({
        action: "releaseDriver",
        undo: () => releaseDriver(orderId, driverToRelease),
      });
      await e({
        type: "compensation_pushed",
        action: "releaseDriver",
        forStep: "assignDriver",
      });
    }

    const driverHook = createHook<{ accepted: boolean }>({
      token: hookTokens.driverAccept(orderId),
    });
    await e({
      type: "waiting_for_hook",
      step: "assignDriver",
      token: hookTokens.driverAccept(orderId),
      label: "Waiting for driver to accept",
    });
    const driverResult = await Promise.race([
      driverHook.then((r) => ({ kind: "resolved" as const, r })),
      sleep(input.driverTimeout ?? "2m").then(() => ({
        kind: "timeout" as const,
      })),
    ]);
    if (driverResult.kind === "timeout") {
      const timeoutLabel = input.driverTimeout ?? "2m";
      await e({ type: "log", message: "Driver did not accept in time" });
      await e({
        type: "step_failed",
        step: "assignDriver",
        label: "Assign driver",
        error: `Timed out after ${timeoutLabel}`,
      });
      console.info("[workflow] driver_timeout", {
        orderId,
        driverTimeout: timeoutLabel,
      });
      throw new Error(`Driver assignment timed out for order ${orderId}`);
    }
    await e({
      type: "hook_resolved",
      step: "assignDriver",
      token: hookTokens.driverAccept(orderId),
      detail: driverResult.r.accepted ? "Driver accepted" : "Driver declined",
    });
    if (!driverResult.r.accepted) {
      throw new Error(`Driver declined order ${orderId}`);
    }

    // 5. Track delivery (wait for delivered hook) — not crash-armable
    //    because trackDelivery is inline orchestration, not a step.
    await e({
      type: "step_running",
      step: "trackDelivery",
      label: "Driver en route",
    });
    const deliveredHook = createHook<{ photo?: string }>({
      token: hookTokens.delivered(orderId),
    });
    await e({
      type: "waiting_for_hook",
      step: "trackDelivery",
      token: hookTokens.delivered(orderId),
      label: "Waiting for delivery confirmation",
    });
    const delivered = await deliveredHook;
    if (failAt === "trackDelivery") {
      await e({
        type: "step_failed",
        step: "trackDelivery",
        label: "Track delivery",
        error: "Delivery reported missing by customer",
      });
      throw new Error("Delivery failed verification");
    }
    await e({
      type: "step_succeeded",
      step: "trackDelivery",
      label: "Track delivery",
      detail: delivered.photo ? "Photo received" : "Delivered",
    });

    await sendReceipt(input, paymentId, failAt === "sendReceipt");

    if (input.demoMode === "fanOutSendReceipt") {
      await Promise.allSettled([
        sendEmail(input),
        sendPush(input),
        sendLoyalty(input),
      ]);
    } else if (input.demoMode === "naiveAllOrNothing") {
      try {
        await Promise.all([
          sendEmail(input),
          sendPush(input),
          sendLoyalty(input),
        ]);
      } catch {
        throw new Error(
          "naive all-or-nothing: one channel failed the batch",
        );
      }
    }

    // 7. Post-delivery dispute window (demo mode only — the
    //    dispute / "Dispute the Order" slide demonstrates
    //    compensation unwinding a fully-completed happy path. All six
    //    steps are green; we open a short race between a durable
    //    disputeHook (resumed by the /api/orders/[orderId]/dispute
    //    route) and a short sleep (5s compressed from 24h). If the
    //    hook fires, the thrown Error cascades every compensation in reverse.
    if (input.demoMode === "disputeWindow") {
      const disputeHook = createHook<{ reason: string }>({
        token: hookTokens.deliveryDispute(orderId),
      });
      await e({
        type: "log",
        message: "Dispute window open (5s compressed from 24h)",
      });
      const verdict = await Promise.race([
        disputeHook.then((r) => ({
          kind: "disputed" as const,
          reason: r.reason,
        })),
        sleep("5s").then(() => ({ kind: "confirmed" as const })),
      ]);
      if (verdict.kind === "disputed") {
        await e({
          type: "log",
          message: `Dispute: ${verdict.reason}`,
        });
        throw new Error(`Delivery disputed: ${verdict.reason}`);
      }
      await e({
        type: "log",
        message: "Dispute window closed, order confirmed",
      });
    }

    await e({
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
    const message = error instanceof Error ? error.message : String(error);
    await e({
      type: "log",
      message: `Saga failed: ${message}. Rolling back…`,
    });

    const executed: CompensationAction[] = [];
    while (compensations.length > 0) {
      const c = compensations.pop()!;
      await e({ type: "compensating", action: c.action });
      await c.undo();
      await e({ type: "compensated", action: c.action });
      executed.push(c.action);
    }

    await e({
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

// Cross-attempt stash for naiveDoubleCharge: attempt 1's non-idempotent
// paymentId is recorded here so attempt 2 can surface both IDs together
// in the step's final output (visible via `npx workflow inspect steps -d`).
const naiveAttempt1Ids = new Map<string, string>();

// ---------- Steps ----------

function streamAllowed(_mode: DemoMode | undefined, _eventType: OrderEvent["type"]): boolean {
  return true;
}

async function emit(event: OrderEvent, mode?: DemoMode): Promise<void> {
  "use step";
  if (!streamAllowed(mode, event.type)) return;
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

async function writeEvent(
  writer: WritableStreamDefaultWriter<OrderEvent>,
  event: OrderEvent,
  mode?: DemoMode,
): Promise<void> {
  if (!streamAllowed(mode, event.type)) return;
  await writer.write(event);
}

// Simulates a process crash as a step-level retry. On attempt 1 we throw
// RetryableError — the Workflow runtime records step_retrying and schedules
// a retry. On attempt 2 we return cleanly. This is what makes the crash
// visible in `npx workflow inspect` as a failed-then-recovered step, which
// is the closest analog to a real process crash + event-log replay.
async function simulateCrash(label: string): Promise<void> {
  "use step";
  const { attempt, stepId } = getStepMetadata();
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    if (attempt === 1) {
      await writer.write({
        type: "log",
        message: `💥 CRASH :: simulateCrash step throwing RetryableError (checkpoint=${label}, stepId=${stepId}, attempt=1)`,
      });
      console.info("[workflow] crash_injected", { label, stepId, attempt });
      throw new RetryableError(`Simulated process crash before ${label}`, {
        retryAfter: "500ms",
      });
    }
    await writer.write({
      type: "log",
      message: `💥 CRASH :: recovered — runtime replayed from event log (checkpoint=${label}, attempt=${attempt})`,
    });
    console.info("[workflow] crash_recovered", { label, stepId, attempt });
  } finally {
    writer.releaseLock();
  }
}

async function naivePollTick(orderId: string, iteration: number): Promise<void> {
  "use step";
  await delay(300);
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writer.write({
      type: "log",
      message: `naive poll ${iteration}/10 — still holding compute`,
    });
    console.info("[workflow] naive_poll_tick", { orderId, iteration });
  } finally {
    writer.releaseLock();
  }
}

async function naiveCrash(): Promise<void> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writer.write({
      type: "log",
      message:
        "naive: process crashed between charge and notify — no durable checkpoint",
    });
    console.info("[workflow] naive_crash_no_recover");
  } finally {
    writer.releaseLock();
  }
  throw new FatalError("Process crashed before restaurant was notified");
}

async function replayProbe(input: OrderInput): Promise<void> {
  "use step";
  if (input.demoMode !== "replayProbeBeforeAssignDriver") return;
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    const { stepId, attempt } = getStepMetadata();
    await writeEvent(writer, {
      type: "log",
      message: `replayProbe stepId=${stepId} attempt=${attempt}`,
    }, input.demoMode);
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
  const { attempt, stepId } = getStepMetadata();
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writeEvent(writer, {
      type: "step_running",
      step: "validateOrder",
      label: "Validate order",
    }, input.demoMode);
    // Note: getWorkflowMetadata() is explicitly callable inside a step —
    // the SDK exports it from @workflow/core/step with the JSDoc "Returns
    // metadata available in the current workflow run inside a step function."
    // Steps get workflowRunId/workflowName; only getStepMetadata() fields
    // (stepId, attempt, stepStartedAt) are step-scoped.
    if (
      attempt === 1 &&
      consumeCrashFlag(input.orderId, {
        runId: getWorkflowMetadata().workflowRunId,
        step: "validateOrder",
      })
    ) {
      await writer.write({
        type: "step_failed",
        step: "validateOrder",
        label: "Validate order",
        error: "💥 CRASH — process died, runtime will retry",
      });
      await writer.write({
        type: "log",
        message: `💥 CRASH :: validateOrder attempt 1 throwing RetryableError (stepId=${stepId})`,
      });
      throw new RetryableError(
        "💥 CRASH :: simulated process crash mid-validateOrder",
        { retryAfter: "500ms" },
      );
    }
    await delay(400);
    if (shouldFail || input.items.length === 0) {
      await writeEvent(writer, {
        type: "step_failed",
        step: "validateOrder",
        label: "Validate order",
        error: "Invalid order — empty cart",
      }, input.demoMode);
      throw new FatalError(`validateOrder failed for ${input.orderId}`);
    }
    const total = input.items.reduce((s, i) => s + i.price * i.qty, 0);
    await writeEvent(writer, {
      type: "step_succeeded",
      step: "validateOrder",
      label: "Validate order",
      detail: `${input.items.length} items, total $${total.toFixed(2)}`,
    }, input.demoMode);
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
    await writeEvent(writer, {
      type: "step_running",
      step: "chargePayment",
      label: "Charge payment",
    }, input.demoMode);
    if (
      attempt === 1 &&
      consumeCrashFlag(input.orderId, {
        runId: getWorkflowMetadata().workflowRunId,
        step: "chargePayment",
      })
    ) {
      await writer.write({
        type: "step_failed",
        step: "chargePayment",
        label: "Charge payment",
        error: "💥 CRASH — process died, runtime will retry",
      });
      await writer.write({
        type: "log",
        message: `💥 CRASH :: chargePayment attempt 1 throwing RetryableError (stepId=${stepId})`,
      });
      throw new RetryableError(
        "💥 CRASH :: simulated process crash mid-chargePayment",
        { retryAfter: "500ms" },
      );
    }
    await writeEvent(writer, {
      type: "log",
      message: `chargePayment stepId=${stepId} attempt=${attempt}`,
    }, input.demoMode);
    console.info("[workflow] chargePayment", {
      orderId: input.orderId,
      stepId,
      attempt,
      failAt: input.failAt ?? null,
      demoMode: input.demoMode ?? "standard",
    });
    if (input.demoMode === "chargePaymentUnhandledOnce" && attempt === 1) {
      await writeEvent(writer, {
        type: "log",
        message:
          "chargePayment throwing uncaught Error to demonstrate default retry",
      }, input.demoMode);
      throw new Error("Transient payment gateway outage");
    }
    if (input.demoMode === "naiveDoubleCharge") {
      const total = input.items.reduce((s, i) => s + i.price * i.qty, 0);
      const paymentId = `pay_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
      await writeEvent(writer, {
        type: "log",
        message: `naive_pay_attempt_${attempt}=${paymentId} (no idempotency key)`,
      }, input.demoMode);
      console.info("[workflow] naive_double_charge", {
        orderId: input.orderId,
        attempt,
        paymentId,
      });
      if (attempt === 1) {
        naiveAttempt1Ids.set(input.orderId, paymentId);
        await writeEvent(writer, {
          type: "step_succeeded",
          step: "chargePayment",
          label: "Charge payment",
          detail: `naive charge #1 ${paymentId} (about to crash)`,
        }, input.demoMode);
        // Embed attempt 1's paymentId in the error so it survives in
        // step_failed / inspect steps `error.message`, making the double
        // charge provable without relying on log chunks alone.
        throw new Error(
          `Payment API 5xx after charging naive_pay_attempt_1=${paymentId}`,
        );
      }
      const attempt1Id = naiveAttempt1Ids.get(input.orderId) ?? "pay_unknown";
      naiveAttempt1Ids.delete(input.orderId);
      await writeEvent(writer, {
        type: "log",
        message: `naive_double_charge_summary attempt1=${attempt1Id} attempt2=${paymentId}`,
      }, input.demoMode);
      await writeEvent(writer, {
        type: "step_succeeded",
        step: "chargePayment",
        label: "Charge payment",
        detail: `Charged twice: naive_pay_attempt_1=${attempt1Id} naive_pay_attempt_2=${paymentId} total=$${total.toFixed(2)}`,
      }, input.demoMode);
      // Return both IDs encoded in the string so `inspect steps -d` surfaces
      // them as the step's output. Downstream consumers (refund, receipt)
      // treat this opaquely as a paymentId string.
      return `${paymentId} | naive_pay_attempt_1=${attempt1Id} naive_pay_attempt_2=${paymentId}`;
    }
    await delay(600);
    if (input.failAt === "chargePaymentRetryable" && attempt === 1) {
      await writeEvent(writer, {
        type: "log",
        message: `Payment API rate limited. Retrying with same stepId ${stepId}`,
      }, input.demoMode);
      throw new RetryableError("Payment API rate limited", {
        retryAfter: "2s",
      });
    }
    if (shouldFail) {
      await writeEvent(writer, {
        type: "step_failed",
        step: "chargePayment",
        label: "Charge payment",
        error: "Card declined",
      }, input.demoMode);
      throw new FatalError(`chargePayment failed for ${input.orderId}`);
    }
    const paymentId = `pay_${stepId}`;
    const total = input.items.reduce((s, i) => s + i.price * i.qty, 0);
    await writeEvent(writer, {
      type: "step_succeeded",
      step: "chargePayment",
      label: "Charge payment",
      detail: `Charged $${total.toFixed(2)} (${paymentId}) key=${stepId}`,
    }, input.demoMode);
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
  const { attempt, stepId } = getStepMetadata();
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writeEvent(writer, {
      type: "step_running",
      step: "notifyRestaurant",
      label: "Notify restaurant",
    }, input.demoMode);
    if (
      attempt === 1 &&
      consumeCrashFlag(input.orderId, {
        runId: getWorkflowMetadata().workflowRunId,
        step: "notifyRestaurant",
      })
    ) {
      await writer.write({
        type: "step_failed",
        step: "notifyRestaurant",
        label: "Notify restaurant",
        error: "💥 CRASH — process died, runtime will retry",
      });
      await writer.write({
        type: "log",
        message: `💥 CRASH :: notifyRestaurant attempt 1 throwing RetryableError (stepId=${stepId})`,
      });
      console.info("[workflow] crash_injected_notify", { stepId, attempt });
      throw new RetryableError(
        "💥 CRASH :: simulated process crash mid-notifyRestaurant",
        { retryAfter: "500ms" },
      );
    }
    await delay(500);
    if (shouldFail) {
      await writeEvent(writer, {
        type: "step_failed",
        step: "notifyRestaurant",
        label: "Notify restaurant",
        error: "Restaurant system unreachable",
      }, input.demoMode);
      throw new FatalError(`notifyRestaurant failed for ${input.orderId}`);
    }
    await writeEvent(writer, {
      type: "log",
      message: "Restaurant ticket sent to kitchen; awaiting acceptance",
    }, input.demoMode);
  } finally {
    writer.releaseLock();
  }
}

async function assignDriver(
  input: OrderInput,
  shouldFail: boolean,
): Promise<string> {
  "use step";
  const { attempt, stepId } = getStepMetadata();
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writeEvent(writer, {
      type: "step_running",
      step: "assignDriver",
      label: "Assign driver",
    }, input.demoMode);
    if (
      attempt === 1 &&
      consumeCrashFlag(input.orderId, {
        runId: getWorkflowMetadata().workflowRunId,
        step: "assignDriver",
      })
    ) {
      await writer.write({
        type: "step_failed",
        step: "assignDriver",
        label: "Assign driver",
        error: "💥 CRASH — process died, runtime will retry",
      });
      await writer.write({
        type: "log",
        message: `💥 CRASH :: assignDriver attempt 1 throwing RetryableError (stepId=${stepId})`,
      });
      throw new RetryableError(
        "💥 CRASH :: simulated process crash mid-assignDriver",
        { retryAfter: "500ms" },
      );
    }
    await delay(500);
    if (shouldFail) {
      await writeEvent(writer, {
        type: "step_failed",
        step: "assignDriver",
        label: "Assign driver",
        error: "No drivers available",
      }, input.demoMode);
      throw new FatalError(`assignDriver failed for ${input.orderId}`);
    }
    // Derive from stepId so retries of this step produce the same
    // driverId — teaches idempotency rather than regenerating a random
    // value on replay.
    const driverId = `drv_${stepId.slice(-4)}`;
    await writeEvent(writer, {
      type: "log",
      message: `Dispatched ${driverId}; awaiting acceptance`,
    }, input.demoMode);
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
  const { attempt, stepId } = getStepMetadata();
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await writeEvent(writer, {
      type: "step_running",
      step: "sendReceipt",
      label: "Send receipt",
    }, input.demoMode);
    if (
      attempt === 1 &&
      consumeCrashFlag(input.orderId, {
        runId: getWorkflowMetadata().workflowRunId,
        step: "sendReceipt",
      })
    ) {
      await writer.write({
        type: "step_failed",
        step: "sendReceipt",
        label: "Send receipt",
        error: "💥 CRASH — process died, runtime will retry",
      });
      await writer.write({
        type: "log",
        message: `💥 CRASH :: sendReceipt attempt 1 throwing RetryableError (stepId=${stepId})`,
      });
      throw new RetryableError(
        "💥 CRASH :: simulated process crash mid-sendReceipt",
        { retryAfter: "500ms" },
      );
    }
    await delay(300);
    if (shouldFail) {
      await writeEvent(writer, {
        type: "step_failed",
        step: "sendReceipt",
        label: "Send receipt",
        error: "Email provider error",
      }, input.demoMode);
      throw new FatalError(`sendReceipt failed for ${input.orderId}`);
    }
    await writeEvent(writer, {
      type: "step_succeeded",
      step: "sendReceipt",
      label: "Send receipt",
      detail: `Receipt for ${paymentId} emailed to ${input.customerName}`,
    }, input.demoMode);
  } finally {
    writer.releaseLock();
  }
}

async function sendEmail(input: OrderInput): Promise<void> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    const { attempt } = getStepMetadata();
    if (input.demoMode === "naiveAllOrNothing") {
      await writer.write({
        type: "log",
        message: `naive fan-out → email attempt ${attempt} threw plain Error`,
      });
      console.info("[workflow] naive_email_fail", {
        orderId: input.orderId,
        attempt,
      });
      throw new Error("Email provider 5xx (naive: no RetryableError, no allSettled)");
    }
    if (attempt === 1) {
      await writeEvent(writer, {
        type: "log",
        message: "fan-out → email 5xx queued for retry",
      }, input.demoMode);
      throw new RetryableError("Email provider 5xx", {
        retryAfter: "300ms",
      });
    }
    await delay(180);
    await writeEvent(writer, {
      type: "log",
      message: `fan-out → email dispatched to ${input.customerName}`,
    }, input.demoMode);
  } finally {
    writer.releaseLock();
  }
}

async function sendPush(input: OrderInput): Promise<void> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await delay(180);
    await writeEvent(writer, {
      type: "log",
      message: `fan-out → push dispatched for ${input.orderId}`,
    }, input.demoMode);
    console.info("[workflow] push_sent", {
      orderId: input.orderId,
      demoMode: input.demoMode ?? "standard",
    });
  } finally {
    writer.releaseLock();
  }
}

async function sendLoyalty(input: OrderInput): Promise<void> {
  "use step";
  const writer = getWritable<OrderEvent>().getWriter();
  try {
    await delay(220);
    await writeEvent(writer, {
      type: "log",
      message: `fan-out → loyalty dispatched for ${input.orderId}`,
    }, input.demoMode);
    console.info("[workflow] loyalty_sent", {
      orderId: input.orderId,
      demoMode: input.demoMode ?? "standard",
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
