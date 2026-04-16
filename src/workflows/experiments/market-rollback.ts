import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Chapter 3 of the market story.
//
// Chapter 1 (market-retry): agent applied 1.8x surge to SOMA after a 429 flake.
// Chapter 2 (market-suspend): pricing PM approved a 2.5x surge after ratio hit
//   14.0. The agent pushed 2.5x, notified drivers, lit up customer-app banners,
//   and flagged zn-soma on internal dashboards.
//
// Chapter 3 (market-rollback): 15 minutes later the agent is still watching.
// Two bad signals hit at once:
//   1. Conversion cliff — orders collapse from 168 to 92 (-45%) as customers
//      bail on the 2.5x receipt.
//   2. PR backlash — the driver union publishes a public post calling out
//      the surge as predatory, and press picks it up.
// Either the agent detects this autonomously OR a legal/PR officer fires a
// manual rollback trigger via hook. The agent then UNWINDS its four forward
// actions in reverse order — retract dashboard flag → pull customer banner
// → send drivers a correction notice → revert pricing to the 1.5x baseline.
//
// Pattern: a compensation stack, popped in reverse (same shape as
// place-order.ts). Each compensation is its own `"use step"` tool so the
// stage reads one durable rollback per card.
// ---------------------------------------------------------------------------

export const marketRollbackHook = defineHook({
  schema: z.object({
    fired: z.boolean(),
    reason: z.string().optional(),
    source: z.enum(["pr", "legal", "conversion", "autonomous"]).optional(),
  }),
});

export type MarketRollbackPayload = {
  fired: boolean;
  reason?: string;
  source?: "pr" | "legal" | "conversion" | "autonomous";
};

// The 2.5x from ch.2 rolls back to a safer 1.5x baseline — not 1.0x, because
// SOMA is still backed up; we're undoing the *above-ceiling* portion.
const ROLLBACK_BASELINE = 1.5;
const APPROVED_SURGE = 2.5;

// ---------------------------------------------------------------------------
// Forward step-backed tools (mutate market state)
// ---------------------------------------------------------------------------

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
    appliedAt: "2026-04-15T20:35:00Z",
    pricingTicket: `pt_${stepId.slice(-6)}`,
    status: "applied" as const,
  };
}

async function notifyDriverFleet({
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
    channel: "driver-push",
    driversNotified: 12,
    multiplier,
    message: `SOMA surge raised to ${multiplier}x — earnings boosted`,
    noticeId: `dn_${stepId.slice(-6)}`,
    status: "sent" as const,
  };
}

async function pushCustomerAppBanner({
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
    surface: "customer-home-banner",
    audienceSize: 8400,
    multiplier,
    copy: `High demand in SOMA — ${multiplier}x surge in effect`,
    bannerId: `bn_${stepId.slice(-6)}`,
    status: "live" as const,
  };
}

async function flagZoneInternalDashboard({
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
    dashboard: "ops-heatmap",
    flag: "AGGRESSIVE_SURGE",
    multiplier,
    flagId: `fl_${stepId.slice(-6)}`,
    status: "flagged" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: wait for a rollback trigger (UI hook OR autonomous).
// The agent calls this after the forward push; the workflow suspends until
// the driver-union/legal/conversion signal fires via
// /api/experiments/market-rollback/trigger.
// ---------------------------------------------------------------------------

async function watchForBacklash({ zoneId }: { zoneId: string }) {
  const token = `market-rollback:${zoneId}`;
  const hook = marketRollbackHook.create({ token });
  const signal = await hook;
  hook.dispose();

  return {
    zoneId,
    fired: signal.fired,
    source: signal.source ?? "autonomous",
    reason:
      signal.reason ??
      "Driver union post went viral; conversion dropped 45% in 15 minutes",
    token,
  };
}

// ---------------------------------------------------------------------------
// Compensation step-backed tools (reverse unwind)
// Each mirrors a forward tool. They're ordered here in the same sequence
// the agent is instructed to call them — the *reverse* of the forward order.
// ---------------------------------------------------------------------------

async function retractZoneInternalFlag({
  zoneId,
  flagId,
}: {
  zoneId: string;
  flagId: string;
}) {
  "use step";
  return {
    zoneId,
    flagId,
    dashboard: "ops-heatmap",
    status: "cleared" as const,
    compensationFor: "flagZoneInternalDashboard",
  };
}

async function retractCustomerAppBanner({
  zoneId,
  bannerId,
}: {
  zoneId: string;
  bannerId: string;
}) {
  "use step";
  return {
    zoneId,
    bannerId,
    surface: "customer-home-banner",
    audienceSize: 8400,
    status: "pulled" as const,
    compensationFor: "pushCustomerAppBanner",
  };
}

async function sendDriverCorrectionNotice({
  zoneId,
  noticeId,
}: {
  zoneId: string;
  noticeId: string;
}) {
  "use step";
  return {
    zoneId,
    channel: "driver-push",
    supersedes: noticeId,
    driversNotified: 12,
    message:
      "SOMA surge reverted to 1.5x — prior notice superseded, earnings window reset",
    status: "sent" as const,
    compensationFor: "notifyDriverFleet",
  };
}

async function revertSurgeToBaseline({
  zoneId,
  pricingTicket,
  baseline,
}: {
  zoneId: string;
  pricingTicket: string;
  baseline: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    zoneId,
    zoneName: "SOMA",
    supersedes: pricingTicket,
    multiplier: baseline,
    appliedAt: "2026-04-15T20:52:00Z",
    pricingTicket: `pt_${stepId.slice(-6)}`,
    status: "reverted" as const,
    compensationFor: "pushSurgeToPricingService",
  };
}

async function fileIncidentReport({
  zoneId,
  source,
  reason,
}: {
  zoneId: string;
  source: string;
  reason: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    zoneId,
    source,
    reason,
    reportId: `ir_${stepId.slice(-6)}`,
    status: "filed" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function marketRollbackAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Marketplace Optimizer agent for a food-delivery city.",
      "CONTEXT: 15 minutes ago the pricing PM approved a 2.5x surge on SOMA (zn-soma).",
      "The surge is LIVE and you are responsible for both rolling it out and",
      "unwinding it if the market reacts badly.",
      "",
      "YOUR PROCEDURE — execute in exact order, calling each tool ONCE:",
      "",
      "Forward rollout (push the approved 2.5x into the world):",
      "(1) pushSurgeToPricingService zoneId='zn-soma' multiplier=2.5",
      "(2) notifyDriverFleet zoneId='zn-soma' multiplier=2.5",
      "(3) pushCustomerAppBanner zoneId='zn-soma' multiplier=2.5",
      "(4) flagZoneInternalDashboard zoneId='zn-soma' multiplier=2.5",
      "",
      "Monitor:",
      "(5) watchForBacklash zoneId='zn-soma' — this SUSPENDS the workflow",
      "    until a backlash signal arrives (driver union, legal, or conversion",
      "    cliff). The runtime wakes you with {fired:true, source, reason}.",
      "",
      "Reverse unwind — ONLY if fired=true, call compensations in REVERSE",
      "order of the forward steps. Pass the IDs from the forward tool outputs:",
      "(6) retractZoneInternalFlag zoneId='zn-soma' flagId=<flagId from step 4>",
      "(7) retractCustomerAppBanner zoneId='zn-soma' bannerId=<bannerId from step 3>",
      "(8) sendDriverCorrectionNotice zoneId='zn-soma' noticeId=<noticeId from step 2>",
      "(9) revertSurgeToBaseline zoneId='zn-soma' pricingTicket=<pricingTicket from step 1> baseline=1.5",
      "(10) fileIncidentReport zoneId='zn-soma' source=<source from step 5> reason=<reason from step 5>",
      "",
      "After unwind, reply with ONE short sentence: the zone, the final multiplier,",
      "and the reason for rollback. Never mention hooks, suspension, or compensation",
      "stacks — the durability layer is invisible to end users.",
    ].join("\n"),
    tools: {
      pushSurgeToPricingService: {
        description:
          "Push the approved surge multiplier to the pricing service. Returns a pricingTicket needed by revertSurgeToBaseline.",
        inputSchema: z.object({
          zoneId: z.string(),
          multiplier: z.number(),
        }),
        execute: pushSurgeToPricingService,
      },
      notifyDriverFleet: {
        description:
          "Push a fleet-wide notice to drivers that the surge is active. Returns a noticeId needed by sendDriverCorrectionNotice.",
        inputSchema: z.object({
          zoneId: z.string(),
          multiplier: z.number(),
        }),
        execute: notifyDriverFleet,
      },
      pushCustomerAppBanner: {
        description:
          "Light the customer-app home banner announcing the surge. Returns a bannerId needed by retractCustomerAppBanner.",
        inputSchema: z.object({
          zoneId: z.string(),
          multiplier: z.number(),
        }),
        execute: pushCustomerAppBanner,
      },
      flagZoneInternalDashboard: {
        description:
          "Flag the zone on the internal ops heatmap as AGGRESSIVE_SURGE. Returns a flagId needed by retractZoneInternalFlag.",
        inputSchema: z.object({
          zoneId: z.string(),
          multiplier: z.number(),
        }),
        execute: flagZoneInternalDashboard,
      },
      watchForBacklash: {
        description:
          "Suspend the workflow and wait for a backlash signal (driver union / legal / conversion cliff). Resumes with {fired, source, reason}.",
        inputSchema: z.object({ zoneId: z.string() }),
        execute: watchForBacklash,
      },
      retractZoneInternalFlag: {
        description:
          "COMPENSATION for flagZoneInternalDashboard. Clear the AGGRESSIVE_SURGE flag from the ops heatmap.",
        inputSchema: z.object({
          zoneId: z.string(),
          flagId: z.string(),
        }),
        execute: retractZoneInternalFlag,
      },
      retractCustomerAppBanner: {
        description:
          "COMPENSATION for pushCustomerAppBanner. Pull the home-banner surge notice from the customer app.",
        inputSchema: z.object({
          zoneId: z.string(),
          bannerId: z.string(),
        }),
        execute: retractCustomerAppBanner,
      },
      sendDriverCorrectionNotice: {
        description:
          "COMPENSATION for notifyDriverFleet. Send drivers a correction notice superseding the prior push.",
        inputSchema: z.object({
          zoneId: z.string(),
          noticeId: z.string(),
        }),
        execute: sendDriverCorrectionNotice,
      },
      revertSurgeToBaseline: {
        description:
          "COMPENSATION for pushSurgeToPricingService. Supersede the prior pricing ticket and push the baseline multiplier.",
        inputSchema: z.object({
          zoneId: z.string(),
          pricingTicket: z.string(),
          baseline: z.number(),
        }),
        execute: revertSurgeToBaseline,
      },
      fileIncidentReport: {
        description:
          "File an incident report capturing the rollback source and reason. Called after all compensations.",
        inputSchema: z.object({
          zoneId: z.string(),
          source: z.string(),
          reason: z.string(),
        }),
        execute: fileIncidentReport,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content: [
          "The pricing PM just approved a 2.5x surge on SOMA.",
          "Roll it out across all four surfaces, then stand guard.",
          "If the market pushes back, unwind everything in reverse order",
          `and return SOMA to a ${ROLLBACK_BASELINE}x baseline.`,
        ].join(" "),
      },
    ],
    writable,
    maxSteps: 16,
  });

  // Silence unused-const warnings without changing runtime behavior.
  void APPROVED_SURGE;
}
