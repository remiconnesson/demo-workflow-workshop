import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

const PROMPT = `I just watched a demo of the Workflow SDK's Human-in-the-Loop pattern
— a durable agent that suspends mid-task for operator approval and
resumes exactly where it left off.

Ask me for the absolute path to my project, cd there, then find any
agent or automation that makes consequential decisions without human
review — and propose diffs that add a defineHook() approval gate the
agent can await, pausing the workflow until a human responds.

Context from the run I just watched:
npx workflow inspect run <run_id>

Docs: https://workflow-sdk.dev/docs/ai/human-in-the-loop`;

export default function AgentAnalystPatternSlide() {
  const group = AGENT_GROUPS["agent-analyst"];
  return (
    <PatternSlideLayout
      eyebrow={group.eyebrow}
      patternName="Human-in-the-loop agents"
      description="A durable agent loop that can pause mid-task for operator approval and resume exactly where it left off — no retries, no lost state."
      apiPrimitive={group.pattern.apiPrimitive}
      docSection={group.pattern.docSection}
      docUrl={group.pattern.docUrl}
      prompt={PROMPT}
    />
  );
}
