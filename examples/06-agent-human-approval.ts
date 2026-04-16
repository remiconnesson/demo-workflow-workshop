import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getWritable } from "workflow";
import { z } from "zod";
import { convertToModelMessages, type UIMessage, type UIMessageChunk } from "ai";

// The pattern: defineHook + DurableAgent. The agent suspends mid-task
// to wait for human approval, then resumes exactly where it left off.

const approvalHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
});

// Step-backed tool — durable, replayed on crash
export async function analyzeData({ query }: { query: string }) {
  "use step";
  return { query, finding: "Price is 30% above market average", confidence: 0.92 };
}

// Workflow-level tool — suspends via hook (no "use step")
async function requestApproval({ proposalId, summary }: { proposalId: string; summary: string }) {
  const hook = approvalHook.create({ token: `approval:${proposalId}` });
  const decision = await hook;
  hook.dispose();
  return { approved: decision.approved, reason: decision.reason ?? null };
}

// Step-backed tool
export async function applyChange({ proposalId }: { proposalId: string }) {
  "use step";
  return { applied: true, proposalId };
}

export async function analystWorkflow(messages: UIMessage[]) {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: "Analyze data, propose changes, and request approval before applying them.",
    tools: {
      analyzeData: {
        description: "Analyze data for patterns.",
        inputSchema: z.object({ query: z.string() }),
        execute: analyzeData,
      },
      requestApproval: {
        description: "Suspend and ask a human to approve or reject.",
        inputSchema: z.object({ proposalId: z.string(), summary: z.string() }),
        execute: requestApproval,
      },
      applyChange: {
        description: "Apply an approved change.",
        inputSchema: z.object({ proposalId: z.string() }),
        execute: applyChange,
      },
    },
  });

  await agent.stream({
    messages: convertToModelMessages(messages),
    writable,
  });
}
