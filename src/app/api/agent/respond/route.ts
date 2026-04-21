import { NextResponse } from "next/server";
import { managerInputHook } from "@/workflows/_hooks";

type RespondBody = {
  token: string;
  answer: string;
};

export async function POST(req: Request) {
  const { token, answer } = (await req.json()) as RespondBody;
  const trimmed = typeof answer === "string" ? answer.trim() : "";

  if (!token || !trimmed) {
    return NextResponse.json(
      { error: "token and answer are required" },
      { status: 400 },
    );
  }

  try {
    const result = await managerInputHook.resume(token, { answer: trimmed });
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
