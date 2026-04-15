import { NextResponse } from "next/server";
import { start } from "workflow/api";
import { observerAgentWorkflow } from "@/workflows/observer-agent";

export async function POST() {
  const run = await start(observerAgentWorkflow);
  return NextResponse.json({ runId: run.runId });
}
