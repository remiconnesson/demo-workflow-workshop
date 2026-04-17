import { NextResponse } from "next/server";
import { orderRollbackHook } from "@/workflows/experiments/order-rollback";

type AlertBody = {
  token: string;
  allergenAlert: boolean;
  reason?: string;
};

export async function POST(req: Request) {
  const { token, allergenAlert, reason } = (await req.json()) as AlertBody;

  if (!token || typeof allergenAlert !== "boolean") {
    return NextResponse.json(
      { error: "token and allergenAlert are required" },
      { status: 400 },
    );
  }

  try {
    const payload =
      reason === undefined ? { allergenAlert } : { allergenAlert, reason };
    const result = await orderRollbackHook.resume(token, payload);
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
