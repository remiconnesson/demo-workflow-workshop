import { NextResponse } from "next/server";
import { supportRollbackHook } from "@/workflows/experiments/support-rollback";

type TriggerBody = {
  token: string;
  verdict: "fraud-confirmed" | "false-positive";
  reason?: string;
};

export async function POST(req: Request) {
  const { token, verdict, reason } = (await req.json()) as TriggerBody;

  if (!token || (verdict !== "fraud-confirmed" && verdict !== "false-positive")) {
    return NextResponse.json(
      { error: "token and verdict are required" },
      { status: 400 },
    );
  }

  try {
    const payload = reason === undefined ? { verdict } : { verdict, reason };
    const result = await supportRollbackHook.resume(token, payload);
    if (!result) {
      return NextResponse.json({ error: "hook_not_found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, runId: result.runId });
  } catch (error) {
    return NextResponse.json(
      { error: "invalid_token_or_payload", message: (error as Error).message },
      { status: 400 },
    );
  }
}
