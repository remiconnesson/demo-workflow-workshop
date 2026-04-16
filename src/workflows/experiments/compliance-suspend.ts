import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Chapter 2 of the compliance recall investigation.
//
// At the end of compliance-retry, the agent filed finding
// find_ALG01 against sku-shrimp-pad-thai at Bangkok Street — an
// ALG-UNDECLARED critical violation. FDA recall F-1207-2026 on
// peanut batch PN-2041-C surfaced undeclared MILK protein in a
// menu item that never advertised a dairy allergen.
//
// Chapter 2: the same DurableAgent moves from detection to RESPONSE.
// Under FDA recall protocol, the platform must notify every customer
// who purchased the affected SKU since the batch shipped. The agent:
//
//   1. Pulls the exposure window + affected buyers (step tool).
//   2. Drafts the customer notification email (step tool).
//   3. SUSPENDS on a hook and waits for Legal + PR sign-off on the
//      wording before any email goes out. Regulated health
//      notifications cannot be autosent.
//   4. On approval, dispatches the notification (step tool).
//   5. On rejection, records the block and stands down.
//
// The hook token is deterministic:
//   compliance-suspend:find_ALG01
// so the UI can resume without scraping the stream.
// ---------------------------------------------------------------------------

export const complianceSuspendHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
});

export type ComplianceSuspendPayload = {
  approved: boolean;
  reason?: string;
};

// Carry over from chapter 1: the finding that triggered this response.
const FINDING_ID = "find_ALG01";
const SKU = "sku-shrimp-pad-thai";
const RECALL_ID = "F-1207-2026";
const BATCH_ID = "PN-2041-C";

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function getExposedBuyers({
  sku,
  sinceIso,
}: {
  sku: string;
  sinceIso: string;
}) {
  "use step";
  // Deterministic roster so the demo reads the same every run. In
  // reality this would hit the orders service scoped to the exposure
  // window (when batch PN-2041-C started shipping).
  const buyers = [
    { customerId: "cust-4412", name: "Mara K.", lastOrderAt: "2026-04-13T18:12:00Z" },
    { customerId: "cust-9087", name: "Ben T.", lastOrderAt: "2026-04-13T19:47:00Z" },
    { customerId: "cust-2231", name: "Priya S.", lastOrderAt: "2026-04-13T20:03:00Z" },
    { customerId: "cust-7756", name: "Daniel R.", lastOrderAt: "2026-04-14T12:41:00Z" },
    { customerId: "cust-8834", name: "Lin Y.", lastOrderAt: "2026-04-14T13:18:00Z" },
    { customerId: "cust-5519", name: "Chris O.", lastOrderAt: "2026-04-14T19:22:00Z" },
    { customerId: "cust-6610", name: "Alex P.", lastOrderAt: "2026-04-14T20:55:00Z" },
    { customerId: "cust-1198", name: "Rita N.", lastOrderAt: "2026-04-15T11:02:00Z" },
  ];
  return {
    sku,
    sinceIso,
    count: buyers.length,
    buyers,
  };
}

async function draftCustomerNotice({
  findingId,
  sku,
  recallId,
  undeclaredAllergen,
  exposedCount,
}: {
  findingId: string;
  sku: string;
  recallId: string;
  undeclaredAllergen: string;
  exposedCount: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  const subject = `Important safety notice about your recent Shrimp Pad Thai order`;
  const body = [
    `We are writing to inform you of an FDA Class I recall (${recallId})`,
    `affecting a peanut ingredient batch used in Shrimp Pad Thai at`,
    `Bangkok Street. The batch was found to contain undeclared`,
    `${undeclaredAllergen} protein.`,
    ``,
    `If you or a household member has a ${undeclaredAllergen} allergy,`,
    `do not consume any remaining portion. A full refund has been`,
    `issued to your original payment method.`,
  ].join(" ");
  return {
    draftId: `draft_${stepId.slice(-6)}`,
    findingId,
    sku,
    recallId,
    undeclaredAllergen,
    recipients: exposedCount,
    subject,
    body,
    channel: "email",
  };
}

async function dispatchCustomerNotice({
  draftId,
  recipients,
}: {
  draftId: string;
  recipients: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    dispatched: true as const,
    dispatchId: `dsp_${stepId.slice(-6)}`,
    draftId,
    recipients,
    channel: "email",
    provider: "resend-transactional",
    sentAt: "2026-04-15T14:32:00Z",
  };
}

async function recordHoldOnNotice({
  draftId,
  reason,
}: {
  draftId: string;
  reason: string;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  return {
    heldId: `hold_${stepId.slice(-6)}`,
    draftId,
    status: "held_pending_revision" as const,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: SUSPEND on a hook until Legal + PR sign off.
// ---------------------------------------------------------------------------

async function requestLegalApproval({
  findingId,
  draftId,
  recipients,
  subject,
}: {
  findingId: string;
  draftId: string;
  recipients: number;
  subject: string;
}) {
  // Deterministic token keyed to the chapter-1 finding id.
  const token = `compliance-suspend:${findingId}`;
  const hook = complianceSuspendHook.create({ token });
  const decision = await hook;
  hook.dispose();

  return {
    findingId,
    draftId,
    recipients,
    subject,
    approved: decision.approved,
    reason: decision.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function complianceSuspendAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Compliance auditor agent for a food-delivery marketplace.",
      `Chapter 1 just closed: you filed finding ${FINDING_ID} (ALG-UNDECLARED,`,
      `critical) against ${SKU} at Bangkok Street after FDA recall ${RECALL_ID}`,
      `on peanut batch ${BATCH_ID} exposed undeclared milk protein.`,
      "Chapter 2 is customer notification. Do this, in order:",
      `1. Call getExposedBuyers with sku '${SKU}' and sinceIso '2026-04-12T00:00:00Z'`,
      "   to pull the exposure roster.",
      "2. Call draftCustomerNotice with the finding id, sku, recall id,",
      "   undeclared allergen 'milk', and the exposed count.",
      "3. Call requestLegalApproval to suspend and wait for Legal + PR sign-off on",
      "   the wording. Regulated health notices cannot auto-send.",
      "4. If approved, call dispatchCustomerNotice with the draftId and recipients.",
      "   If rejected, call recordHoldOnNotice with the draftId and the rejection reason.",
      "5. Reply with ONE short sentence describing the outcome (sent vs held).",
      "Call each tool exactly once. Never mention hooks, suspension, or internal mechanics.",
    ].join(" "),
    tools: {
      getExposedBuyers: {
        description:
          "List customers who ordered the affected SKU since the recalled batch started shipping.",
        inputSchema: z.object({
          sku: z.string(),
          sinceIso: z.string(),
        }),
        execute: getExposedBuyers,
      },
      draftCustomerNotice: {
        description:
          "Draft the FDA-compliant customer notification email for an undeclared-allergen recall.",
        inputSchema: z.object({
          findingId: z.string(),
          sku: z.string(),
          recallId: z.string(),
          undeclaredAllergen: z.string(),
          exposedCount: z.number(),
        }),
        execute: draftCustomerNotice,
      },
      requestLegalApproval: {
        description:
          "Suspend and ask Legal + PR to approve or reject the customer notification wording before dispatch.",
        inputSchema: z.object({
          findingId: z.string(),
          draftId: z.string(),
          recipients: z.number(),
          subject: z.string(),
        }),
        execute: requestLegalApproval,
      },
      dispatchCustomerNotice: {
        description:
          "Send the approved customer notification to every exposed buyer via the transactional email provider.",
        inputSchema: z.object({
          draftId: z.string(),
          recipients: z.number(),
        }),
        execute: dispatchCustomerNotice,
      },
      recordHoldOnNotice: {
        description:
          "Record that Legal rejected the draft; no email is sent and the draft is parked for revision.",
        inputSchema: z.object({
          draftId: z.string(),
          reason: z.string(),
        }),
        execute: recordHoldOnNotice,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content: [
          `Finding ${FINDING_ID} was just filed against ${SKU} at Bangkok Street`,
          `(FDA recall ${RECALL_ID}, undeclared milk in peanut batch ${BATCH_ID}).`,
          "Notify every buyer exposed since 2026-04-12 — but hold until Legal and PR sign off on the wording.",
        ].join(" "),
      },
    ],
    writable,
    maxSteps: 10,
  });
}
