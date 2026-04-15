import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

import {
  createProposal,
  getProposal,
  getRecentOrders,
  mutateMenu,
  readReport,
  rollbackMenuMutation,
  setProposalStatus,
  type MenuItem,
  type Scenario,
} from "@/lib/ops-data";
import { approvalHook } from "./_hooks";

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function readReportTool() {
  "use step";
  return readReport();
}

async function queryOrders({
  scenario,
  limit,
}: {
  scenario?: Scenario;
  limit: number;
}) {
  "use step";
  const all = getRecentOrders(limit * 3);
  const filtered = scenario ? all.filter((o) => o.scenario === scenario) : all;
  return filtered.slice(0, limit);
}

async function proposeMenuChange({
  sku,
  patch,
  rationale,
}: {
  sku: string;
  patch: Partial<MenuItem>;
  rationale: string;
}) {
  "use step";
  const proposal = createProposal({ sku, patch, rationale });
  return proposal;
}

async function applyMenuChange({ proposalId }: { proposalId: string }) {
  "use step";
  const proposal = getProposal(proposalId);
  if (!proposal) {
    return { applied: false, error: "proposal_not_found" } as const;
  }
  if (proposal.status !== "approved") {
    return { applied: false, error: "not_approved", status: proposal.status } as const;
  }
  const next = mutateMenu(proposal.sku, proposal.patch);
  if (!next) {
    return { applied: false, error: "sku_not_found" } as const;
  }
  setProposalStatus(proposalId, "applied");
  return { applied: true, menuItem: next } as const;
}

async function rollbackMenuChange({ sku }: { sku: string }) {
  "use step";
  const prev = rollbackMenuMutation(sku);
  if (!prev) {
    return { rolledBack: false, error: "no_history" } as const;
  }
  return { rolledBack: true, menuItem: prev } as const;
}

// ---------------------------------------------------------------------------
// Workflow-level tool: request human approval via hook
// ---------------------------------------------------------------------------

async function requestApproval({ proposalId }: { proposalId: string }) {
  // Hooks awaited at workflow level — no "use step".
  const token = `analyst-approval:${proposalId}`;
  console.log("[requestApproval] creating hook", { proposalId, token });
  const hook = approvalHook.create({ token });
  console.log("[requestApproval] hook created, token:", hook.token);

  const decision = await hook;
  console.log("[requestApproval] hook resolved", { proposalId, decision });
  hook.dispose();

  const status = decision.approved ? "approved" : "rejected";
  setProposalStatus(proposalId, status);

  return {
    proposalId,
    approved: decision.approved,
    reason: decision.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

export async function analystAgentWorkflow(messages: ChatMessage[]) {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are an ops analyst for a food delivery app.",
      "Use readReport and queryOrders to spot patterns,",
      "propose concrete menu changes (price adjustments, availability windows,",
      "or hiding items) via proposeMenuChange, always call requestApproval",
      "before applyMenuChange, and offer to rollbackMenuChange if the",
      "operator rejects or regrets the change.",
      "Be concise. Cite numbers from the report when justifying proposals.",
    ].join(" "),
    tools: {
      readReport: {
        description: "Read the current durable ops report entries.",
        inputSchema: z.object({}),
        execute: readReportTool,
      },
      queryOrders: {
        description: "Query recent orders, optionally filtered by scenario.",
        inputSchema: z.object({
          scenario: z
            .enum(["happy", "payment-retry", "slow-restaurant", "driver-refuses"])
            .optional(),
          limit: z.number().int().min(1).max(50),
        }),
        execute: queryOrders,
      },
      proposeMenuChange: {
        description:
          "Queue a proposed menu change. Does NOT apply it — requires approval first.",
        inputSchema: z.object({
          sku: z.string(),
          patch: z
            .object({
              name: z.string().optional(),
              price: z.number().optional(),
              availableAfter: z.string().optional(),
              availableBefore: z.string().optional(),
              hidden: z.boolean().optional(),
            })
            .passthrough(),
          rationale: z.string(),
        }),
        execute: proposeMenuChange,
      },
      requestApproval: {
        description:
          "Suspend and ask the human operator to approve or reject a proposal.",
        inputSchema: z.object({ proposalId: z.string() }),
        execute: requestApproval,
      },
      applyMenuChange: {
        description:
          "Apply an approved proposal to the live menu. Must be approved first.",
        inputSchema: z.object({ proposalId: z.string() }),
        execute: applyMenuChange,
      },
      rollbackMenuChange: {
        description: "Roll back the most recent change to this menu item.",
        inputSchema: z.object({ sku: z.string() }),
        execute: rollbackMenuChange,
      },
    },
  });

  const result = await agent.stream({
    messages,
    writable,
    collectUIMessages: true,
    maxSteps: 12,
  });

  return { messages: result.messages, uiMessages: result.uiMessages };
}
