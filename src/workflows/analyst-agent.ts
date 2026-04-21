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
import { approvalHook, managerInputHook } from "./_hooks";
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

async function inspectMenu() {
  "use step";
  return getMenu();
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
  const matchingOrders = getRecentOrders(60).filter((order) =>
    order.items.some((item) => item.sku === sku),
  );
  const evidence = matchingOrders.reduce(
    (acc, order) => {
      if (order.outcome === "delivered") acc.delivered += 1;
      if (order.outcome === "cancelled") acc.cancelled += 1;
      if (order.outcome === "refunded") acc.refunded += 1;
      acc.compensations += order.compensationsFired;
      acc.retries += order.retries;
      return acc;
    },
    {
      orders: matchingOrders.length,
      delivered: 0,
      failed: 0,
      cancelled: 0,
      refunded: 0,
      compensations: 0,
      retries: 0,
    },
  );
  evidence.failed = evidence.cancelled + evidence.refunded;
  const proposal = createProposal({ sku, patch, rationale });
  return { proposal, current, evidence };
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
  // Best-effort status update. The proposals Map may be empty after a
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
  // Hooks awaited at workflow level; no "use step".
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

async function requestMoreInfo(
  {
    question,
    reason,
  }: {
    question: string;
    reason: string;
  },
  { toolCallId }: { toolCallId: string },
) {
  // Hooks awaited at workflow level; no "use step".
  const token = `analyst-info:${toolCallId}`;
  const hook = managerInputHook.create({ token });

  const response = await hook;
  hook.dispose();

  return {
    question,
    reason,
    answer: response.answer,
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
      "You are the restaurant manager's AI assistant for a food delivery app.",
      "Never ask free-form clarifying questions in plain text.",
      "Every non-rollback turn must end in exactly one of two visible phone",
      "states: either a concrete menu proposal awaiting approve/reject, or",
      "a requestMoreInfo tool call awaiting manager input.",
      "Do not finish a non-rollback turn after only assistant text.",
      "Plain-text conclusions like 'no change needed', 'already optimized',",
      "or 'nothing to do' are forbidden unless they come AFTER a human",
      "approval/rejection result.",
      "All user-facing copy must fit on a projected phone UI. Keep proposal",
      "rationales to 10 words or fewer. Keep follow-up questions to 9 words",
      "or fewer. Keep final confirmations to 7 words or fewer.",
      "",
      "DEFAULT FLOW: for any investigative user message (e.g. 'what's",
      "going wrong', 'why are we refunding so much', 'should we hide",
      "anything'), drive this pipeline to completion in one turn:",
      "(1) call inspectMenu, readReport, and queryOrders before naming",
      "or analyzing a target SKU.",
      "(2) use inspectMenu results to exclude no-op actions. If an item",
      "is already hidden, do not analyze it as the recommended hide. Pick",
      "the next visible/actionable SKU instead.",
      "(3) pick ONE highest-impact menu change and call proposeMenuChange.",
      "The patch in proposeMenuChange MUST change at least one current menu",
      "field. Never propose a no-op patch. If your preferred action is",
      "already true (for example the item is already hidden), pick the next",
      "best SKU/action with a real patch instead.",
      "(4) immediately call requestApproval with that proposalId.",
      "(5) after the manager approves, call applyMenuChange with the",
      "SAME proposalId, sku, and patch you used in proposeMenuChange,",
      "then emit one short confirmation sentence of 7 words or fewer and stop.",
      "If the manager rejects, acknowledge in one sentence and stop.",
      "If the user request lacks enough detail to make a responsible menu",
      "proposal, call requestMoreInfo with one concise question and a",
      "brief reason. The question must be 9 words or fewer and the reason",
      "must be 10 words or fewer. After the manager answers, continue the same turn:",
      "investigate, propose exactly one menu change, and request approval.",
      "For 'I'm feeling lucky' or similar broad requests, use the available",
      "menu, report, and recent orders to choose the highest-impact proposal.",
      "Lucky MUST call inspectMenu first, then readReport and queryOrders,",
      "then ALWAYS call proposeMenuChange and requestApproval. Do not answer",
      "Lucky with prose only. Do not ask for more info on Lucky unless menu",
      "or order data is unavailable.",
      "",
      "ROLLBACK FLOW: if the manager asks you to roll back, undo, or",
      "revert one or more SKUs (e.g. 'roll back sushi-omakase' or",
      "'please roll back: burger-classic, pho-beef'), call",
      "rollbackMenuChange ONCE per sku the manager named, in order,",
      "then emit one short confirmation sentence per sku and stop.",
      "Do not re-investigate or propose new changes during a rollback.",
      "",
      "Be terse. Prefer fragments. Cite one number when justifying proposals.",
    ].join(" "),
    tools: {
      readReport: {
        description: "Read the current durable ops report entries.",
        inputSchema: z.object({}),
        execute: readReportTool,
      },
      inspectMenu: {
        description:
          "Read current menu state, including hidden, price, and availability. Call this before selecting a proposal SKU so already-applied actions are skipped.",
        inputSchema: z.object({}),
        execute: inspectMenu,
      },
      queryOrders: {
        description:
          "Query recent orders, optionally filtered by scenario. Pair with inspectMenu before choosing a target SKU.",
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
          "Queue a proposed menu change with a real field diff. Does NOT apply it; requires approval first. Inspect menu state first, then call this only for an actionable SKU. Returns the proposal plus the current menu item so the UI can show a diff. Do not call this with a patch that matches the current item state.",
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
          rationale: z.string().max(90),
        }),
        execute: proposeMenuChange,
      },
      requestApproval: {
        description:
          "Suspend and ask the human manager to approve or reject a proposal.",
        inputSchema: z.object({ proposalId: z.string() }),
        execute: requestApproval,
      },
      requestMoreInfo: {
        description:
          "Suspend and ask the manager for missing information required before a responsible proposal can be made.",
        inputSchema: z.object({
          question: z.string().max(70),
          reason: z.string().max(90),
        }),
        execute: requestMoreInfo,
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
          "Roll back the most recent change to this menu item. Call once per sku when the manager asks to undo previously applied changes.",
        inputSchema: z.object({ sku: z.string() }),
        execute: rollbackMenuChange,
      },
    },
  });

  const runFallback = async () => {
    await runMockAgentTurn({
      // Deterministic, derived from workflow input (the messages array
      // length is stable across replays of the same turn).
      idPrefix: `mock-analyst-turn-${messages.length}`,
      script: {
        preludeText: [
          "The AI Gateway is unreachable right now, so I'm running in",
          "offline-demo mode. Interactive proposals, approvals, and",
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
