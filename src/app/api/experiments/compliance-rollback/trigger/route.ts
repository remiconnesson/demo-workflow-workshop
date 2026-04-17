import { NextResponse } from "next/server";
import { complianceRollbackHook } from "@/workflows/experiments/compliance-rollback";

type TriggerBody = {
  token: string;
  falsePositive?: boolean;
  labNote?: string;
};

export async function POST(req: Request) {
  const {
    token,
    falsePositive = true,
    labNote,
  } = (await req.json()) as TriggerBody;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  try {
    const payload =
      labNote === undefined
        ? { falsePositive }
        : { falsePositive, labNote };
    const result = await complianceRollbackHook.resume(token, payload);
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
