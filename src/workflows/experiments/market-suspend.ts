import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Chapter 2 of the market-retry story.
//
// Chapter 1 (market-retry): the agent pushed a 1.8x surge to SOMA (zn-soma)
// after a 429 flake that the runtime absorbed. 30 minutes later, SOMA is
// still backed up — the demand/supply ratio has climbed from 9.14 to 14.2
// (168 active orders, 12 drivers). The surge ladder says 2.5x.
//
// Marketplace policy caps autonomous surge at 2.0x. Anything above that
// ceiling requires a Pricing PM signoff. The agent reads telemetry,
// recomputes the recommended multiplier, stages the change — and then
// SUSPENDS on a hook waiting for a human pricing lead to approve the
// aggressive 2.5x push. The runtime holds the durable state; the agent
// resumes with its message history intact and pushes (or stands down).
// ---------------------------------------------------------------------------

export const marketSuspendHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
});

export type MarketSuspendPayload = { approved: boolean; reason?: string };

// Policy ceiling above which a human must approve.
const AUTONOMOUS_SURGE_CEILING = 2.0;

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function readZoneTelemetry({ zoneId }: { zoneId: string }) {
  "use step";
  // Chapter-2 state: SOMA has gotten worse since chapter 1 closed.
  if (zoneId !== "zn-soma") {
    throw new Error(`Unknown zone ${zoneId}`);
  }
  return {
    zoneId: "zn-soma",
    name: "SOMA",
    activeOrders: 168,
    availableDrivers: 12,
    currentSurge: 1.8, // left in place by market-retry
    demandRatio: Number((168 / 12).toFixed(2)), // 14.0
    trendVsLastRead: "+54% orders, -2 drivers (30m)",
  };
}

async function computeSurgeMultiplier({
  demandRatio,
}: {
  demandRatio: number;
}) {
  "use step";
  // Extended ladder — chapter-1 ladder topped out at 1.8x.
  let multiplier = 1.0;
  if (demandRatio >= 13) multiplier = 2.5;
  else if (demandRatio >= 10) multiplier = 2.0;
  else if (demandRatio >= 8) multiplier = 1.8;
  else if (demandRatio >= 5) multiplier = 1.5;
  else if (demandRatio >= 3) multiplier = 1.25;
  else if (demandRatio >= 2) multiplier = 1.1;
  return {
    demandRatio,
    multiplier,
    ceiling: AUTONOMOUS_SURGE_CEILING,
    exceedsCeiling: multiplier > AUTONOMOUS_SURGE_CEILING,
    note:
      multiplier > AUTONOMOUS_SURGE_CEILING
        ? `${multiplier}x exceeds ${AUTONOMOUS_SURGE_CEILING}x policy ceiling — requires pricing PM approval`
        : `${multiplier}x within autonomous band`,
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
  const { stepId } = getStepMetadata();
  return {
    zoneId,
    zoneName: "SOMA",
    multiplier,
    appliedAt: "2026-04-15T20:30:00Z",
    pricingTicket: `pt_${stepId.slice(-6)}`,
    status: "applied" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: SUSPEND on a hook until the pricing PM answers.
// ---------------------------------------------------------------------------

async function requestPricingApproval({
  zoneId,
  proposedMultiplier,
  ceiling,
  demandRatio,
}: {
  zoneId: string;
  proposedMultiplier: number;
  ceiling: number;
  demandRatio: number;
}) {
  // Deterministic token so the UI can resume without scraping the stream.
  const token = `market-suspend:${zoneId}`;
  const hook = marketSuspendHook.create({ token });
  const decision = await hook;
  hook.dispose();

  return {
    zoneId,
    proposedMultiplier,
    ceiling,
    demandRatio,
    approved: decision.approved,
    reason: decision.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function marketSuspendAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Marketplace Optimizer agent for a food-delivery city.",
      "This is a FOLLOW-UP to the 1.8x surge you applied to SOMA (zn-soma) 30 minutes ago.",
      "SOMA is still backed up — demand keeps climbing.",
      "Marketplace policy: any surge above 2.0x requires Pricing PM approval.",
      "Your exact procedure:",
      "(1) readZoneTelemetry for zoneId 'zn-soma' to see the new ratio.",
      "(2) computeSurgeMultiplier with that ratio to get the recommended multiplier.",
      "(3) If the recommendation exceeds the 2.0x ceiling, call requestPricingApproval",
      "    with the zoneId, proposedMultiplier, ceiling (2.0), and demandRatio. This suspends",
      "    the workflow until the human pricing lead answers.",
      "(4) ONLY if approval is granted, call pushSurgeToPricingService with zoneId 'zn-soma'",
      "    and the approved multiplier. If rejected, do NOT push — stand down.",
      "Call each tool exactly once. After the flow completes, reply with ONE short sentence",
      "describing the outcome. Never mention suspension, hooks, or internal mechanics.",
    ].join(" "),
    tools: {
      readZoneTelemetry: {
        description:
          "Read live active-order and driver counts for a zone, plus current surge and 30-minute trend.",
        inputSchema: z.object({ zoneId: z.string() }),
        execute: readZoneTelemetry,
      },
      computeSurgeMultiplier: {
        description:
          "Given a demand/supply ratio, compute the recommended surge multiplier. Flags recommendations above the autonomous ceiling.",
        inputSchema: z.object({ demandRatio: z.number() }),
        execute: computeSurgeMultiplier,
      },
      requestPricingApproval: {
        description:
          "Suspend the workflow and ask the human pricing lead to approve or reject an above-ceiling surge multiplier.",
        inputSchema: z.object({
          zoneId: z.string(),
          proposedMultiplier: z.number(),
          ceiling: z.number(),
          demandRatio: z.number(),
        }),
        execute: requestPricingApproval,
      },
      pushSurgeToPricingService: {
        description:
          "Push a new surge multiplier for a zone to the pricing service.",
        inputSchema: z.object({
          zoneId: z.string(),
          multiplier: z.number(),
        }),
        execute: pushSurgeToPricingService,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "SOMA is still spiking after the 1.8x surge. Re-read telemetry, recompute the multiplier, and push the right number live — get signoff if policy requires it.",
      },
    ],
    writable,
    maxSteps: 10,
  });
}
