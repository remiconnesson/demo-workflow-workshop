// Analyst agent — proposes a menu change, suspends for human approval,
// then applies or rolls back based on the verdict.
//
// Mirrors: /slides/analyst/solution

import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getWritable } from "workflow";
import { z } from "zod";
import { convertToModelMessages, type UIMessage, type UIMessageChunk } from "ai";

const approvalHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
});

export async function queryOrders({ window }: { window: string }) {
  "use step";
  return { window, sampleSize: 1200, topMissingItem: "truffle fries" };
}

export async function proposeMenuChange({ item }: { item: string }) {
  "use step";
  return { proposalId: `prop_${item}`, item, action: "add" as const };
}

export async function applyMenuChange({ proposalId }: { proposalId: string }) {
  "use step";
  return { applied: true, proposalId };
}

export async function rollbackMenuChange({
  proposalId,
}: {
  proposalId: string;
}) {
  "use step";
  return { rolledBack: true, proposalId };
}

// Workflow-level tool — suspends via hook (no "use step")
async function requestApproval({ proposalId }: { proposalId: string }) {
  const hook = approvalHook.create({
    token: `analyst-approval:${proposalId}`,
  });
  const decision = await hook;
  hook.dispose();
  return { approved: decision.approved, reason: decision.reason ?? null };
}

export async function analystAgentWorkflow(messages: UIMessage[]) {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions:
      "Query orders, propose menu changes, and request approval before applying.",
    tools: {
      queryOrders: {
        description: "Query order history for a time window.",
        inputSchema: z.object({ window: z.string() }),
        execute: queryOrders,
      },
      proposeMenuChange: {
        description: "Draft a proposed menu change.",
        inputSchema: z.object({ item: z.string() }),
        execute: proposeMenuChange,
      },
      requestApproval: {
        description: "Suspend and ask a human to approve or reject.",
        inputSchema: z.object({ proposalId: z.string() }),
        execute: requestApproval,
      },
      applyMenuChange: {
        description: "Apply an approved proposal.",
        inputSchema: z.object({ proposalId: z.string() }),
        execute: applyMenuChange,
      },
      rollbackMenuChange: {
        description: "Rollback a rejected proposal.",
        inputSchema: z.object({ proposalId: z.string() }),
        execute: rollbackMenuChange,
      },
    },
  });

  await agent.stream({
    messages: await convertToModelMessages(messages),
    writable,
    maxSteps: 12,
  });
}
