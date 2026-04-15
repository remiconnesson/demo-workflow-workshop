import { NaiveSlideLayout } from "../_components/naive-slide-layout";
import { AGENT_GROUPS } from "../_data/agent-groups";

const NAIVE_CODE = `// Naive: call the model, stream tokens, call a tool, pray.
export async function POST(req: Request) {
  const { messages } = await req.json()

  const result = await streamText({
    model: openai("claude-haiku-4.5"),
    tools: { queryOrders, proposeMenuChange, applyMenuChange },
    messages,
  })

  // If the server restarts here, the tool call is lost forever.
  // There is no pause. There is no human-in-the-loop.
  // There is no way to approve a menu change before it ships.
  return result.toDataStreamResponse()
}`;

export default function AgentAnalystNaiveSlide() {
  const group = AGENT_GROUPS["agent-analyst"];
  return (
    <NaiveSlideLayout
      slide="agent-analyst"
      eyebrow={group.eyebrow}
      headline="A chat loop with no pause button."
      marker="span"
      naiveCode={NAIVE_CODE}
    />
  );
}
