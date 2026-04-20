import { NextResponse } from "next/server";
import { armCrash } from "@/lib/crash-flags";

export async function POST(req: Request) {
  const { runId } = (await req.json()) as { runId: string };
  armCrash(`fraud:${runId}`);
  return NextResponse.json({ ok: true, runId });
}
