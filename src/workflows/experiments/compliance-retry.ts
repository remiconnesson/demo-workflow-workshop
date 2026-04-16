import { DurableAgent } from "@workflow/ai/agent";
import { RetryableError, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Compliance theme domain vocabulary
//
// The Compliance DurableAgent audits a live menu item for allergen and
// food-safety issues. The retry story: the agent cross-checks a dish
// against the FDA Recall Enterprise Reporting System (RES) feed. The
// first request to the FDA endpoint times out (503 behind the gateway);
// the Workflow runtime retries the step with the SAME stepId and the
// second call returns the recall record. From the agent's perspective,
// a single tool call returns a single result — the transient outage is
// hidden by the durability layer.
//
// This file also seeds the compliance vocabulary (MENU_ITEM, allergen
// codes, violation codes) inherited by compliance-suspend and
// compliance-rollback.
// ---------------------------------------------------------------------------

export type Allergen =
  | "peanut"
  | "tree-nut"
  | "shellfish"
  | "fish"
  | "milk"
  | "egg"
  | "wheat"
  | "soy"
  | "sesame";

export type MenuItem = {
  sku: string;
  name: string;
  restaurantId: string;
  restaurantName: string;
  declaredAllergens: Allergen[];
  ingredients: string[];
};

// The dish under audit. Shrimp Pad Thai declares shellfish + peanut +
// egg + soy + wheat — but the FDA RES feed has an active Class I recall
// on the peanut supplier (batch PN-2041-C) for undeclared milk protein.
// The agent's job is to surface that cross-reference.
export const AUDIT_TARGET: MenuItem = {
  sku: "sku-shrimp-pad-thai",
  name: "Shrimp Pad Thai",
  restaurantId: "r-bangkok-street",
  restaurantName: "Bangkok Street",
  declaredAllergens: ["shellfish", "peanut", "egg", "soy", "wheat"],
  ingredients: [
    "rice noodle",
    "shrimp",
    "peanut (batch PN-2041-C)",
    "egg",
    "fish sauce",
    "tamarind",
    "bean sprout",
  ],
};

// FDA RES recall mock — keyed by ingredient batch. Class I = highest
// severity (reasonable probability of serious health consequences).
const FDA_RECALLS: Record<
  string,
  {
    recallId: string;
    class: "I" | "II" | "III";
    reason: string;
    undeclaredAllergen: Allergen | null;
    issuedAt: string;
  }
> = {
  "PN-2041-C": {
    recallId: "F-1207-2026",
    class: "I",
    reason: "Undeclared milk protein in roasted peanut batch",
    undeclaredAllergen: "milk",
    issuedAt: "2026-04-12",
  },
};

// ---------------------------------------------------------------------------
// Retry bookkeeping: stepId → attempt. Matches the dispatch-retry / order-
// retry pattern so the demo is reliably reproducible even if the module
// gets cold-started between attempts.
// ---------------------------------------------------------------------------

const recallFeedAttempts = new Map<string, number>();

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function fetchMenuItem({ sku }: { sku: string }) {
  "use step";
  if (sku !== AUDIT_TARGET.sku) {
    return { found: false as const, sku };
  }
  return {
    found: true as const,
    ...AUDIT_TARGET,
  };
}

async function checkFdaRecallFeed({ batchId }: { batchId: string }) {
  "use step";

  const { stepId, attempt } = getStepMetadata();

  // Count attempts in-module so the demo still fails-then-succeeds even
  // if the runtime attempt number resets (cold start between retries).
  const count = (recallFeedAttempts.get(stepId) ?? 0) + 1;
  recallFeedAttempts.set(stepId, count);
  const effectiveAttempt = Math.max(count, attempt);

  // First attempt: FDA RES gateway 503s. Same stepId → runtime replays.
  if (effectiveAttempt === 1) {
    throw new RetryableError(
      `FDA RES gateway 503 on batch ${batchId} — retry scheduled`,
      { retryAfter: "900ms" },
    );
  }

  const hit = FDA_RECALLS[batchId];
  if (!hit) {
    return {
      batchId,
      recalled: false as const,
      attempt: effectiveAttempt,
      source: "fda-res",
    };
  }
  return {
    batchId,
    recalled: true as const,
    recallId: hit.recallId,
    class: hit.class,
    reason: hit.reason,
    undeclaredAllergen: hit.undeclaredAllergen,
    issuedAt: hit.issuedAt,
    attempt: effectiveAttempt,
    source: "fda-res",
  };
}

async function fileComplianceFinding({
  sku,
  violationCode,
  severity,
  summary,
}: {
  sku: string;
  violationCode: string;
  severity: "info" | "warn" | "critical";
  summary: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    filed: true as const,
    findingId: `find_${stepId.slice(-6)}`,
    sku,
    violationCode,
    severity,
    summary,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function complianceRetryAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Compliance auditor agent for a food-delivery marketplace.",
      "A menu item was just flagged for audit: sku-shrimp-pad-thai at Bangkok Street.",
      "Do this, in order:",
      "1. Call fetchMenuItem with sku 'sku-shrimp-pad-thai' to pull declared allergens and ingredients.",
      "2. Scan the ingredient list for a batch identifier (formatted like 'PN-2041-C').",
      "3. Call checkFdaRecallFeed with that batchId to cross-reference active FDA recalls.",
      "   (The FDA feed is known to flake — if it times out, the runtime will retry",
      "    the step transparently. Just call the tool once and trust the result.)",
      "4. If the recall exposes an undeclared allergen that is NOT in declaredAllergens,",
      "   call fileComplianceFinding with violationCode 'ALG-UNDECLARED', severity 'critical',",
      "   and a one-sentence summary naming the allergen and FDA recall id.",
      "5. Reply with one sentence stating the finding (or 'clean' if none).",
    ].join(" "),
    tools: {
      fetchMenuItem: {
        description:
          "Fetch a menu item's declared allergens and ingredient list by SKU.",
        inputSchema: z.object({ sku: z.string() }),
        execute: fetchMenuItem,
      },
      checkFdaRecallFeed: {
        description:
          "Cross-reference an ingredient batch id against the FDA Recall Enterprise Reporting System. May flake once with RetryableError if the FDA gateway 503s — the runtime will retry with the same stepId.",
        inputSchema: z.object({ batchId: z.string() }),
        execute: checkFdaRecallFeed,
      },
      fileComplianceFinding: {
        description:
          "File a durable compliance finding against a menu item. Use for undeclared allergens, recalls, or safety violations.",
        inputSchema: z.object({
          sku: z.string(),
          violationCode: z.string(),
          severity: z.enum(["info", "warn", "critical"]),
          summary: z.string(),
        }),
        execute: fileComplianceFinding,
      },
    },
  });

  const result = await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Audit sku-shrimp-pad-thai at Bangkok Street for allergen and recall issues.",
      },
    ],
    writable,
    collectUIMessages: true,
    maxSteps: 8,
  });

  return { messages: result.messages, uiMessages: result.uiMessages };
}
