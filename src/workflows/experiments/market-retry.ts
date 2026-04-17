import { DurableAgent } from "@workflow/ai/agent";
import { RetryableError, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Market theme domain vocabulary
//
// The Marketplace optimizer DurableAgent balances supply and demand across
// a food-delivery city by tuning surge multipliers, promo campaigns, and
// zone activation. It reads live zone telemetry, decides whether a zone
// needs a surge bump, and pushes the new multiplier to the downstream
// pricing service.
//
// Retry story: the pricing service sits behind a rate-limited gateway.
// The first push of a surge multiplier to a given zone returns HTTP 429
// ("too many requests"). The tool throws RetryableError; the Workflow
// runtime re-invokes the step with the same stepId after a short backoff,
// the second push goes through, and the agent sees a single success.
//
// This file defines the zone / surge / push vocabulary that the
// market-suspend and market-rollback demos will inherit.
// ---------------------------------------------------------------------------

export type Zone = {
  id: string;
  name: string;
  activeOrders: number;
  availableDrivers: number;
  currentSurge: number;
  // Marking a zone `flakeFirstPush` lets the demo reliably reproduce a
  // 429 rate-limit on attempt 1 for the selected zone.
  flakeFirstPush: boolean;
};

export const ZONES: Zone[] = [
  {
    id: "zn-soma",
    name: "SOMA",
    activeOrders: 128,
    availableDrivers: 14,
    currentSurge: 1.0,
    flakeFirstPush: true,
  },
  {
    id: "zn-mission",
    name: "Mission",
    activeOrders: 42,
    availableDrivers: 22,
    currentSurge: 1.0,
    flakeFirstPush: false,
  },
  {
    id: "zn-marina",
    name: "Marina",
    activeOrders: 31,
    availableDrivers: 19,
    currentSurge: 1.0,
    flakeFirstPush: false,
  },
];

// ---------------------------------------------------------------------------
// Retry bookkeeping: stepId → attempt-count. The Workflow runtime assigns
// the same stepId to every retry of a step, so a module-level Map is the
// canonical way to make a tool "fail once, succeed on retry" without
// requiring the runtime to expose attempt numbers through the agent API.
// ---------------------------------------------------------------------------

const pushAttempts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function readZoneTelemetry({ zoneId }: { zoneId: string }) {
  "use step";
  const zone = ZONES.find((z) => z.id === zoneId);
  if (!zone) {
    throw new Error(`Unknown zone ${zoneId}`);
  }
  const demandRatio =
    zone.availableDrivers === 0
      ? 99
      : Number((zone.activeOrders / zone.availableDrivers).toFixed(2));
  return {
    zoneId: zone.id,
    name: zone.name,
    activeOrders: zone.activeOrders,
    availableDrivers: zone.availableDrivers,
    currentSurge: zone.currentSurge,
    demandRatio,
  };
}

async function computeSurgeMultiplier({
  demandRatio,
}: {
  demandRatio: number;
}) {
  "use step";
  // Simple bucketed surge rule: demand/supply ratio → multiplier.
  let multiplier = 1.0;
  if (demandRatio >= 8) multiplier = 1.8;
  else if (demandRatio >= 5) multiplier = 1.5;
  else if (demandRatio >= 3) multiplier = 1.25;
  else if (demandRatio >= 2) multiplier = 1.1;
  return {
    demandRatio,
    multiplier,
    note:
      multiplier === 1.0
        ? "supply healthy — no surge"
        : `surge recommended at ${multiplier}x`,
  };
}

async function pushSurgeToPricingService({
  zoneId,
  multiplier,
}: {
  zoneId: string;
  multiplier: number;
}) {
  "use step";

  const { stepId, attempt } = getStepMetadata();
  const zone = ZONES.find((z) => z.id === zoneId);
  if (!zone) {
    throw new Error(`Unknown zone ${zoneId}`);
  }

  // Count module-level attempts keyed by stepId. Fall back to the
  // runtime's attempt number so the tool behaves correctly even if the
  // module is cold-started between attempts.
  const count = (pushAttempts.get(stepId) ?? 0) + 1;
  pushAttempts.set(stepId, count);
  const effectiveAttempt = Math.max(count, attempt);

  if (zone.flakeFirstPush && effectiveAttempt === 1) {
    throw new RetryableError(
      `Pricing service 429 for ${zone.name} — rate limit, backing off`,
      { retryAfter: "900ms" },
    );
  }

  return {
    zoneId,
    zoneName: zone.name,
    multiplier,
    appliedAt: `2026-04-15T${String(14 + (effectiveAttempt % 4)).padStart(2, "0")}:00:00Z`,
    pricingTicket: `pt_${stepId.slice(-6)}`,
    attempt: effectiveAttempt,
    status: "applied" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function marketRetryAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Marketplace Optimizer agent for a food-delivery city.",
      "SOMA (zone id: zn-soma) is showing a Friday 7pm demand spike.",
      "Do this, in order:",
      "1. Call readZoneTelemetry with zoneId 'zn-soma' to see live",
      "   activeOrders / availableDrivers / demandRatio.",
      "2. Call computeSurgeMultiplier with the demandRatio you just read",
      "   to decide the new surge multiplier.",
      "3. Call pushSurgeToPricingService with zoneId 'zn-soma' and the",
      "   recommended multiplier. (If the pricing service returns 429,",
      "   the runtime will retry the push transparently — just call the",
      "   tool once and trust the final result.)",
      "4. Reply with ONE short sentence naming the zone and the applied",
      "   multiplier. Do not mention retries or rate limits in the final",
      "   message — the durability layer hides transient failures.",
    ].join(" "),
    tools: {
      readZoneTelemetry: {
        description:
          "Read live active-order and driver counts for a zone, plus the current surge multiplier.",
        inputSchema: z.object({ zoneId: z.string() }),
        execute: readZoneTelemetry,
      },
      computeSurgeMultiplier: {
        description:
          "Given a demand/supply ratio, compute the recommended surge multiplier.",
        inputSchema: z.object({ demandRatio: z.number() }),
        execute: computeSurgeMultiplier,
      },
      pushSurgeToPricingService: {
        description:
          "Push a new surge multiplier for a zone to the pricing service. May flake once with RetryableError if the gateway rate-limits; the runtime will retry.",
        inputSchema: z.object({
          zoneId: z.string(),
          multiplier: z.number(),
        }),
        execute: pushSurgeToPricingService,
      },
    },
  });

  const result = await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "SOMA is spiking on a Friday evening. Read telemetry, compute the surge, and push it live.",
      },
    ],
    writable,
    collectUIMessages: true,
    maxSteps: 8,
  });

  return { messages: result.messages, uiMessages: result.uiMessages };
}
