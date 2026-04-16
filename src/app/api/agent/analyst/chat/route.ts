import { getRun, start } from "workflow/api";
import {
  analystAgentWorkflow,
  type ChatMessage,
} from "@/workflows/analyst-agent";
import { setLatestRunId } from "@/lib/latest-run-store";

type ChatBody = { messages: ChatMessage[] };

export async function POST(req: Request) {
  const body = (await req.json()) as ChatBody;
  const messages = Array.isArray(body.messages) ? body.messages : [];

  const run = await start(analystAgentWorkflow, [messages]);
  setLatestRunId(run.runId);
  const readable = getRun(run.runId).getReadable();

  const encoder = new TextEncoder();
  const ndjson = new TransformStream<unknown, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
    },
  });

  return new Response(readable.pipeThrough(ndjson), {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "X-Run-Id": run.runId,
    },
  });
}
