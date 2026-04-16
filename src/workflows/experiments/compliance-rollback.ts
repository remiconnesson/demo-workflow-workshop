import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Compliance · Rollback (Chapter 3 of the recall arc)
//
// Previously on Compliance:
//   Ch.1 (compliance-retry)   — Agent audited sku-shrimp-pad-thai at
//                               Bangkok Street. FDA RES flaked once, retry
//                               landed, finding find_ALG01 (ALG-UNDECLARED,
//                               critical) was filed against FDA recall
//                               F-1207-2026 on peanut batch PN-2041-C.
//   Ch.2 (compliance-suspend) — Agent drafted the customer notice, suspended
//                               for Legal + PR, and on approval dispatched
//                               the FDA-compliant email to 8 exposed buyers.
//
// Chapter 3 is the mop-up + the twist.
//
// The agent now executes the public-facing stage of the recall: it seals the
// dossier, flags Bangkok Street on the marketplace, files the formal FDA
// recall report, and pulls sku-shrimp-pad-thai from the platform. Then it
// suspends while the contract lab re-runs the CoA on a retained sample of
// batch PN-2041-C.
//
// The lab returns FALSE POSITIVE — the "undeclared milk" hit was a sampling
// cross-contamination in the lab's own prep station. The peanut batch is
// clean. The agent must now UNWIND the recall in REVERSE ORDER — every
// public action has to be retracted, and the 8 buyers who received a scary
// allergen notice must be re-contacted with an apology and an "all clear".
//
// Forward:   sealRecallDossier → flagRestaurantOnMarketplace →
//            fileFdaRecallReport → removeMenuItemFromPlatform →
//            awaitLabReanalysis (suspend)
// Rollback:  restoreMenuItem → withdrawFdaRecallReport →
//            unflagRestaurantOnMarketplace → unsealRecallDossier →
//            notifyBuyersRecallRetracted
//
// The rollback fires on a trigger hook whose token is
//   compliance-rollback:find_ALG01
// The UI exposes a "Trigger: lab clears batch" button that resumes the hook
// with falsePositive=true. A fallback "Trigger: lab confirms recall" ends
// the run without unwinding.
// ---------------------------------------------------------------------------

export const complianceRollbackHook = defineHook({
  schema: z.object({
    falsePositive: z.boolean(),
    labNote: z.string().optional(),
  }),
});

export type ComplianceRollbackPayload = {
  falsePositive: boolean;
  labNote?: string;
};

// Carry over from chapters 1 + 2.
const FINDING_ID = "find_ALG01";
const SKU = "sku-shrimp-pad-thai";
const ITEM_NAME = "Shrimp Pad Thai";
const RESTAURANT_ID = "r-bangkok-street";
const RESTAURANT_NAME = "Bangkok Street";
const RECALL_ID = "F-1207-2026";
const BATCH_ID = "PN-2041-C";
const EXPOSED_BUYERS = 8;

// ---------------------------------------------------------------------------
// Forward step-backed tools — each performs a public, auditable action that
// the agent will later have to undo if the lab clears the batch.
// ---------------------------------------------------------------------------

async function sealRecallDossier({
  findingId,
  recallId,
}: {
  findingId: string;
  recallId: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    forward: "sealRecallDossier" as const,
    dossierId: `dsr_${stepId.slice(-6)}`,
    findingId,
    recallId,
    artifacts: ["finding", "draft", "dispatch", "buyer-roster"],
    sealedAt: "2026-04-15T14:38:00Z",
    status: "sealed" as const,
  };
}

async function flagRestaurantOnMarketplace({
  restaurantId,
  recallId,
}: {
  restaurantId: string;
  recallId: string;
}) {
  "use step";
  return {
    forward: "flagRestaurantOnMarketplace" as const,
    restaurantId,
    recallId,
    banner: `FDA recall ${recallId} — item removed pending review`,
    visibility: "public" as const,
    status: "flagged" as const,
  };
}

async function fileFdaRecallReport({
  recallId,
  sku,
  batchId,
  exposedCount,
}: {
  recallId: string;
  sku: string;
  batchId: string;
  exposedCount: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    forward: "fileFdaRecallReport" as const,
    recallId,
    sku,
    batchId,
    exposedCount,
    submissionId: `fda_${stepId.slice(-6)}`,
    class: "I" as const,
    filedAt: "2026-04-15T14:41:00Z",
    status: "filed" as const,
  };
}

async function removeMenuItemFromPlatform({
  sku,
  restaurantId,
}: {
  sku: string;
  restaurantId: string;
}) {
  "use step";
  return {
    forward: "removeMenuItemFromPlatform" as const,
    sku,
    restaurantId,
    previousState: "available" as const,
    newState: "removed_recall" as const,
    removedAt: "2026-04-15T14:42:00Z",
  };
}

// ---------------------------------------------------------------------------
// Compensation step-backed tools — each undoes exactly one forward action.
// ---------------------------------------------------------------------------

async function restoreMenuItem({
  sku,
  restaurantId,
}: {
  sku: string;
  restaurantId: string;
}) {
  "use step";
  return {
    undone: "removeMenuItemFromPlatform" as const,
    sku,
    restaurantId,
    newState: "available" as const,
    detail: `${ITEM_NAME} re-listed at ${RESTAURANT_NAME}.`,
    restoredAt: "2026-04-15T14:49:00Z",
  };
}

async function withdrawFdaRecallReport({
  recallId,
  submissionId,
  labNote,
}: {
  recallId: string;
  submissionId: string;
  labNote: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    undone: "fileFdaRecallReport" as const,
    recallId,
    submissionId,
    withdrawalId: `fda_wd_${stepId.slice(-6)}`,
    reason: labNote,
    withdrawnAt: "2026-04-15T14:50:00Z",
    status: "withdrawn" as const,
  };
}

async function unflagRestaurantOnMarketplace({
  restaurantId,
  recallId,
}: {
  restaurantId: string;
  recallId: string;
}) {
  "use step";
  return {
    undone: "flagRestaurantOnMarketplace" as const,
    restaurantId,
    recallId,
    visibility: "public" as const,
    status: "clear" as const,
    detail: `${RESTAURANT_NAME} banner removed; listing restored.`,
  };
}

async function unsealRecallDossier({
  dossierId,
  labNote,
}: {
  dossierId: string;
  labNote: string;
}) {
  "use step";
  return {
    undone: "sealRecallDossier" as const,
    dossierId,
    labNote,
    status: "retracted" as const,
    archivedAs: "false-positive" as const,
    detail: "Dossier reclassified; finding marked retracted in audit log.",
  };
}

async function notifyBuyersRecallRetracted({
  sku,
  recallId,
  exposedCount,
  labNote,
}: {
  sku: string;
  recallId: string;
  exposedCount: number;
  labNote: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    undone: "customerNotification" as const,
    sku,
    recallId,
    exposedCount,
    dispatchId: `dsp_retract_${stepId.slice(-6)}`,
    subject: `Update on recall ${recallId}: your ${ITEM_NAME} order is safe`,
    body: `A re-test of batch ${BATCH_ID} cleared the supplier. ${labNote} We apologize for the alarm.`,
    channel: "email" as const,
    sentAt: "2026-04-15T14:52:00Z",
    status: "sent" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: SUSPEND awaiting the lab re-analysis result.
// NOTE: no "use step" — hooks must be awaited at the workflow level.
// ---------------------------------------------------------------------------

async function awaitLabReanalysis({ findingId }: { findingId: string }) {
  const token = `compliance-rollback:${findingId}`;
  const hook = complianceRollbackHook.create({ token });
  const result = await hook;
  hook.dispose();
  return {
    findingId,
    token,
    falsePositive: result.falsePositive,
    labNote:
      result.labNote ??
      "Retained sample re-assay negative for milk protein (LC-MS/MS, <1 ppm).",
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function complianceRollbackAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Compliance auditor agent for a food-delivery marketplace.",
      `This is the FINAL chapter of the recall of ${SKU} at ${RESTAURANT_NAME}.`,
      `Chapter 1 filed finding ${FINDING_ID} (ALG-UNDECLARED, critical).`,
      `Chapter 2 got Legal + PR approval and notified ${EXPOSED_BUYERS} exposed`,
      `buyers about FDA recall ${RECALL_ID} on peanut batch ${BATCH_ID}.`,
      "",
      "FORWARD PHASE — execute the public stage of the recall. Call each tool",
      "exactly once, in this order:",
      `  (1) sealRecallDossier with findingId '${FINDING_ID}' and recallId`,
      `      '${RECALL_ID}'. Remember the returned dossierId.`,
      `  (2) flagRestaurantOnMarketplace with restaurantId '${RESTAURANT_ID}'`,
      `      and recallId '${RECALL_ID}'.`,
      `  (3) fileFdaRecallReport with recallId '${RECALL_ID}', sku '${SKU}',`,
      `      batchId '${BATCH_ID}', exposedCount ${EXPOSED_BUYERS}. Remember`,
      "      the returned submissionId.",
      `  (4) removeMenuItemFromPlatform with sku '${SKU}' and restaurantId`,
      `      '${RESTAURANT_ID}'.`,
      "",
      "SUSPENSION:",
      `  (5) awaitLabReanalysis with findingId '${FINDING_ID}'. The contract`,
      "      lab is re-running the CoA on a retained sample; wait for the",
      "      result. Do not retry this call.",
      "",
      "BRANCH:",
      "- If the result has falsePositive=false, the recall stands. Reply with",
      "  ONE short sentence confirming the recall is finalized and stop.",
      "- If falsePositive=true, the lab cleared batch PN-2041-C. You MUST",
      "  UNWIND every public action in EXACT REVERSE ORDER of the forward",
      "  phase, then send the buyer retraction:",
      `    (a) restoreMenuItem with sku '${SKU}' and restaurantId`,
      `        '${RESTAURANT_ID}' — undoes step 4.`,
      `    (b) withdrawFdaRecallReport with recallId '${RECALL_ID}', the`,
      "        submissionId from step 3, and the labNote from the lab result",
      "        — undoes step 3.",
      `    (c) unflagRestaurantOnMarketplace with restaurantId`,
      `        '${RESTAURANT_ID}' and recallId '${RECALL_ID}' — undoes step 2.`,
      "    (d) unsealRecallDossier with the dossierId from step 1 and the",
      "        labNote — undoes step 1.",
      `    (e) notifyBuyersRecallRetracted with sku '${SKU}', recallId`,
      `        '${RECALL_ID}', exposedCount ${EXPOSED_BUYERS}, and the`,
      `        labNote — apology + all-clear to the ${EXPOSED_BUYERS} buyers`,
      "        from chapter 2.",
      "",
      "Reply with ONE short sentence confirming the recall was retracted and",
      "the buyers were re-contacted. Never mention hooks, suspension, or any",
      "internal mechanics. Call each tool at most once.",
    ].join("\n"),
    tools: {
      sealRecallDossier: {
        description:
          "Seal the recall dossier (finding, draft, dispatch, roster) for audit. Forward action #1.",
        inputSchema: z.object({
          findingId: z.string(),
          recallId: z.string(),
        }),
        execute: sealRecallDossier,
      },
      flagRestaurantOnMarketplace: {
        description:
          "Post a public recall banner on the restaurant's marketplace listing. Forward action #2.",
        inputSchema: z.object({
          restaurantId: z.string(),
          recallId: z.string(),
        }),
        execute: flagRestaurantOnMarketplace,
      },
      fileFdaRecallReport: {
        description:
          "File the formal Class I recall report with the FDA Recall Enterprise Reporting System. Forward action #3.",
        inputSchema: z.object({
          recallId: z.string(),
          sku: z.string(),
          batchId: z.string(),
          exposedCount: z.number(),
        }),
        execute: fileFdaRecallReport,
      },
      removeMenuItemFromPlatform: {
        description:
          "Remove the affected SKU from the platform so no new orders can be placed. Forward action #4.",
        inputSchema: z.object({
          sku: z.string(),
          restaurantId: z.string(),
        }),
        execute: removeMenuItemFromPlatform,
      },
      awaitLabReanalysis: {
        description:
          "Suspend the workflow until the contract lab re-analyzes the retained batch sample. Returns { falsePositive, labNote }.",
        inputSchema: z.object({ findingId: z.string() }),
        execute: awaitLabReanalysis,
      },
      restoreMenuItem: {
        description:
          "Compensation for removeMenuItemFromPlatform — re-list the SKU at the restaurant.",
        inputSchema: z.object({
          sku: z.string(),
          restaurantId: z.string(),
        }),
        execute: restoreMenuItem,
      },
      withdrawFdaRecallReport: {
        description:
          "Compensation for fileFdaRecallReport — submit a formal withdrawal citing the lab re-test.",
        inputSchema: z.object({
          recallId: z.string(),
          submissionId: z.string(),
          labNote: z.string(),
        }),
        execute: withdrawFdaRecallReport,
      },
      unflagRestaurantOnMarketplace: {
        description:
          "Compensation for flagRestaurantOnMarketplace — pull the recall banner and restore the listing.",
        inputSchema: z.object({
          restaurantId: z.string(),
          recallId: z.string(),
        }),
        execute: unflagRestaurantOnMarketplace,
      },
      unsealRecallDossier: {
        description:
          "Compensation for sealRecallDossier — reclassify the dossier as a retracted false positive in the audit log.",
        inputSchema: z.object({
          dossierId: z.string(),
          labNote: z.string(),
        }),
        execute: unsealRecallDossier,
      },
      notifyBuyersRecallRetracted: {
        description:
          "Email the 8 previously-notified exposed buyers that the recall was a false alarm and their order was safe.",
        inputSchema: z.object({
          sku: z.string(),
          recallId: z.string(),
          exposedCount: z.number(),
          labNote: z.string(),
        }),
        execute: notifyBuyersRecallRetracted,
      },
    },
  });

  const result = await agent.stream({
    messages: [
      {
        role: "user",
        content: [
          `Finalize the public stage of recall ${RECALL_ID} on ${SKU} at ${RESTAURANT_NAME}`,
          `(finding ${FINDING_ID}, batch ${BATCH_ID}, ${EXPOSED_BUYERS} exposed buyers already notified).`,
          "Seal the dossier, flag the restaurant, file the FDA report, pull the item from the platform,",
          "then stand by for the lab's re-analysis of the retained sample before closing out.",
        ].join(" "),
      },
    ],
    writable,
    collectUIMessages: true,
    maxSteps: 16,
  });

  return { messages: result.messages, uiMessages: result.uiMessages };
}
