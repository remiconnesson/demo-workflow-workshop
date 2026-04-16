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
    messages: await convertToModelMessages(messages),
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
        code: WORKFLOW_CODE,
        tabs: [
          {
            filename: "route.ts",
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
