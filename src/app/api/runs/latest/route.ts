import { NextResponse } from "next/server";
import { getLatestRunId } from "@/lib/latest-run-store";

export async function GET() {
  return NextResponse.json({ runId: getLatestRunId() });
}
