import type { ScenarioGroupSlug } from "./scenario-groups";

export type AgentGroupSlug = "agent-first" | "agent-observer" | "agent-analyst";

/**
 * Unified slug type for every slide "group" the shared layouts accept.
 * Burst 2 pages should import this when a page type could belong to
 * either scenario-group or agent-group families.
 */
export type SlideGroupSlug = ScenarioGroupSlug | AgentGroupSlug;

export type AgentGroupPattern = {
  name: string;
  description: string;
  apiPrimitive: string;
  docUrl: string;
  docSection: string;
};

export type AgentGroup = {
  slug: AgentGroupSlug;
  eyebrow: string;
  pattern: AgentGroupPattern;
};

export const AGENT_GROUPS: Record<AgentGroupSlug, AgentGroup> = {
  "agent-first": {
    slug: "agent-first",
    eyebrow: "Durable agent · resumable stream",
    pattern: {
      name: "DurableAgent + WorkflowChatTransport",
      description:
        "A DurableAgent whose chat stream survives page refreshes, network drops, and serverless timeouts. The client reconnects to the same run — no re-prompt, no lost tokens.",
      apiPrimitive: "new DurableAgent({ tools }) + WorkflowChatTransport",
      docUrl: "workflow-sdk.dev/docs/ai/resumable-streams",
      docSection: "AI · Resumable Streams",
    },
  },
  "agent-observer": {
    slug: "agent-observer",
    eyebrow: "Durable agent · autonomous monitoring",
    pattern: {
      name: "DurableAgent",
      description:
        "A long-running agent loop that survives restarts, resumes from its last tool call, and reports back when it's done — no babysitting required.",
      apiPrimitive: "new DurableAgent({ tools, model })",
      docUrl: "workflow-sdk.dev/docs/api-reference/workflow-ai/durable-agent",
      docSection: "AI · Durable Agents",
    },
  },
  "agent-analyst": {
    slug: "agent-analyst",
    eyebrow: "Durable agent · human-in-the-loop",
    pattern: {
      name: "DurableAgent + defineHook",
      description:
        "Pair a durable agent loop with a hook so the agent can pause mid-task, hand control to a human for approval or input, and pick up exactly where it left off.",
      apiPrimitive: "defineHook() + new DurableAgent({ tools })",
      docUrl: "workflow-sdk.dev/docs/ai/human-in-the-loop",
      docSection: "AI · Human-in-the-loop",
    },
  },
};

/**
 * Type guard — returns true when the slug belongs to the agent-group family.
 * Shared layouts use this to branch between phone/order affordances and
 * agent-surface affordances without forking the template.
 */
export function isAgentGroupSlug(slug: string): slug is AgentGroupSlug {
  return slug === "agent-first" || slug === "agent-observer" || slug === "agent-analyst";
}
