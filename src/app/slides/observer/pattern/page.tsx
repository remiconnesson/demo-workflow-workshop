import { PatternSlideLayout } from "../../_components/pattern-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

const PROMPT = `I just watched a demo of the Workflow SDK's Autonomous Durable Agent
pattern — a long-running agent loop that survives restarts and resumes
from its last tool call.

Ask me for the absolute path to my project, cd there, then find any
cron job, polling loop, or scheduled task that runs an LLM repeatedly —
and propose diffs that replace it with a DurableAgent loop inside a
"use workflow" function with durable sleep() between passes.

Context from the run I just watched:
npx workflow inspect run <run_id>

Docs: https://workflow-sdk.dev/docs/api-reference/workflow-ai/durable-agent`;

export default function AgentObserverPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow={group.eyebrow}
      patternName="Autonomous durable agents"
      description={<>An <code className="font-mono text-zinc-200">agent loop</code> that watches, analyzes, and reports on its own — surviving restarts and <code className="font-mono text-zinc-200">resuming</code> from its last <code className="font-mono text-zinc-200">tool call</code> without a supervisor.</>}
      apiPrimitive={group.pattern.apiPrimitive}
      docSection={group.pattern.docSection}
      docUrl={group.pattern.docUrl}
      prompt={PROMPT}
      realWorldExamples={[
        "Infrastructure monitoring",
        "Log anomaly detection",
        "Scheduled report generation",
        "Continuous compliance auditing",
      ]}
    />
  );
}
