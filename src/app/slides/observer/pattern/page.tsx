import { PatternSlideLayout } from "../../_components/pattern-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-observer"];

const INSPECT_PROMPT = `npx workflow inspect run <run_id>

Explain this run to me in detail. Walk me through how the autonomous
agent loop executed — what tool calls it made, how durable sleep()
worked between passes, and how the agent would resume from its last
tool call if the process restarted.`;

const COMPARE_PROMPT = `Compare my current code to what it might look like if I was using
the Workflow SDK's Autonomous Durable Agent pattern. Ask me for the
absolute path to my project, cd there, then find any cron job,
polling loop, or scheduled task that runs an LLM repeatedly — and
show me before/after diffs that replace it with a DurableAgent loop
inside a "use workflow" function with durable sleep() between passes.

API primitive: new DurableAgent({ tools, model })
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
      inspectPrompt={INSPECT_PROMPT}
      comparePrompt={COMPARE_PROMPT}
      realWorldExamples={[
        "Infrastructure monitoring",
        "Log anomaly detection",
        "Scheduled report generation",
        "Continuous compliance auditing",
      ]}
    />
  );
}
