import { NextResponse } from "next/server";
import { dispatchRollbackHook } from "@/workflows/experiments/dispatch-rollback";

type TriggerBody = {
  token: string;
  disputed?: boolean;
  reason?: string;
};

export async function POST(req: Request) {
  const { token, disputed = true, reason } = (await req.json()) as TriggerBody;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  try {
    const payload =
      reason === undefined
        ? { disputed }
        : { disputed, reason };
    const result = await dispatchRollbackHook.resume(token, payload);
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
