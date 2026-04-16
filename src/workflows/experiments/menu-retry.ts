import { DurableAgent } from "@workflow/ai/agent";
import { RetryableError, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Retry-tracking store. Same pattern as place-order.ts and order-retry.ts:
// a module-scope Map keyed by stepId ensures that a retried step sees a
// bumped attempt counter, while brand-new steps always start at 1.
// ---------------------------------------------------------------------------

const priceOracleAttempts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

/**
 * Read current menu state for a single SKU. Stable, never flakes.
 */
async function readMenuItem({ sku }: { sku: string }) {
  "use step";
  // Hard-coded slice of our seeded menu so the agent has something real to
  // reason about even without touching ops-data mutations (that's the
  // analyst demo's territory).
  const CATALOG: Record<
    string,
    { sku: string; name: string; price: number; competitorMedian?: number }
  > = {
    "burger-classic": {
      sku: "burger-classic",
      name: "Classic Burger",
      price: 12.5,
    },
  };
  return CATALOG[sku] ?? null;
}

/**
 * Call the competitor price-oracle. This is the flaky tool: a third-party
 * aggregator (imagine a Grubhub/DoorDash scraper service) that 503s on
 * first call, then succeeds on retry. The agent never sees the failure —
 * the SDK replays the step with the same stepId and a bumped `attempt`.
 */
async function fetchCompetitorPrice({
  sku,
  zip,
}: {
  sku: string;
  zip: string;
}) {
  "use step";

  const { stepId, attempt } = getStepMetadata();
  const prior = priceOracleAttempts.get(stepId) ?? 0;
  priceOracleAttempts.set(stepId, prior + 1);

  if (attempt === 1) {
    throw new RetryableError(
      `price-oracle 503 Service Unavailable (sku=${sku}, zip=${zip}) — scraper pool exhausted, retry scheduled`,
      { retryAfter: "900ms" },
    );
  }

  priceOracleAttempts.delete(stepId);
  // Deterministic "market" snapshot so the demo reads the same every run.
  return {
    sku,
    zip,
    competitorMedian: 13.75,
    sampleSize: 7,
    provider: "price-oracle",
    stepId,
    attempt,
  };
}

/**
 * Apply a proposed price tweak to the menu draft. Not flaky — the point of
 * the demo is that the flake is external (the oracle), not the write path.
 */
async function proposePriceTweak({
  sku,
  newPrice,
  reason,
}: {
  sku: string;
  newPrice: number;
  reason: string;
}) {
  "use step";
  return {
    sku,
    newPrice,
    reason,
    proposalId: `tweak_${sku}_${Date.now().toString(36)}`,
    status: "queued" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function menuRetryAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Menu Curator agent for a food-delivery platform.",
      "Your job: tune the price of the Classic Burger (sku=burger-classic)",
      "to stay competitive in zip 94110.",
      "Step 1 — call readMenuItem to see our current price.",
      "Step 2 — call fetchCompetitorPrice to read the local market median.",
      "Step 3 — call proposePriceTweak exactly once with a newPrice that",
      "splits the difference between our price and the competitor median,",
      "rounded to the nearest $0.25. Provide a one-line reason citing both",
      "numbers.",
      "After the three tools complete, reply with one short sentence",
      "summarizing the tweak. Do not mention any transient errors —",
      "the durability layer hides flaky upstream services from you.",
    ].join(" "),
    tools: {
      readMenuItem: {
        description: "Read the current menu entry for a SKU.",
        inputSchema: z.object({ sku: z.string() }),
        execute: readMenuItem,
      },
      fetchCompetitorPrice: {
        description:
          "Fetch the competitor median price for a SKU in a given zip via the price-oracle aggregator.",
        inputSchema: z.object({
          sku: z.string(),
          zip: z.string(),
        }),
        execute: fetchCompetitorPrice,
      },
      proposePriceTweak: {
        description:
          "Queue a proposed price tweak for the menu item. Does not apply it live.",
        inputSchema: z.object({
          sku: z.string(),
          newPrice: z.number(),
          reason: z.string(),
        }),
        execute: proposePriceTweak,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Tune the Classic Burger price for zip 94110 using live market data.",
      },
    ],
    writable,
    maxSteps: 8,
  });
}
