import { PatternSlideLayout } from "../_components/pattern-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

const group = AGENT_GROUPS["agent-first"];

const PROMPT = `I just watched a demo of the Workflow SDK's Resumable Streams pattern
with DurableAgent and WorkflowChatTransport.

Ask me for the absolute path to my project, cd there, then find any
AI chat or streaming endpoint that would lose progress on a page
refresh or serverless timeout — and propose diffs that wrap the agent
in a "use workflow" function, stream through getWritable(), and
reconnect on the client via WorkflowChatTransport.

Context from the run I just watched:
npx workflow inspect run <run_id>

Docs: https://workflow-sdk.dev/docs/ai/resumable-streams`;

export default function AgentFirstPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow={group.eyebrow}
      patternName="Resumable streams"
      description="A durable agent whose chat stream survives page refreshes, network drops, and serverless timeouts. The client reconnects to the same run — no re-prompt, no lost tokens."
      apiPrimitive={group.pattern.apiPrimitive}
      docSection={group.pattern.docSection}
      docUrl={group.pattern.docUrl}
      prompt={PROMPT}
    />
  );
}
