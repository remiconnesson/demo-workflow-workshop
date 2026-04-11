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
    scenarioId: "driver-decline-rollback",
    title: "Driver decline triggers rollback",
    subtitle: "Restaurant accepts, driver declines, compensations unwind.",
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
    subtitle: "Raw workflow events over NDJSON.",
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
    title: "Server dies mid-order",
    subtitle: "Press 💥 during the run — the runtime replays from the event log.",
    autoStart: false,
    input: { ...BASE_INPUT, failAt: null, autoAck: true },
  },
  ghostRestaurant: {
    scenarioId: "ghost-restaurant",
    title: "Restaurant never answers",
    subtitle:
      "Real Promise.race: the restaurant hook races against a sleep and the sleep wins.",
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
    title: "Waiting for the bakery prep window",
    subtitle:
      "await sleep(20m) compressed to ~3s. Visible pause between charge and notify.",
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
    title: "Three notifications, one fails",
    subtitle:
      "Promise.allSettled over email/push/loyalty. Email flakes, the other two finish.",
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
    title: "Support cancels a sleeping order",
    subtitle:
      "Run.wakeUp() interrupts the sleep, the admin-cancel hook fires, compensation unwinds.",
    autoStart: false,
    input: {
      ...BASE_INPUT,
      failAt: null,
      autoAck: true,
      demoMode: "adminSleepBeforeDriver" as const,
    },
    silentWaitingSteps: ["notifyRestaurant"],
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
