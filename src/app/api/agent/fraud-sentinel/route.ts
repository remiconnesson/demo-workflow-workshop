import { createUIMessageStreamResponse } from "ai";
import { start } from "workflow/api";
import { fraudSentinelWorkflow } from "@/workflows/fraud-sentinel-agent";
import { setLatestRunId } from "@/lib/latest-run-store";

export async function POST() {
  const run = await start(fraudSentinelWorkflow);
  setLatestRunId(run.runId);

  return createUIMessageStreamResponse({
    stream: run.readable,
    headers: {
      "x-workflow-run-id": run.runId,
    },
  });
}
