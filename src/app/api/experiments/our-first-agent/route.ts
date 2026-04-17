import { createUIMessageStreamResponse, type UIMessage } from "ai";
import { start } from "workflow/api";
import { ourFirstAgentWorkflow } from "@/workflows/experiments/our-first-agent";
import { setLatestRunId } from "@/lib/latest-run-store";

export async function POST(req: Request) {
  const { messages } = (await req.json()) as { messages: UIMessage[] };

  const run = await start(ourFirstAgentWorkflow, [messages]);
  setLatestRunId(run.runId);

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
