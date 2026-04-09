import type { ScenarioFrame } from "../_components/scenario-player";
import type { OrderLabFrame } from "../_components/order-concept-lab";

const stableStepId = "chargePayment_demo_step";
const paymentId = `pay_${stableStepId}`;

export const foundations = {
  naive: [
    {
      id: "validate",
      atMs: 0,
      data: {
        title: "Naive request in flight",
        subtitle: "Six awaits. Nothing persisted yet.",
        stepState: { validateOrder: "running" },
        logs: [{ kind: "RUN", msg: "validateOrder \u00B7 Validate order" }],
      },
    },
    {
      id: "charged",
      atMs: 700,
      data: {
        title: "Payment already happened",
        subtitle: "Memory still has progress, but the server does not.",
        stepState: {
          validateOrder: "success",
          chargePayment: "success",
        },
        logs: [
          { kind: "OK ", msg: "validateOrder \u00B7 1 item, total $4.00" },
          {
            kind: "OK ",
            msg: `chargePayment \u00B7 Charged $4.00 (${paymentId})`,
          },
        ],
      },
    },
    {
      id: "crash",
      atMs: 1300,
      data: {
        title: "Crash between step 2 and 3",
        subtitle: "Restaurant never got the order.",
        stepState: {
          validateOrder: "success",
          chargePayment: "success",
          notifyRestaurant: "failed",
        },
        logs: [
          { kind: "OK ", msg: "validateOrder \u00B7 1 item, total $4.00" },
          {
            kind: "OK ",
            msg: `chargePayment \u00B7 Charged $4.00 (${paymentId})`,
          },
          {
            kind: "LOG",
            msg: "CRASH \u00B7 process restarted before notifyRestaurant",
          },
        ],
        callout: {
          tone: "red",
          title: "This is the pain",
          body: "The customer can be charged even though the order never reaches the bakery.",
        },
      },
    },
  ] satisfies ScenarioFrame<OrderLabFrame>[],

  directives: [
    {
      id: "plain-awaits",
      atMs: 0,
      data: {
        title: "Without directives",
        subtitle: "Crash loses in-memory progress.",
        stepState: {
          validateOrder: "success",
          chargePayment: "success",
          notifyRestaurant: "failed",
        },
        logs: [{ kind: "LOG", msg: "No durable checkpoints exist" }],
        callout: {
          tone: "red",
          title: "Fragile",
          body: "Every await depends on the same process staying alive.",
        },
      },
    },
    {
      id: "checkpoints",
      atMs: 900,
      data: {
        title: '"use workflow" + "use step"',
        subtitle: "Each await becomes a resumable checkpoint.",
        stepState: {
          validateOrder: "success",
          chargePayment: "success",
          notifyRestaurant: "running",
        },
        logs: [
          { kind: "SKP", msg: "validateOrder \u00B7 cached checkpoint" },
          { kind: "SKP", msg: "chargePayment \u00B7 cached checkpoint" },
          {
            kind: "RUN",
            msg: "notifyRestaurant \u00B7 resumed from durable state",
          },
        ],
        callout: {
          tone: "emerald",
          title: "Durable",
          body: "The runtime replays finished work and resumes at the next unfinished step.",
        },
      },
    },
  ] satisfies ScenarioFrame<OrderLabFrame>[],

  workflowCode: [
    {
      id: "payment-and-refund",
      atMs: 0,
      data: {
        title: "Forward step + registered compensation",
        subtitle: "Charge succeeds, then refund is pushed onto the stack.",
        stepState: {
          validateOrder: "success",
          chargePayment: "success",
        },
        logs: [
          {
            kind: "OK ",
            msg: `chargePayment \u00B7 Charged $4.00 (${paymentId}) key=${stableStepId}`,
          },
          { kind: "CMP", msg: "pushed refundPayment (for chargePayment)" },
        ],
        compensationOrder: ["refundPayment"],
      },
    },
    {
      id: "restaurant-hook",
      atMs: 900,
      data: {
        title: "Hook pauses the workflow",
        subtitle:
          "The code maps directly to the wait state the audience sees.",
        stepState: {
          validateOrder: "success",
          chargePayment: "success",
          notifyRestaurant: "waiting",
        },
        logs: [
          {
            kind: "WAI",
            msg: "notifyRestaurant \u00B7 awaiting order:ord_demo:restaurant-accept",
          },
        ],
        callout: {
          tone: "amber",
          title: "Pause on-slide",
          body: "Show the pause here before handing off to the full demo later.",
        },
      },
    },
  ] satisfies ScenarioFrame<OrderLabFrame>[],

  replay: [
    {
      id: "first-run",
      atMs: 0,
      data: {
        title: "First run",
        subtitle: "Steps 1\u20133 finished before the crash.",
        stepState: {
          validateOrder: "success",
          chargePayment: "success",
          notifyRestaurant: "success",
          assignDriver: "failed",
        },
        logs: [
          { kind: "OK ", msg: "validateOrder \u00B7 cached result exists" },
          {
            kind: "OK ",
            msg: `chargePayment \u00B7 Charged $4.00 (${paymentId}) key=${stableStepId}`,
          },
          {
            kind: "OK ",
            msg: "notifyRestaurant \u00B7 Restaurant accepted",
          },
          {
            kind: "LOG",
            msg: "CRASH \u00B7 restart before assignDriver",
          },
        ],
      },
    },
    {
      id: "restart",
      atMs: 900,
      data: {
        title: "Restart + replay",
        subtitle:
          "The runtime skips finished steps and resumes at step 4.",
        stepState: {
          validateOrder: "skipped",
          chargePayment: "skipped",
          notifyRestaurant: "skipped",
          assignDriver: "running",
        },
        logs: [
          { kind: "SKP", msg: "validateOrder" },
          { kind: "SKP", msg: "chargePayment" },
          { kind: "SKP", msg: "notifyRestaurant" },
          { kind: "RUN", msg: "assignDriver \u00B7 Assign driver" },
        ],
        callout: {
          tone: "emerald",
          title: "No double charge",
          body: "Replay reads prior results instead of calling the payment step again.",
        },
      },
    },
  ] satisfies ScenarioFrame<OrderLabFrame>[],

  idempotency: [
    {
      id: "attempt-1",
      atMs: 0,
      data: {
        title: "Attempt 1",
        subtitle: "The payment API returns a rate limit.",
        stepState: { chargePayment: "running" },
        logs: [
          { kind: "RUN", msg: "chargePayment \u00B7 Charge payment" },
          {
            kind: "LOG",
            msg: `chargePayment stepId=${stableStepId} attempt=1`,
          },
          {
            kind: "ERR",
            msg: `chargePayment \u00B7 Payment API rate limited. Retrying with same stepId ${stableStepId}`,
          },
        ],
      },
    },
    {
      id: "retry-scheduled",
      atMs: 900,
      data: {
        title: "Retry scheduled",
        subtitle: 'The backoff is explicit: retryAfter = "2s".',
        stepState: { chargePayment: "waiting" },
        logs: [
          {
            kind: "LOG",
            msg: 'RetryableError("Payment API rate limited", { retryAfter: "2s" })',
          },
        ],
        callout: {
          tone: "amber",
          title: "Same stepId, new attempt",
          body: "The retry should never mint a new payment key.",
        },
      },
    },
    {
      id: "attempt-2",
      atMs: 1800,
      data: {
        title: "Attempt 2",
        subtitle: "Same stepId. Success on retry.",
        stepState: { chargePayment: "success" },
        logs: [
          {
            kind: "LOG",
            msg: `chargePayment stepId=${stableStepId} attempt=2`,
          },
          {
            kind: "OK ",
            msg: `chargePayment \u00B7 Charged $4.00 (${paymentId}) key=${stableStepId}`,
          },
        ],
        callout: {
          tone: "emerald",
          title: "Idempotent external call",
          body: "The external API sees the same key and deduplicates correctly.",
        },
      },
    },
  ] satisfies ScenarioFrame<OrderLabFrame>[],

  errorsDefault: [
    {
      id: "uncaught-error",
      atMs: 0,
      data: {
        title: "Uncaught Error",
        subtitle: "Default behavior is retry.",
        stepState: { chargePayment: "failed" },
        logs: [
          { kind: "ERR", msg: 'chargePayment \u00B7 Error("Network timeout")' },
          {
            kind: "LOG",
            msg: "Runtime queues another attempt automatically",
          },
        ],
        callout: {
          tone: "sky",
          title: "Default retry path",
          body: "Use this branch to teach automatic retries on ordinary errors.",
        },
      },
    },
    {
      id: "uncaught-retry",
      atMs: 900,
      data: {
        title: "Automatic retry",
        subtitle: "The step is run again without custom timing.",
        stepState: { chargePayment: "running" },
        logs: [
          { kind: "RUN", msg: "chargePayment \u00B7 retry attempt started" },
        ],
      },
    },
  ] satisfies ScenarioFrame<OrderLabFrame>[],

  errorsFatal: [
    {
      id: "fatal",
      atMs: 0,
      data: {
        title: "FatalError",
        subtitle: "Stop retrying and start compensating.",
        stepState: {
          chargePayment: "success",
          notifyRestaurant: "success",
          assignDriver: "failed",
        },
        logs: [
          {
            kind: "ERR",
            msg: 'assignDriver \u00B7 FatalError("Driver declined order")',
          },
          { kind: "CMP", msg: "running cancelRestaurantOrder" },
          { kind: "CMP", msg: "running refundPayment" },
        ],
        compensationOrder: ["cancelRestaurantOrder", "refundPayment"],
        callout: {
          tone: "red",
          title: "Permanent failure",
          body: "No retry loop. Move straight into rollback.",
        },
      },
    },
  ] satisfies ScenarioFrame<OrderLabFrame>[],

  errorsRetryable: [
    {
      id: "retryable-1",
      atMs: 0,
      data: {
        title: "RetryableError attempt 1",
        subtitle: "Explicit backoff and same step identity.",
        stepState: { chargePayment: "running" },
        logs: [
          {
            kind: "LOG",
            msg: `chargePayment stepId=${stableStepId} attempt=1`,
          },
          {
            kind: "ERR",
            msg: 'chargePayment \u00B7 RetryableError("Payment API rate limited")',
          },
        ],
      },
    },
    {
      id: "retryable-wait",
      atMs: 700,
      data: {
        title: "Custom backoff",
        subtitle: 'retryAfter = "2s"',
        stepState: { chargePayment: "waiting" },
        logs: [{ kind: "LOG", msg: 'retryAfter: "2s"' }],
      },
    },
    {
      id: "retryable-2",
      atMs: 1400,
      data: {
        title: "RetryableError attempt 2",
        subtitle: "Same stepId, successful retry.",
        stepState: { chargePayment: "success" },
        logs: [
          {
            kind: "LOG",
            msg: `chargePayment stepId=${stableStepId} attempt=2`,
          },
          {
            kind: "OK ",
            msg: `chargePayment \u00B7 Charged $4.00 (${paymentId}) key=${stableStepId}`,
          },
        ],
      },
    },
  ] satisfies ScenarioFrame<OrderLabFrame>[],
};
