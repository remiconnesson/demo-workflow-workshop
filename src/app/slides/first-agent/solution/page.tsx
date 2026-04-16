import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-first"];

const WORKFLOW_CODE = `export async function supportAgent(messages) {
  "use workflow"

  const writable = getWritable()

  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { fetchOrderDetails },
  })

  await agent.stream({
    messages: convertToModelMessages(messages),
    writable,
  })
}`;

export default function AgentFirstFixSlide() {
  return (
    <FixSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="An agent that survives F5."
      marker="span"
      filename="supportAgent.ts"
      statusTone="emerald"
      statusLabel="resumable stream"
      steps={[
        {
          label: <>Wrap the agent in a <code className="font-mono">workflow</code></>,
          detail: <><span className="text-zinc-300">&quot;use workflow&quot;</span> makes the run durable</>,
        },
        {
          label: <>Stream through <code className="font-mono">getWritable</code></>,
          detail: <>the <span className="text-zinc-300">writable</span> survives disconnects</>,
        },
        {
          label: <>Client reconnects via <code className="font-mono">run id</code></>,
          detail: <><span className="text-zinc-300">WorkflowChatTransport</span> replays from last chunk</>,
        },
      ]}
      workflowFix={{
        highlightLines: {
          2: "Makes this entire agent run [durable](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — survives **server restarts** and deploys",
          4: "A [durable output stream](https://workflow-sdk.dev/docs/foundations/streaming) — the client can [reconnect](https://workflow-sdk.dev/docs/ai/resumable-streams) and pick up mid-sentence",
          6: "Tools marked [\"use step\"](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) become **durable** — their results replay from the event log on resume",
          13: "",
        },
        code: WORKFLOW_CODE,
        tabs: [
          {
            filename: "route.ts",
            highlightLines: {
              3: "[start()](https://workflow-sdk.dev/docs/api-reference/workflow-api/start) kicks off the workflow and returns a handle with a [readable stream](https://workflow-sdk.dev/docs/foundations/streaming) + **run ID**",
              6: "Pipe the [durable stream](https://workflow-sdk.dev/docs/foundations/streaming) directly into the HTTP response",
              8: "Client stores this **run ID** to [reconnect](https://workflow-sdk.dev/docs/ai/resumable-streams) to the **exact same run** after refresh",
            },
            code: `export async function POST(req) {
  const { messages } = await req.json()
  const run = await start(supportAgent, [messages])

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  })
}`,
          },
          {
            filename: "page.tsx",
            highlightLines: {
              2: "On page load, check if there's an **active run** to [reconnect](https://workflow-sdk.dev/docs/ai/resumable-streams) to",
              3: "Handles [reconnection](https://workflow-sdk.dev/docs/api-reference/workflow-ai/workflow-chat-transport) — stores the run ID, [resumes the stream](https://workflow-sdk.dev/docs/ai/resumable-streams) on refresh",
              10: "On reconnect, redirect to the [run-specific stream endpoint](https://workflow-sdk.dev/docs/ai/resumable-streams)",
            },
            code: `const { messages, sendMessage } = useChat({
  resume: Boolean(localStorage.getItem("run-id")),
  transport: new WorkflowChatTransport({
    api: "/api/chat",
    onChatSendMessage: (res) => {
      const id = res.headers.get("x-workflow-run-id")
      if (id) localStorage.setItem("run-id", id)
    },
    onChatEnd: () => localStorage.removeItem("run-id"),
    prepareReconnectToStreamRequest: ({ ...rest }) => {
      const runId = localStorage.getItem("run-id")
      return { ...rest, api: \`/api/chat/\${runId}/stream\` }
    },
  }),
})`,
          },
        ],
      }}
    />
  );
}
