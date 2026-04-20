import { DurableAgent } from "@workflow/ai/agent";
import { getWritable, sleep } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";
import {
  isGatewayFailure,
  shouldForceMockAgent,
} from "./_shared/mock-agent";

// ---------------------------------------------------------------------------
// Fraud sentinel: a DurableAgent that monitors card charges for fraud.
//
// The LLM sees raw charge data and decides risk scores, freeze decisions,
// and batch summaries itself. Tools are the mechanism for the agent to
// report what it found — each tool emits a `data-fraud` event onto the
// workflow's writable stream so the UI can render in real-time.
// ---------------------------------------------------------------------------

export type FraudEvent =
  | {
      type: "charge-scored";
      index: number;
      card: string;
      risk: number;
      cleared: boolean;
      reason: string;
    }
  | {
      type: "batch-summary";
      message: string;
      citations: string[];
    }
  | {
      type: "freeze";
      card: string;
      reason: string;
    };

type Charge = {
  index: number;
  time: string;
  card: string;
  merchant: string;
  amount: string;
  country: string;
};

const CHARGES: Charge[] = [
  { index: 0, time: "14:32:01", card: "•••• 4242", merchant: "Apple Services", amount: "$12.99", country: "US" },
  { index: 1, time: "14:32:02", card: "•••• 1117", merchant: "Uber Trip", amount: "$24.40", country: "US" },
  { index: 2, time: "14:32:03", card: "•••• 9003", merchant: "Target", amount: "$87.20", country: "US" },
  { index: 3, time: "14:32:04", card: "•••• 5541", merchant: "Starbucks #4812", amount: "$6.80", country: "US" },
  { index: 4, time: "14:32:05", card: "•••• 2200", merchant: "Shell Oil", amount: "$48.10", country: "US" },
  { index: 5, time: "14:32:07", card: "•••• 3384", merchant: "DoorDash", amount: "$31.42", country: "US" },
  { index: 6, time: "14:32:08", card: "•••• 7719", merchant: "Netflix", amount: "$17.99", country: "US" },
  { index: 7, time: "14:32:10", card: "•••• 6106", merchant: "Amazon Prime", amount: "$139.00", country: "US" },
  { index: 8, time: "14:32:11", card: "•••• 0458", merchant: "Home Depot", amount: "$412.88", country: "US" },
  { index: 9, time: "14:32:12", card: "•••• 4242", merchant: "Apple Services", amount: "$0.99", country: "US" },
  { index: 10, time: "14:32:13", card: "•••• 8891", merchant: "Cryptonome-XYZ", amount: "$2,400.00", country: "RU" },
];

// ---------------------------------------------------------------------------
// Step-backed tools — each emits a data-fraud event to the stream
// ---------------------------------------------------------------------------

function writeFraudEvent(event: FraudEvent) {
  const writer = getWritable<UIMessageChunk>().getWriter();
  return writer
    .write({ type: "data-fraud", data: event } as unknown as UIMessageChunk)
    .finally(() => writer.releaseLock());
}

async function fetchChargeBatch() {
  "use step";
  return CHARGES;
}

async function reportCharge({
  index,
  card,
  risk,
  cleared,
  reason,
}: {
  index: number;
  card: string;
  risk: number;
  cleared: boolean;
  reason: string;
}) {
  "use step";
  const writer = getWritable<UIMessageChunk>().getWriter();
  try {
    await writer.write({
      type: "data-fraud",
      data: { type: "charge-scored", index, card, risk, cleared, reason },
    } as unknown as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
  return { recorded: true, index, card };
}

async function freezeAccount({
  card,
  reason,
}: {
  card: string;
  reason: string;
}) {
  "use step";
  const writer = getWritable<UIMessageChunk>().getWriter();
  try {
    await writer.write({
      type: "data-fraud",
      data: { type: "freeze", card, reason },
    } as unknown as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
  return { frozen: true, card };
}

async function batchSummary({
  message,
  citations,
}: {
  message: string;
  citations: string[];
}) {
  "use step";
  const writer = getWritable<UIMessageChunk>().getWriter();
  try {
    await writer.write({
      type: "data-fraud",
      data: { type: "batch-summary", message, citations },
    } as unknown as UIMessageChunk);
  } finally {
    writer.releaseLock();
  }
  return { summarized: true };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function fraudSentinelWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are a fraud sentinel monitoring live card charges in real-time.",
      "When a batch arrives, analyze EVERY charge yourself by looking at the",
      "merchant name, amount, country, and card number for anomalies.",
      "",
      "For EACH charge in the batch, call reportCharge with:",
      "- index: the charge's index from the batch",
      "- card: the card number",
      "- risk: your risk score from 0.0 to 1.0",
      "- cleared: true if safe, false if suspicious",
      "- reason: one short sentence explaining your assessment",
      "",
      "After scoring all charges, if any charge had risk > 0.7, call",
      "freezeAccount for that card with a reason.",
      "",
      "Finally, call batchSummary with a one-sentence overview and the",
      "card numbers you cited as citations array.",
      "",
      "Red flags: unusual countries (non-US), crypto merchants, amounts",
      "over $1000, velocity (same card twice in seconds), mismatched",
      "merchant categories. Most normal US purchases are low risk (0.02-0.15).",
      "",
      "Process charges in order by index. Be concise in reasons.",
    ].join("\n"),
    tools: {
      fetchChargeBatch: {
        description: "Fetch the next window of card charges to analyze. Returns an array of charge objects with time, card, merchant, amount, and country.",
        inputSchema: z.object({}),
        execute: fetchChargeBatch,
      },
      reportCharge: {
        description: "Report your risk assessment for a single charge. Call this once per charge in the batch, in order.",
        inputSchema: z.object({
          index: z.number().int(),
          card: z.string(),
          risk: z.number().min(0).max(1),
          cleared: z.boolean(),
          reason: z.string(),
        }),
        execute: reportCharge,
      },
      freezeAccount: {
        description: "Freeze a card account that you've flagged as high-risk. Only call after reporting the charge via reportCharge.",
        inputSchema: z.object({
          card: z.string(),
          reason: z.string(),
        }),
        execute: freezeAccount,
      },
      batchSummary: {
        description: "Emit a summary of the batch after all charges are scored. Include the key finding and cite relevant card numbers.",
        inputSchema: z.object({
          message: z.string(),
          citations: z.array(z.string()),
        }),
        execute: batchSummary,
      },
    },
  });

  while (true) {
    if (shouldForceMockAgent()) {
      const charges = await fetchChargeBatch();
      for (const c of charges) {
        const isFraud = c.country !== "US" || c.merchant.includes("Cryptonome");
        await writeFraudEvent({
          type: "charge-scored",
          index: c.index,
          card: c.card,
          risk: isFraud ? 0.93 : Math.random() * 0.15,
          cleared: !isFraud,
          reason: isFraud ? "Foreign crypto merchant, high amount" : "Normal domestic purchase",
        });
      }
      await writeFraudEvent({
        type: "freeze",
        card: "•••• 8891",
        reason: "First charge at Cryptonome-XYZ, RU merchant, $2,400",
      });
      await writeFraudEvent({
        type: "batch-summary",
        message: "10 charges cleared, 1 frozen: •••• 8891 flagged for foreign crypto transaction.",
        citations: ["•••• 8891", "Cryptonome-XYZ"],
      });
    } else {
      try {
        await agent.stream({
          messages: [
            {
              role: "user",
              content: "New batch ready. Fetch charges and analyze each one for fraud.",
            },
          ],
          writable,
          maxSteps: 20,
        });
      } catch (err) {
        if (!isGatewayFailure(err)) throw err;
        // On gateway failure, skip this loop iteration
      }
    }

    await sleep("10s");
  }
}
