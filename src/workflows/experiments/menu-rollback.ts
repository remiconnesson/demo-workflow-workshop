import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Chapter 3 of the menu-curator story.
//
// ch.1 (retry): the agent, hidden behind the SDK's retries, drafted a
//   Classic Burger (burger-classic) price tweak for zip 94110 using the
//   price-oracle competitor median — $12.50 → $13.12.
// ch.2 (suspend): the regional manager approved the tweak through the
//   margin-guardrail-v2 hook; the proposal shipped live across POS, the
//   customer-facing app, and partner integrations.
// ch.3 (rollback — this file): an hour later the conversion-rate sentinel
//   detects an 8.1% drop on burger-classic in zip 94110. The agent queries
//   the signal, confirms the regression, then autonomously unwinds the
//   live change by invoking three COMPENSATION tools in reverse order —
//   each paired with its ch.2 forward action. A rollback incident is
//   recorded at the end.
//
// Story beats on stage:
//   forward  : applyPosPrice → pushAppCatalog → notifyPartnerIntegrations
//   trigger  : conversion sentinel hook OR user pressing "Trigger rollback"
//   unwind   : revertPartnerIntegrations → revertAppCatalog → revertPosPrice
//   coda     : recordRollbackIncident
// ---------------------------------------------------------------------------

export const menuRollbackHook = defineHook({
  schema: z.object({
    regressionPct: z.number(),
    reason: z.string().optional(),
  }),
});

export type MenuRollbackPayload = { regressionPct: number; reason?: string };

// ---------------------------------------------------------------------------
// Shared seeded context — matches ch.1 / ch.2 numbers exactly.
// ---------------------------------------------------------------------------

const SKU = "burger-classic";
const ZIP = "94110";
const OLD_PRICE = 12.5;
const NEW_PRICE = 13.12;
const PROPOSAL_ID = `tweak_${SKU}_chapter2`;

// ---------------------------------------------------------------------------
// Forward tools — each mutates a downstream system with the approved price.
// Return a typed receipt that the compensation tool echoes on unwind.
// ---------------------------------------------------------------------------

async function applyPosPrice({
  sku,
  newPrice,
}: {
  sku: string;
  newPrice: number;
}) {
  "use step";
  // Point-of-sale tills in-store. In real life this is the Square/Toast sync.
  return {
    system: "pos" as const,
    sku,
    livePrice: newPrice,
    registers: 148,
    receiptId: `pos_${sku}_${Date.now().toString(36)}`,
  };
}

async function pushAppCatalog({
  sku,
  newPrice,
}: {
  sku: string;
  newPrice: number;
}) {
  "use step";
  // Customer-facing iOS/Android app catalog CDN push.
  return {
    system: "app" as const,
    sku,
    livePrice: newPrice,
    cacheKey: `catalog:${sku}:v${Math.floor(Date.now() / 1000)}`,
    receiptId: `app_${sku}_${Date.now().toString(36)}`,
  };
}

async function notifyPartnerIntegrations({
  sku,
  newPrice,
}: {
  sku: string;
  newPrice: number;
}) {
  "use step";
  // Fan-out to DoorDash / UberEats / Grubhub listing APIs.
  return {
    system: "partners" as const,
    sku,
    livePrice: newPrice,
    partners: ["doordash", "ubereats", "grubhub"],
    receiptId: `prt_${sku}_${Date.now().toString(36)}`,
  };
}

// ---------------------------------------------------------------------------
// Sentinel — this is the workflow's suspension point. It waits on the
// conversion-sentinel hook (resumed autonomously or by the UI trigger)
// and returns the detected regression percentage.
// ---------------------------------------------------------------------------

async function watchConversionSentinel({ sku, zip }: { sku: string; zip: string }) {
  const token = `menu-rollback:${sku}`;
  const hook = menuRollbackHook.create({ token });
  const signal = await hook;
  hook.dispose();
  return {
    sku,
    zip,
    regressionPct: signal.regressionPct,
    reason: signal.reason ?? null,
    token,
    provider: "conversion-sentinel",
  };
}

// ---------------------------------------------------------------------------
// Compensation tools — each undoes exactly one forward action, in reverse.
// ---------------------------------------------------------------------------

async function revertPartnerIntegrations({
  sku,
  oldPrice,
  receiptId,
}: {
  sku: string;
  oldPrice: number;
  receiptId: string;
}) {
  "use step";
  return {
    system: "partners" as const,
    sku,
    restoredPrice: oldPrice,
    partners: ["doordash", "ubereats", "grubhub"],
    undidReceiptId: receiptId,
    status: "reverted" as const,
  };
}

async function revertAppCatalog({
  sku,
  oldPrice,
  receiptId,
}: {
  sku: string;
  oldPrice: number;
  receiptId: string;
}) {
  "use step";
  return {
    system: "app" as const,
    sku,
    restoredPrice: oldPrice,
    purgedCacheKey: `catalog:${sku}:rollback`,
    undidReceiptId: receiptId,
    status: "reverted" as const,
  };
}

async function revertPosPrice({
  sku,
  oldPrice,
  receiptId,
}: {
  sku: string;
  oldPrice: number;
  receiptId: string;
}) {
  "use step";
  return {
    system: "pos" as const,
    sku,
    restoredPrice: oldPrice,
    registers: 148,
    undidReceiptId: receiptId,
    status: "reverted" as const,
  };
}

async function recordRollbackIncident({
  sku,
  regressionPct,
  reason,
}: {
  sku: string;
  regressionPct: number;
  reason: string;
}) {
  "use step";
  return {
    sku,
    regressionPct,
    reason,
    incidentId: `inc_${sku}_${Date.now().toString(36)}`,
    postedTo: "incident-log-v1",
    status: "logged" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function menuRollbackAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Menu Curator agent, now in chapter 3 of the Classic",
      `Burger story. The regional manager approved a price tweak for`,
      `sku=${SKU} in zip ${ZIP} from $${OLD_PRICE.toFixed(2)} to`,
      `$${NEW_PRICE.toFixed(2)}, proposalId=${PROPOSAL_ID}. You will now`,
      "roll it out live, then watch for regressions and unwind if needed.",
      "",
      "Execute this procedure exactly:",
      `(1) Call applyPosPrice with sku=${SKU} and newPrice=${NEW_PRICE}.`,
      `(2) Call pushAppCatalog with sku=${SKU} and newPrice=${NEW_PRICE}.`,
      `(3) Call notifyPartnerIntegrations with sku=${SKU} and newPrice=${NEW_PRICE}.`,
      `(4) Call watchConversionSentinel with sku=${SKU} and zip=${ZIP}.`,
      "    This tool returns only when the conversion-sentinel fires with",
      "    a regression signal. Treat any non-zero regressionPct as a",
      "    rollback trigger.",
      "(5) On rollback, call the compensation tools IN REVERSE ORDER of",
      "    the forward actions, each with the matching receiptId from the",
      `    forward call and oldPrice=${OLD_PRICE}:`,
      "    (a) revertPartnerIntegrations using the partners receiptId.",
      "    (b) revertAppCatalog using the app receiptId.",
      "    (c) revertPosPrice using the pos receiptId.",
      "(6) Finally call recordRollbackIncident with the sku, the",
      "    regressionPct from the sentinel, and a short reason derived",
      "    from the sentinel's reason field.",
      "Call each tool exactly once. After the sequence completes, reply",
      "with ONE short sentence summarizing the rollback outcome. Never",
      "mention hooks, compensation stacks, or internal mechanics — the",
      "durability layer is invisible to the end user.",
    ].join(" "),
    tools: {
      applyPosPrice: {
        description:
          "Push the approved price live to point-of-sale terminals. Returns a pos receiptId used later to unwind.",
        inputSchema: z.object({
          sku: z.string(),
          newPrice: z.number(),
        }),
        execute: applyPosPrice,
      },
      pushAppCatalog: {
        description:
          "Publish the approved price to the customer-facing app catalog CDN. Returns an app receiptId used later to unwind.",
        inputSchema: z.object({
          sku: z.string(),
          newPrice: z.number(),
        }),
        execute: pushAppCatalog,
      },
      notifyPartnerIntegrations: {
        description:
          "Fan-out the approved price to partner marketplaces (DoorDash, UberEats, Grubhub). Returns a partners receiptId used later to unwind.",
        inputSchema: z.object({
          sku: z.string(),
          newPrice: z.number(),
        }),
        execute: notifyPartnerIntegrations,
      },
      watchConversionSentinel: {
        description:
          "Watch the conversion-sentinel for the SKU in the given zip. Suspends the run until a regression signal arrives. Returns the regression percentage and reason.",
        inputSchema: z.object({
          sku: z.string(),
          zip: z.string(),
        }),
        execute: watchConversionSentinel,
      },
      revertPartnerIntegrations: {
        description:
          "Compensation for notifyPartnerIntegrations. Rolls partner listings back to the prior price.",
        inputSchema: z.object({
          sku: z.string(),
          oldPrice: z.number(),
          receiptId: z.string(),
        }),
        execute: revertPartnerIntegrations,
      },
      revertAppCatalog: {
        description:
          "Compensation for pushAppCatalog. Purges the app CDN cache and restores the prior price.",
        inputSchema: z.object({
          sku: z.string(),
          oldPrice: z.number(),
          receiptId: z.string(),
        }),
        execute: revertAppCatalog,
      },
      revertPosPrice: {
        description:
          "Compensation for applyPosPrice. Restores the prior price on all point-of-sale registers.",
        inputSchema: z.object({
          sku: z.string(),
          oldPrice: z.number(),
          receiptId: z.string(),
        }),
        execute: revertPosPrice,
      },
      recordRollbackIncident: {
        description:
          "Append a rollback incident entry to the ops incident log. Call once at the very end of an unwind.",
        inputSchema: z.object({
          sku: z.string(),
          regressionPct: z.number(),
          reason: z.string(),
        }),
        execute: recordRollbackIncident,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content: `Ship the approved Classic Burger price change (sku=${SKU}, zip=${ZIP}, $${OLD_PRICE.toFixed(2)} → $${NEW_PRICE.toFixed(2)}) to POS, app, and partners, then watch the conversion sentinel and unwind if it fires.`,
      },
    ],
    writable,
    maxSteps: 14,
  });
}
