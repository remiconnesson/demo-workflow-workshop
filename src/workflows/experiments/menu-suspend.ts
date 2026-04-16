import { DurableAgent } from "@workflow/ai/agent";
import { defineHook, getStepMetadata, getWritable } from "workflow";
import { z } from "zod";
import type { UIMessageChunk } from "ai";

// ---------------------------------------------------------------------------
// Chapter 2 of the menu-retry story.
//
// The retry demo (menu-retry) showed the price-oracle flake and the agent
// proposing a price tweak for the Classic Burger in zip 94110. The draft
// lives in a queued menu proposal — it has NOT hit the live menu.
//
// Chapter 2: before the tweak ships, the agent runs a margin-impact check.
// The proposed price ($13.12) crosses the platform's +5% price-change
// guardrail, so the agent SUSPENDS on a hook and waits for the regional
// manager to approve. Only on approval does it publish to the live menu.
// On reject, the draft is shelved. Amber "WAITING" is the headline state.
// ---------------------------------------------------------------------------

export const menuSuspendHook = defineHook({
  schema: z.object({
    approved: z.boolean(),
    reason: z.string().optional(),
  }),
});

export type MenuSuspendPayload = { approved: boolean; reason?: string };

// ---------------------------------------------------------------------------
// Step-backed tools
// ---------------------------------------------------------------------------

async function loadProposedTweak({ sku }: { sku: string }) {
  "use step";
  // Seeded proposal that would have been emitted by menu-retry. Deterministic
  // so the two demos line up on stage.
  return {
    sku,
    name: "Classic Burger",
    zip: "94110",
    currentPrice: 12.5,
    competitorMedian: 13.75,
    proposedPrice: 13.12,
    proposalId: `tweak_${sku}_chapter2`,
    status: "queued" as const,
  };
}

async function computeMarginImpact({
  sku,
  currentPrice,
  proposedPrice,
}: {
  sku: string;
  currentPrice: number;
  proposedPrice: number;
}) {
  "use step";
  const { stepId } = getStepMetadata();
  const delta = proposedPrice - currentPrice;
  const deltaPct = (delta / currentPrice) * 100;
  // Platform guardrail: any price change >5% needs regional sign-off.
  const guardrailPct = 5;
  const crossesGuardrail = Math.abs(deltaPct) > guardrailPct;
  // Rough projected weekly margin lift assuming 420 units/wk through zip.
  const projectedWeeklyLift = Math.round(delta * 420 * 100) / 100;
  return {
    sku,
    currentPrice,
    proposedPrice,
    deltaPct: Math.round(deltaPct * 100) / 100,
    guardrailPct,
    crossesGuardrail,
    projectedWeeklyLift,
    stepId,
    provider: "margin-guardrail-v2",
  };
}

async function publishToLiveMenu({
  sku,
  proposalId,
  proposedPrice,
}: {
  sku: string;
  proposalId: string;
  proposedPrice: number;
}) {
  "use step";
  return {
    sku,
    proposalId,
    livePrice: proposedPrice,
    publishedAt: new Date().toISOString(),
    status: "live" as const,
  };
}

async function shelveProposal({
  sku,
  proposalId,
  reason,
}: {
  sku: string;
  proposalId: string;
  reason: string;
}) {
  "use step";
  return {
    sku,
    proposalId,
    reason,
    status: "shelved" as const,
  };
}

// ---------------------------------------------------------------------------
// Workflow-level tool: SUSPEND on a hook until the regional manager answers.
// ---------------------------------------------------------------------------

async function requestRegionalApproval({
  sku,
  proposedPrice,
  deltaPct,
  projectedWeeklyLift,
}: {
  sku: string;
  proposedPrice: number;
  deltaPct: number;
  projectedWeeklyLift: number;
}) {
  // Deterministic token so the UI can resume without scraping the stream.
  const token = `menu-suspend:${sku}`;
  const hook = menuSuspendHook.create({ token });
  const decision = await hook;
  hook.dispose();

  return {
    sku,
    proposedPrice,
    deltaPct,
    projectedWeeklyLift,
    approved: decision.approved,
    reason: decision.reason ?? null,
    token,
  };
}

// ---------------------------------------------------------------------------
// Workflow
// ---------------------------------------------------------------------------

export async function menuSuspendAgentWorkflow() {
  "use workflow";

  const writable = getWritable<UIMessageChunk>();

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    instructions: [
      "You are the Menu Curator agent, continuing from a prior run.",
      "A price tweak has already been queued for the Classic Burger",
      "(sku=burger-classic) in zip 94110. Your job is to ship it safely.",
      "Your exact procedure:",
      "(1) loadProposedTweak for sku=burger-classic to read the queued draft.",
      "(2) computeMarginImpact using the current and proposed price.",
      "(3) Because the platform guardrail requires regional sign-off on any",
      "    price change greater than 5%, call requestRegionalApproval with",
      "    the sku, proposed price, delta percentage, and projected weekly",
      "    margin lift returned from computeMarginImpact.",
      "(4) If the regional manager approves, call publishToLiveMenu with",
      "    the sku, proposalId, and proposed price.",
      "(5) If the regional manager rejects, call shelveProposal with the",
      "    sku, proposalId, and a short reason derived from their note.",
      "Call each tool exactly once. After the flow completes, reply with",
      "ONE short sentence describing the outcome. Never mention suspension,",
      "hooks, or internal mechanics — the durability layer is invisible.",
    ].join(" "),
    tools: {
      loadProposedTweak: {
        description:
          "Load the queued price-tweak proposal for a SKU from the menu draft store.",
        inputSchema: z.object({ sku: z.string() }),
        execute: loadProposedTweak,
      },
      computeMarginImpact: {
        description:
          "Run the proposed price through the margin-guardrail service. Returns delta percentage, guardrail, and projected weekly margin lift.",
        inputSchema: z.object({
          sku: z.string(),
          currentPrice: z.number(),
          proposedPrice: z.number(),
        }),
        execute: computeMarginImpact,
      },
      requestRegionalApproval: {
        description:
          "Suspend the workflow and ask the regional manager to approve or reject this price change.",
        inputSchema: z.object({
          sku: z.string(),
          proposedPrice: z.number(),
          deltaPct: z.number(),
          projectedWeeklyLift: z.number(),
        }),
        execute: requestRegionalApproval,
      },
      publishToLiveMenu: {
        description:
          "Publish the approved price to the live menu. Only call after approval.",
        inputSchema: z.object({
          sku: z.string(),
          proposalId: z.string(),
          proposedPrice: z.number(),
        }),
        execute: publishToLiveMenu,
      },
      shelveProposal: {
        description:
          "Shelve a rejected proposal so it does not hit the live menu.",
        inputSchema: z.object({
          sku: z.string(),
          proposalId: z.string(),
          reason: z.string(),
        }),
        execute: shelveProposal,
      },
    },
  });

  await agent.stream({
    messages: [
      {
        role: "user",
        content:
          "Ship the queued Classic Burger price tweak for zip 94110, respecting the regional price-change guardrail.",
      },
    ],
    writable,
    maxSteps: 10,
  });
}
