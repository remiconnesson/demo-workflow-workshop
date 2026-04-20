import { getRun, start } from "workflow/api";
import { complianceRetryAgentWorkflow } from "@/workflows/experiments/compliance-retry";
import { setLatestRunId } from "@/lib/latest-run-store";

export async function POST() {
  const run = await start(complianceRetryAgentWorkflow);
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
      "x-workflow-run-id": run.runId,
    },
  });
}
