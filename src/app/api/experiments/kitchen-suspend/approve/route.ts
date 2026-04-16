import { NextResponse } from "next/server";
import { approvalHook } from "@/workflows/_hooks";

type ApproveBody = {
  token: string;
  approved: boolean;
  reason?: string;
};

export async function POST(req: Request) {
  const { token, approved, reason } = (await req.json()) as ApproveBody;

  if (!token || typeof approved !== "boolean") {
    return NextResponse.json(
      { error: "token and approved are required" },
      { status: 400 },
    );
  }

  try {
    const payload =
      reason === undefined ? { approved } : { approved, reason };
    const result = await approvalHook.resume(token, payload);
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
