import { DurableAgent } from "@workflow/ai/agent";
import { RetryableError, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Dispatch theme domain vocabulary
//
// The Dispatch DurableAgent picks the closest available driver for an
// inbound order, rebalances loads, and handles driver-side flakes. The
// retry story here is a GPS-ping tool: the driver's phone momentarily
// drops off the network, the first ping fails with RetryableError, the
// runtime schedules a retry (same stepId), and the second ping succeeds.
// The agent never knows — from its perspective it's a single successful
// tool call.
//
// This file defines the driver / zone / ping vocabulary that the
// dispatch-suspend and dispatch-rollback demos will inherit.
// ---------------------------------------------------------------------------

export type Driver = {
  id: string;
  name: string;
  vehicle: "bike" | "scooter" | "car";
  zone: string;
  distanceMi: number;
  // Marking a driver `flakeFirstPing` lets the demo reliably reproduce a
  // GPS drop on attempt 1 for the selected driver.
  flakeFirstPing: boolean;
};

export const FLEET: Driver[] = [
  {
    id: "drv-mika",
    name: "Mika Tanaka",
    vehicle: "scooter",
    zone: "SOMA",
    distanceMi: 0.4,
    flakeFirstPing: true,
  },
  {
    id: "drv-rafa",
    name: "Rafa Ortiz",
    vehicle: "bike",
    zone: "Mission",
    distanceMi: 1.1,
    flakeFirstPing: false,
  },
  {
    id: "drv-priya",
    name: "Priya Shah",
    vehicle: "car",
    zone: "SOMA",
    distanceMi: 0.9,
    flakeFirstPing: false,
  },
];

export const PICKUP = {
  restaurantId: "r-tartine",
  name: "Tartine Manufactory",
  address: "595 Alabama St",
};

export const DROPOFF = {
  address: "201 Spear St, 14th Floor",
};

// ---------------------------------------------------------------------------
// Retry bookkeeping: stepId → attempt-count. The Workflow runtime assigns
// the same stepId to every retry of a step, so a module-level Map is the
// canonical way to make a tool "fail once, succeed on retry" without
// requiring the runtime to expose attempt numbers through the agent API.
// ---------------------------------------------------------------------------

const pingAttempts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function listAvailableDrivers({ zone }: { zone: string }) {
  "use step";
  return FLEET.filter((d) => d.zone === zone).map((d) => ({
    id: d.id,
    name: d.name,
    vehicle: d.vehicle,
    distanceMi: d.distanceMi,
  }));
}

async function pingDriverGps({ driverId }: { driverId: string }) {
  "use step";

  const { stepId, attempt } = getStepMetadata();
  const driver = FLEET.find((d) => d.id === driverId);
  if (!driver) {
    throw new Error(`Unknown driver ${driverId}`);
  }

  // Count module-level attempts keyed by stepId. Fall back to the
  // runtime's attempt number so the tool behaves correctly even if the
  // module is cold-started between attempts.
  const count = (pingAttempts.get(stepId) ?? 0) + 1;
  pingAttempts.set(stepId, count);
  const effectiveAttempt = Math.max(count, attempt);

  if (driver.flakeFirstPing && effectiveAttempt === 1) {
    throw new RetryableError(
      `GPS ping to ${driver.name} failed — phone dropped off network`,
      { retryAfter: "800ms" },
    );
  }

  return {
    driverId,
    name: driver.name,
    lat: 37.7749 + Math.random() * 0.01,
    lng: -122.4194 + Math.random() * 0.01,
    accuracyM: 8,
    battery: 0.62,
    attempt: effectiveAttempt,
  };
}

async function assignDriver({
  driverId,
  orderId,
}: {
  driverId: string;
  orderId: string;
}) {
  "use step";
  const driver = FLEET.find((d) => d.id === driverId);
  if (!driver) {
    return { assigned: false, error: "driver_not_found" } as const;
  }
  return {
    assigned: true,
    driverId,
    driverName: driver.name,
    orderId,
    etaMin: Math.round(driver.distanceMi * 4 + 3),
  } as const;
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function dispatchRetryWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Dispatch agent for a food-delivery fleet.",
      "A new order just came in from Tartine Manufactory (r-tartine) in SOMA",
      "with orderId ord-9421, bound for 201 Spear St.",
      "Do this, in order:",
      "1. Call listAvailableDrivers with zone 'SOMA'.",
      "2. Pick the CLOSEST driver by distanceMi.",
      "3. Call pingDriverGps on that driver to confirm they are reachable.",
      "   (If the ping flakes, the runtime will retry it transparently — just",
      "    call the tool once and trust the result.)",
      "4. Call assignDriver with that driver's id and orderId ord-9421.",
      "5. Reply with a one-sentence confirmation naming the driver and ETA.",
    ].join(" "),
    tools: {
      listAvailableDrivers: {
        description: "List all drivers currently available in a given zone.",
        inputSchema: z.object({ zone: z.string() }),
        execute: listAvailableDrivers,
      },
      pingDriverGps: {
        description:
          "Ping a driver's phone for a fresh GPS fix. May flake once with RetryableError if the phone is momentarily off network; the runtime will retry.",
        inputSchema: z.object({ driverId: z.string() }),
        execute: pingDriverGps,
      },
      assignDriver: {
        description: "Assign a driver to an order and return ETA in minutes.",
        inputSchema: z.object({
          driverId: z.string(),
          orderId: z.string(),
        }),
        execute: assignDriver,
      },
    },
  });

  const result = await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Dispatch a driver for order ord-9421 from Tartine in SOMA to 201 Spear St.",
      },
    ],
    writable,
    collectUIMessages: true,
    maxSteps: 8,
  });

  return { messages: result.messages, uiMessages: result.uiMessages };
}
