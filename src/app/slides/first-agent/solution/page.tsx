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
      statusLabel="resumable stream"
      steps={[
        {
          label: <>Wrap the function in a <code className="font-mono">workflow</code></>,
          detail: <><span className="text-zinc-300">&quot;use workflow&quot;</span> — the run survives F5</>,
        },
        {
          label: <>Upgrade to <code className="font-mono">DurableAgent</code></>,
          detail: <>drop-in — LLM calls become <span className="text-zinc-300">durable steps</span></>,
        },
        {
          label: <>Pipe through a <code className="font-mono">writable</code></>,
          detail: <>client <span className="text-zinc-300">reconnects mid-sentence</span></>,
        },
        {
          label: <>Mark the tool <code className="font-mono">&quot;use step&quot;</code></>,
          detail: <>each tool call replays from the event log</>,
        },
      ]}
      workflowFix={{
        progression: [
          {
            code: `import { Agent, convertToModelMessages } from "ai"

async function fetchOrderDetails({ orderId }) {
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
              9: "Makes this entire agent run [durable](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — survives **server restarts** and deploys",
            },
            code: `import { Agent, convertToModelMessages } from "ai"

async function fetchOrderDetails({ orderId }) {
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
              2: "Import the [DurableAgent](https://workflow-sdk.dev/docs/api-reference/workflow-ai/durable-agent) class — a **drop-in** for `Agent` that makes every LLM call a durable step",
              13: "Swap `new Agent(...)` → `new DurableAgent(...)` — no other changes yet",
            },
            code: `import { convertToModelMessages } from "ai"
import { DurableAgent } from "@workflow/ai/agent"

async function fetchOrderDetails({ orderId }) {
  return db.orders.findById(orderId)
}

export async function supportAgent(messages) {
  "use workflow"

  // drop-in replacement — every LLM call is now a durable step,
  // replayed from the event log on resume
  const agent = new DurableAgent({
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
              3: "Import [getWritable](https://workflow-sdk.dev/docs/foundations/streaming) — a durable output stream scoped to this run",
              12: "Allocate the writable — chunks persist so a refreshed client can **reconnect mid-sentence**",
              22: "Pipe the agent's LLM tokens into the durable writable",
            },
            code: `import { convertToModelMessages } from "ai"
import { DurableAgent } from "@workflow/ai/agent"
import { getWritable } from "workflow"

async function fetchOrderDetails({ orderId }) {
  return db.orders.findById(orderId)
}

export async function supportAgent(messages) {
  "use workflow"

  // durable output stream — client can reconnect after F5
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
          {
            highlightLines: {
              7: "Tool call becomes a [durable step](https://workflow-sdk.dev/docs/foundations/workflows-and-steps) — its result is **replayed from the event log** on resume, never refetched",
            },
            code: `import { convertToModelMessages } from "ai"
import { DurableAgent } from "@workflow/ai/agent"
import { getWritable } from "workflow"

async function fetchOrderDetails({ orderId }) {
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
                code: `import { supportAgent } from "@/workflows/supportAgent"

export async function POST(req) {
  const { messages } = await req.json()
  // no durability — refresh kills the response
  const result = await supportAgent(messages)
  return new Response(result.stream)
}`,
              },
              {
                highlightLines: {
                  1: "[start()](https://workflow-sdk.dev/docs/api-reference/workflow-api/start) from `workflow/api` — kicks off a durable run on the server",
                  7: "Returns a **handle** with a [readable stream](https://workflow-sdk.dev/docs/foundations/streaming) + **run ID** — the run keeps going even if this request ends",
                },
                code: `import { start } from "workflow/api"
import { supportAgent } from "@/workflows/supportAgent"

export async function POST(req) {
  const { messages } = await req.json()
  // start() launches a durable run, returns a handle
  const run = await start(supportAgent, [messages])
  return new Response(run.readable)
}`,
              },
              {
                highlightLines: {
                  1: "[createUIMessageStreamResponse](https://ai-sdk.dev/docs/reference/ai-sdk-ui/ai-sdk-ui-response) from `ai` — formats a stream as a UI-message HTTP response",
                  10: "Pipe the [durable stream](https://workflow-sdk.dev/docs/foundations/streaming) directly into the HTTP response",
                  11: "",
                  12: "",
                },
                code: `import { createUIMessageStreamResponse } from "ai"
import { start } from "workflow/api"
import { supportAgent } from "@/workflows/supportAgent"

export async function POST(req) {
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
                  11: "Client stores this **run ID** to [reconnect](https://workflow-sdk.dev/docs/ai/resumable-streams) to the **exact same run** after refresh",
                  12: "",
                  13: "",
                },
                code: `import { createUIMessageStreamResponse } from "ai"
import { start } from "workflow/api"
import { supportAgent } from "@/workflows/supportAgent"

export async function POST(req) {
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
                code: `import { useChat } from "@ai-sdk/react"

// plain chat — refresh drops the reply mid-sentence
const { messages, sendMessage } = useChat({
  api: "/api/chat",
})`,
              },
              {
                highlightLines: {
                  2: "[WorkflowChatTransport](https://workflow-sdk.dev/docs/api-reference/workflow-ai/workflow-chat-transport) from `@workflow/ai` — handles the run-ID round-trip",
                  6: "Transport [stores the run ID](https://workflow-sdk.dev/docs/api-reference/workflow-ai/workflow-chat-transport) on every message",
                  7: "",
                  8: "",
                  9: "",
                  10: "",
                  11: "",
                  12: "",
                },
                code: `import { useChat } from "@ai-sdk/react"
import { WorkflowChatTransport } from "@workflow/ai"

const { messages, sendMessage } = useChat({
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
                  6: "On page load, check if there's an **active run** to [reconnect](https://workflow-sdk.dev/docs/ai/resumable-streams) to",
                },
                code: `import { useChat } from "@ai-sdk/react"
import { WorkflowChatTransport } from "@workflow/ai"

const { messages, sendMessage } = useChat({
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
                  14: "On reconnect, redirect to the [run-specific stream endpoint](https://workflow-sdk.dev/docs/ai/resumable-streams)",
                  15: "",
                  16: "",
                  17: "",
                },
                code: `import { useChat } from "@ai-sdk/react"
import { WorkflowChatTransport } from "@workflow/ai"

const { messages, sendMessage } = useChat({
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
