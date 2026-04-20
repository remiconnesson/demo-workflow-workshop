import { FixSlideLayout } from "../../_components/fix-slide-layout";
import { AGENT_GROUPS } from "../../_data/agent-groups";

const group = AGENT_GROUPS["agent-first"];

export default function AgentFirstFixSlide() {
  return (
    <FixSlideLayout
      slide={group.slug}
      eyebrow={group.eyebrow}
      headline="An agent that survives F5."
      marker="span"
      filename="supportAgent.ts"
      statusTone="emerald"
      statusLabel="stream · resume"
      steps={[
        {
          label: <>Wrap it in a <code className="font-mono">workflow</code></>,
          detail: <><span className="text-zinc-300">&quot;use workflow&quot;</span> survives F5</>,
        },
        {
          label: <>Upgrade to <code className="font-mono">DurableAgent</code></>,
          detail: <>LLM calls stream through a <span className="text-zinc-300">writable</span></>,
        },
        {
          label: <>Mark the tool <code className="font-mono">&quot;use step&quot;</code></>,
          detail: <>each tool call replays from the event log</>,
        },
      ]}
      workflowFix={{
        progression: [
          {
            code: `async function fetchOrderDetails({ orderId }) {
  return db.orders.findById(orderId)
}

export async function supportAgent(messages) {
  // plain agent — response dies on F5
  const agent = new Agent({
    model: "anthropic/claude-haiku-4.5",
    tools: { fetchOrderDetails },
  })

  return agent.stream({
    messages: convertToModelMessages(messages),
  })
}`,
          },
          {
            highlightLines: {
              7: "Makes this entire agent run [durable](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — survives **server restarts** and deploys",
            },
            code: `async function fetchOrderDetails({ orderId }) {
  return db.orders.findById(orderId)
}

export async function supportAgent(messages) {
  // makes the entire run durable — survives F5
  "use workflow"

  const agent = new Agent({
    model: "anthropic/claude-haiku-4.5",
    tools: { fetchOrderDetails },
  })

  return agent.stream({
    messages: convertToModelMessages(messages),
  })
}`,
          },
          {
            highlightLines: {
              10: "A [durable output stream](https://workflow-sdk.dev/docs/foundations/streaming) — the client can [reconnect](https://workflow-sdk.dev/docs/ai/resumable-streams) mid-sentence",
              13: "Swap in [DurableAgent](https://workflow-sdk.dev/docs/api-reference/workflow-ai/durable-agent) — every LLM call is now a **durable step**, replayed on resume",
              20: "",
            },
            code: `async function fetchOrderDetails({ orderId }) {
  return db.orders.findById(orderId)
}

export async function supportAgent(messages) {
  "use workflow"

  // durable output stream — client reconnects mid-sentence
  const writable = getWritable()

  // every LLM call becomes a durable step
  const agent = new DurableAgent({
    model: "anthropic/claude-haiku-4.5",
    tools: { fetchOrderDetails },
  })

  await agent.stream({
    messages: convertToModelMessages(messages),
    writable,
  })
}`,
          },
          {
            highlightLines: {
              3: "Tool call becomes a [durable step](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — its result is **replayed from the event log** on resume, never refetched",
            },
            code: `async function fetchOrderDetails({ orderId }) {
  // tool call becomes a durable step — replays on resume
  "use step"
  return db.orders.findById(orderId)
}

export async function supportAgent(messages) {
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
}`,
          },
        ],
        tabs: [
          {
            filename: "route.ts",
            tone: "sky",
            progression: [
              {
                code: `export async function POST(req) {
  const { messages } = await req.json()
  // no durability — refresh kills the response
  const result = await supportAgent(messages)
  return new Response(result.stream)
}`,
              },
              {
                highlightLines: {
                  4: "[start()](https://workflow-sdk.dev/docs/api-reference/workflow-api/start) kicks off a durable run and returns a handle with a [readable stream](https://workflow-sdk.dev/docs/foundations/streaming) + **run ID**",
                },
                code: `export async function POST(req) {
  const { messages } = await req.json()
  // start() launches a durable run, returns a handle
  const run = await start(supportAgent, [messages])
  return new Response(run.readable)
}`,
              },
              {
                highlightLines: {
                  6: "Pipe the [durable stream](https://workflow-sdk.dev/docs/foundations/streaming) directly into the HTTP response",
                  7: "",
                  8: "",
                },
                code: `export async function POST(req) {
  const { messages } = await req.json()
  const run = await start(supportAgent, [messages])

  // pipe the durable stream into the HTTP response
  return createUIMessageStreamResponse({
    stream: run.readable,
  })
}`,
              },
              {
                highlightLines: {
                  8: "Client stores this **run ID** to [reconnect](https://workflow-sdk.dev/docs/ai/resumable-streams) to the **exact same run** after refresh",
                  9: "",
                  10: "",
                },
                code: `export async function POST(req) {
  const { messages } = await req.json()
  const run = await start(supportAgent, [messages])

  return createUIMessageStreamResponse({
    stream: run.readable,
    // client stores this to reconnect after F5
    headers: {
      "x-workflow-run-id": run.runId,
    },
  })
}`,
              },
            ],
          },
          {
            filename: "page.tsx",
            tone: "emerald",
            progression: [
              {
                code: `// plain chat — refresh drops the reply mid-sentence
const { messages, sendMessage } = useChat({
  api: "/api/chat",
})`,
              },
              {
                highlightLines: {
                  3: "Handles [reconnection](https://workflow-sdk.dev/docs/api-reference/workflow-ai/workflow-chat-transport) — stores the run ID on every message",
                  5: "",
                  6: "",
                  7: "",
                  8: "",
                  9: "",
                },
                code: `const { messages, sendMessage } = useChat({
  // stores the run id so we can reconnect later
  transport: new WorkflowChatTransport({
    api: "/api/chat",
    onChatSendMessage: (res) => {
      const id = res.headers.get("x-workflow-run-id")
      if (id) localStorage.setItem("run-id", id)
    },
    onChatEnd: () => localStorage.removeItem("run-id"),
  }),
})`,
              },
              {
                highlightLines: {
                  3: "On page load, check if there's an **active run** to [reconnect](https://workflow-sdk.dev/docs/ai/resumable-streams) to",
                },
                code: `const { messages, sendMessage } = useChat({
  // on load, reconnect if a run is already in flight
  resume: Boolean(localStorage.getItem("run-id")),
  transport: new WorkflowChatTransport({
    api: "/api/chat",
    onChatSendMessage: (res) => {
      const id = res.headers.get("x-workflow-run-id")
      if (id) localStorage.setItem("run-id", id)
    },
    onChatEnd: () => localStorage.removeItem("run-id"),
  }),
})`,
              },
              {
                highlightLines: {
                  11: "On reconnect, redirect to the [run-specific stream endpoint](https://workflow-sdk.dev/docs/ai/resumable-streams)",
                  12: "",
                  13: "",
                  14: "",
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
    // on reconnect, hit the run-specific stream endpoint
    prepareReconnectToStreamRequest: ({ ...rest }) => {
      const runId = localStorage.getItem("run-id")
      return { ...rest, api: \`/api/chat/\${runId}/stream\` }
    },
  }),
})`,
              },
            ],
          },
        ],
      }}
    />
  );
}
