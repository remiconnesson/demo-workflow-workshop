import { DurableAgent } from "@workflow/ai/agent";
import { getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

import {
  createProposal,
  getMenu,
  getRecentOrders,
  mutateMenu,
  readReport,
  rollbackMenuMutation,
  setProposalStatus,
  type MenuItem,
  type Scenario,
} from "@/lib/ops-data";
import { approvalHook } from "./_hooks";
import {
  isGatewayFailure,
  runMockAgentTurn,
  shouldForceMockAgent,
} from "./_shared/mock-agent";

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
  const current = getMenu().find((m) => m.sku === sku) ?? null;
  const proposal = createProposal({ sku, patch, rationale });
  return { proposal, current };
}

async function applyMenuChange({
  proposalId,
  sku,
  patch,
}: {
  proposalId: string;
  sku: string;
  patch: Partial<MenuItem>;
}) {
  "use step";
  // Apply directly from the agent-supplied payload so this step is resilient
  // to in-memory proposal state being lost (dev hot-reload, fresh worker).
  const next = mutateMenu(sku, patch);
  if (!next) {
    return { applied: false, error: "sku_not_found", sku } as const;
  }
  // Best-effort status update — the proposals Map may be empty after a
  // restart, in which case setProposalStatus is a no-op.
  setProposalStatus(proposalId, "applied");
  return { applied: true, menuItem: next, sku, proposalId } as const;
}

async function rollbackMenuChange({ sku }: { sku: string }) {
  "use step";
  const prev = rollbackMenuMutation(sku);
  if (!prev) {
    return { rolledBack: false, error: "no_history", sku } as const;
  }
  return { rolledBack: true, menuItem: prev, sku } as const;
}

// ---------------------------------------------------------------------------
// Workflow-level tool: request human approval via hook
// ---------------------------------------------------------------------------

async function requestApproval({ proposalId }: { proposalId: string }) {
  // Hooks awaited at workflow level — no "use step".
  const token = `analyst-approval:${proposalId}`;
  const hook = approvalHook.create({ token });

  const decision = await hook;
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
      "NEVER ask the operator clarifying questions — always act.",
      "",
      "DEFAULT FLOW — for any investigative user message (e.g. 'what's",
      "going wrong', 'why are we refunding so much', 'should we hide",
      "anything'), drive this pipeline to completion in one turn:",
      "(1) call readReport and queryOrders to spot patterns.",
      "(2) pick ONE highest-impact menu change and call proposeMenuChange.",
      "(3) immediately call requestApproval with that proposalId.",
      "(4) after the operator approves, call applyMenuChange with the",
      "SAME proposalId, sku, and patch you used in proposeMenuChange,",
      "then emit one short confirmation sentence and stop.",
      "If the operator rejects, acknowledge in one sentence and stop.",
      "",
      "ROLLBACK FLOW — if the operator asks you to roll back, undo, or",
      "revert one or more SKUs (e.g. 'roll back sushi-omakase' or",
      "'please roll back: burger-classic, pho-beef'), call",
      "rollbackMenuChange ONCE per sku the operator named, in order,",
      "then emit one short confirmation sentence per sku and stop.",
      "Do not re-investigate or propose new changes during a rollback.",
      "",
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
          "Queue a proposed menu change. Does NOT apply it — requires approval first. Returns the proposal plus the current menu item so the UI can show a diff.",
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
          "Apply an approved proposal to the live menu. Pass the same sku and patch returned from proposeMenuChange. Must be approved first.",
        inputSchema: z.object({
          proposalId: z.string(),
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
        }),
        execute: applyMenuChange,
      },
      rollbackMenuChange: {
        description:
          "Roll back the most recent change to this menu item. Call once per sku when the operator asks to undo previously applied changes.",
        inputSchema: z.object({ sku: z.string() }),
        execute: rollbackMenuChange,
      },
    },
  });

  const runFallback = async () => {
    await runMockAgentTurn({
      // Deterministic — derived from workflow input (the messages array
      // length is stable across replays of the same turn).
      idPrefix: `mock-analyst-turn-${messages.length}`,
      script: {
        preludeText: [
          "The AI Gateway is unreachable right now, so I'm running in",
          "offline-demo mode — interactive proposals, approvals, and",
          "rollbacks need the live model to drive them end-to-end.",
          "Restore the gateway connection and retry.",
        ].join(" "),
      },
    });
  };

  if (shouldForceMockAgent()) {
    await runFallback();
    return { messages: [] as unknown[], uiMessages: [] as unknown[] };
  }

  try {
    const result = await agent.stream({
      messages,
      writable,
      collectUIMessages: true,
      maxSteps: 12,
    });

    return { messages: result.messages, uiMessages: result.uiMessages };
  } catch (err) {
    if (!isGatewayFailure(err)) throw err;
    await runFallback();
    return { messages: [] as unknown[], uiMessages: [] as unknown[] };
  }
}
