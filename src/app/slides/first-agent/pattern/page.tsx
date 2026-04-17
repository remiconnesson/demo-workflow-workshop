import { PatternSlideLayout } from "../../_components/pattern-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-first"];

const INSPECT_PROMPT = `npx workflow inspect run <run_id>

Explain this run to me in detail. Walk me through how the DurableAgent
maintained its chat stream across the workflow lifecycle — what tool
calls happened, how the stream was persisted, and what would happen
if the page refreshed mid-conversation.`;

const COMPARE_PROMPT = `Compare my current code to what it might look like if I was using
the Workflow SDK's Resumable Streams pattern. Ask me for the absolute
path to my project, cd there, then find any AI chat or streaming
endpoint that would lose progress on a page refresh or serverless
timeout — and show me before/after diffs that wrap the agent in a
"use workflow" function, stream through getWritable(), and reconnect
on the client via WorkflowChatTransport.

API primitive: new DurableAgent({ tools }) + WorkflowChatTransport
Docs: https://workflow-sdk.dev/docs/ai/resumable-streams`;

export default function AgentFirstPatternSlide() {
  return (
    <PatternSlideLayout
      eyebrow={group.eyebrow}
      patternName="Resumable streams"
      description={<>A <code className="font-mono text-zinc-200">DurableAgent</code> whose chat <code className="font-mono text-zinc-200">stream</code> survives page refreshes, network drops, and serverless timeouts. The client <code className="font-mono text-zinc-200">reconnects</code> to the same <code className="font-mono text-zinc-200">run</code> — no re-prompt, no lost tokens.</>}
      apiPrimitive={group.pattern.apiPrimitive}
      docSection={group.pattern.docSection}
      docUrl={group.pattern.docUrl}
      inspectPrompt={INSPECT_PROMPT}
      comparePrompt={COMPARE_PROMPT}
      realWorldExamples={[
        "AI customer support chats",
        "Long-running code generation",
        "Research assistants",
        "AI-powered form wizards",
      ]}
    />
  );
}
