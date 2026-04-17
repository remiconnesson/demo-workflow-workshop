import { NextResponse } from "next/server";
import { approvalHook } from "@/workflows/_hooks";

type ApproveBody = {
  token: string;
  approved: boolean;
  reason?: string;
};

export async function POST(req: Request) {
  const { token, approved, reason } = (await req.json()) as ApproveBody;

  console.log("[approve] incoming", { token, approved, reason });

  if (!token || typeof approved !== "boolean") {
    console.log("[approve] bad_request");
    return NextResponse.json(
      { error: "token and approved are required" },
      { status: 400 },
    );
  }

  try {
    const payload =
      reason === undefined ? { approved } : { approved, reason };
    const result = await approvalHook.resume(token, payload);
    console.log("[approve] resume_result", { runId: result?.runId, found: !!result });
    if (!result) {
      return NextResponse.json({ error: "hook_not_found" }, { status: 404 });
    }
    return NextResponse.json({ success: true, runId: result.runId });
  } catch (error) {
    console.log("[approve] resume_threw", (error as Error).message);
    return NextResponse.json(
      { error: "invalid_token_or_payload", message: (error as Error).message },
      { status: 400 },
    );
  }
}
