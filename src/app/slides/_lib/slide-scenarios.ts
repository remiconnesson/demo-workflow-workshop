import type { OrderRunScenario } from "@/lib/order-run-client";

const BASE_ITEMS = [
  { id: "deployer", name: "The Deployer", price: 4, qty: 1 },
];

const BASE_INPUT = {
  customerName: "Ada Lovelace",
  address: "440 N Wolfe Rd, Sunnyvale",
  items: BASE_ITEMS,
};

const AUTO_FINISH_AFTER_RESTAURANT = [
  {
    step: "assignDriver" as const,
    delayMs: 400,
    body: { kind: "driver-accept" as const, accepted: true },
  },
  {
    step: "trackDelivery" as const,
    delayMs: 400,
    body: { kind: "delivered" as const },
  },
];

export const slideScenarios = {
  demo: {
    scenarioId: "demo-happy-path",
    title: "Triangle Donuts \u00b7 happy path",
    subtitle: "All six steps complete on a real run.",
    autoStart: false,
    input: { ...BASE_INPUT, failAt: null, autoAck: true },
  },
  workflowCode: {
    scenarioId: "workflow-code-hook",
    title: "Compensation + hook",
    subtitle: "Run the real workflow and stop at the restaurant hook.",
    input: { ...BASE_INPUT, failAt: null, autoAck: false },
    scriptedResumes: AUTO_FINISH_AFTER_RESTAURANT,
  },
  idempotency: {
    scenarioId: "idempotency",
    title: "Same stepId on retry",
    subtitle: "Real RetryableError path using the production workflow.",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: "chargePaymentRetryable" as const,
      autoAck: true,
    },
  },
  hooks: {
    scenarioId: "hooks-manual",
    title: "Pause. Wait. Resume.",
    subtitle: "Manual hook resumption from the slide.",
    input: { ...BASE_INPUT, failAt: null, autoAck: false },
    scriptedResumes: AUTO_FINISH_AFTER_RESTAURANT,
  },
  tokens: {
    scenarioId: "tokens-manual",
    title: "Deterministic hook token",
    subtitle: "Same manual wait state, but the slide copy explains the token.",
    input: { ...BASE_INPUT, failAt: null, autoAck: false },
    scriptedResumes: AUTO_FINISH_AFTER_RESTAURANT,
  },
  approvalGate: {
    scenarioId: "approval-gate",
    title: "Human in the loop",
    subtitle: "Restaurant approval is a real hook pause.",
    input: { ...BASE_INPUT, failAt: null, autoAck: false },
    scriptedResumes: AUTO_FINISH_AFTER_RESTAURANT,
  },
  saga: {
    scenarioId: "dispute-window-rollback",
    title: "saga",
    subtitle:
      "Stack an undo on every step so a missed delivery unwinds the whole run",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "disputeWindow" as const,
    },
  },
  compensationTimeline: {
    scenarioId: "compensation-timeline-rollback",
    title: "Real compensation order",
    subtitle: "The same rollback run as the saga slide.",
    autoStart: false,
    input: { ...BASE_INPUT, failAt: null, autoAck: false },
    scriptedResumes: [
      {
        step: "notifyRestaurant" as const,
        delayMs: 500,
        body: { kind: "restaurant-accept" as const, accepted: true },
      },
      {
        step: "assignDriver" as const,
        delayMs: 500,
        body: { kind: "driver-accept" as const, accepted: false },
      },
    ],
  },
  streaming: {
    scenarioId: "streaming-happy-path",
    title: "Event stream",
    subtitle: "Step-level order updates streamed to the demo over HTTP.",
    autoStart: false,
    input: { ...BASE_INPUT, failAt: null, autoAck: true },
  },
  // --- New demo modes (Task 4) ---
  replay: {
    scenarioId: "replay-probe",
    title: "Earlier work is not repeated",
    subtitle:
      "A real retry is injected immediately before assignDriver.",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "replayProbeBeforeAssignDriver" as const,
    },
  },
  naive: {
    scenarioId: "naive-avoided-failure",
    title: "What the durable version avoids",
    subtitle:
      "Run the real replay probe while the slide copy explains the naive failure mode.",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "replayProbeBeforeAssignDriver" as const,
    },
  },
  directives: {
    scenarioId: "durable-checkpoints",
    title: "Checkpoints survive retries",
    subtitle: "Same live replay probe, different explanatory copy.",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "replayProbeBeforeAssignDriver" as const,
    },
  },
  errorsFatal: {
    scenarioId: "errors-fatal",
    title: "FatalError stops immediately",
    subtitle: "Permanent failure, no retries, rollback begins at once.",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: "notifyRestaurant" as const,
      autoAck: true,
    },
  },
  errorsUnhandled: {
    scenarioId: "errors-uncaught",
    title: "Uncaught Error retries by default",
    subtitle: "Real automatic retry branch.",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "chargePaymentUnhandledOnce" as const,
    },
  },
  failureCrash: {
    scenarioId: "failure-crash",
    title: "failure-crash",
    subtitle: "Automatically retry when errors pop up",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "crashInjectable" as const,
    },
  },
  ghostRestaurant: {
    scenarioId: "ghost-restaurant",
    title: "ghost-restaurant",
    subtitle:
      "Give the restaurant a deadline so your customer isn't left hanging",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: false,
      restaurantTimeout: "2s",
    },
    // No scripted restaurant resume — the hook never resolves, the sleep
    // wins the race, the workflow routes to a fatal + compensations.
    silentWaitingSteps: ["notifyRestaurant"],
  },
  failurePrepWindow: {
    scenarioId: "failure-prep-window",
    title: "failure-prep-window",
    subtitle: "Sleep the workflow so your customer can pre-order",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "prepWindowSleep" as const,
    },
  },
  failureFanOut: {
    scenarioId: "failure-fan-out",
    title: "failure-fan-out",
    subtitle:
      "Parallelize notifications so each channel retries on its own",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "fanOutSendReceipt" as const,
    },
  },
  failureAdminCancel: {
    scenarioId: "failure-admin-cancel",
    title: "failure-admin-cancel",
    subtitle: "Expose a hook so your customer can change their mind",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "adminSleepBeforeDriver" as const,
    },
    silentWaitingSteps: ["notifyRestaurant"],
  },
  naiveDoubleCharge: {
    scenarioId: "naive-double-charge",
    title: "naive-double-charge",
    subtitle:
      "Guard payments with an idempotency key to save your customer's credit card",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "naiveDoubleCharge" as const,
    },
  },
  naiveCrash: {
    scenarioId: "naive-crash-no-recover",
    title: "Money moved, order didn't",
    subtitle:
      "FatalError between charge and notify → refund compensation unwinds, restaurant never hears.",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "naiveCrashNoRecover" as const,
    },
  },
  naivePoll: {
    scenarioId: "naive-poll",
    title: "naive-poll",
    subtitle:
      "Avoid polling with a hook to avoid racking up the server costs",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "naivePoll" as const,
    },
  },
  naiveNoStream: {
    scenarioId: "naive-no-stream",
    title: "naive-no-stream",
    subtitle: "Send events so your customer sees real-time progress",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "naiveNoStream" as const,
    },
  },
  naiveAllOrNothing: {
    scenarioId: "naive-all-or-nothing",
    title: "naive-all-or-nothing",
    subtitle:
      "Keep each channel independent so a single failure can't cancel the rest",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "naiveAllOrNothing" as const,
    },
  },
  timeoutRace: {
    scenarioId: "timeout-race",
    title: "Driver timeout wins the race",
    subtitle:
      "Restaurant accepts, driver never responds, timeout fires on-stage.",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: false,
      driverTimeout: "1s",
    },
    scriptedResumes: [
      {
        step: "notifyRestaurant" as const,
        delayMs: 300,
        body: { kind: "restaurant-accept" as const, accepted: true },
      },
    ],
    silentWaitingSteps: ["assignDriver"],
  },
} satisfies Record<string, OrderRunScenario>;
