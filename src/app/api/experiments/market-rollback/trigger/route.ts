import { NextResponse } from "next/server";
import { marketRollbackHook } from "@/workflows/experiments/market-rollback";

type TriggerBody = {
  token: string;
  fired: boolean;
  source?: "pr" | "legal" | "conversion" | "autonomous";
  reason?: string;
};

export async function POST(req: Request) {
  const { token, fired, source, reason } = (await req.json()) as TriggerBody;

  if (!token || typeof fired !== "boolean") {
    return NextResponse.json(
      { error: "token and fired are required" },
      { status: 400 },
    );
  }

  try {
    const payload: {
      fired: boolean;
      source?: "pr" | "legal" | "conversion" | "autonomous";
      reason?: string;
    } = { fired };
    if (source) payload.source = source;
    if (reason) payload.reason = reason;

    const result = await marketRollbackHook.resume(token, payload);
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
