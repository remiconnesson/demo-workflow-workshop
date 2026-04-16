import { FixSlideLayout } from "../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

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
          label: "Wrap the agent in a workflow",
          detail: '"use workflow" makes the run durable',
        },
        {
          label: "Stream through getWritable",
          detail: "the writable survives disconnects",
        },
        {
          label: "Client reconnects via run id",
          detail: "WorkflowChatTransport replays from last chunk",
        },
      ]}
      workflowFix={{
        code: WORKFLOW_CODE,
        tabs: [
          {
            filename: "route.ts",
            directive: "API route",
            directiveTone: "emerald",
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
            directive: "client",
            directiveTone: "zinc",
            code: `const activeRunId = localStorage.getItem("run-id")

const { messages, sendMessage } = useChat({
  resume: Boolean(activeRunId),
  transport: new WorkflowChatTransport({
    api: "/api/chat",
    onChatSendMessage: (res) => {
      const id = res.headers.get("x-workflow-run-id")
      if (id) localStorage.setItem("run-id", id)
    },
    onChatEnd: () => localStorage.removeItem("run-id"),
    prepareReconnectToStreamRequest: ({ ...rest }) => ({
      ...rest,
      api: \`/api/chat/\${activeRunId}/stream\`,
    }),
  }),
})`,
          },
        ],
      }}
    />
  );
}
