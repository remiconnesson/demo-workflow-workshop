import { PatternSlideLayout } from "../../_components/pattern-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const INSPECT_PROMPT = `npx workflow inspect run <run_id>

Explain this run to me in detail. Walk me through how the durable
agent paused for operator approval — what state it was in when it
suspended, how the hook delivered the human's response, and how
the agent resumed exactly where it left off.`;

const COMPARE_PROMPT = `Compare my current code to what it might look like if I was using
the Workflow SDK's Human-in-the-Loop Agent pattern. Ask me for the
absolute path to my project, cd there, then find any agent or
automation that makes consequential decisions without human review —
and show me before/after diffs that add a defineHook() approval gate
the agent can await, pausing the workflow until a human responds.

API primitive: defineHook() + new DurableAgent({ tools })
Docs: https://workflow-sdk.dev/docs/ai/human-in-the-loop`;

export default function AgentAnalystPatternSlide() {
  const group = AGENT_GROUPS["agent-analyst"];
  return (
    <PatternSlideLayout
      eyebrow={group.eyebrow}
      patternName="Human-in-the-loop agents"
      description={<>A <code className="font-mono text-zinc-200">DurableAgent</code> loop that can <code className="font-mono text-zinc-200">pause</code> mid-task for operator <code className="font-mono text-zinc-200">approval</code> and <code className="font-mono text-zinc-200">resume</code> exactly where it left off — no retries, no lost state.</>}
      apiPrimitive={group.pattern.apiPrimitive}
      docSection={group.pattern.docSection}
      docUrl={group.pattern.docUrl}
      inspectPrompt={INSPECT_PROMPT}
      comparePrompt={COMPARE_PROMPT}
      realWorldExamples={[
        "PR merge approvals",
        "Financial trade authorization",
        "Content moderation",
        "Deployment sign-offs",
      ]}
    />
  );
}
