import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { observerAgentWorkflow } from "@/workflows/observer-agent";
import { setLatestRunId } from "@/lib/latest-run-store";

export async function POST() {
  const run = await start(observerAgentWorkflow);
  setLatestRunId(run.runId);
  return NextResponse.json({ runId: run.runId }, { status: 202 });
}
