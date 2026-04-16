import { NextResponse } from "next/server";
import { menuRollbackHook } from "@/workflows/experiments/menu-rollback";

type TriggerBody = {
  token: string;
  regressionPct?: number;
  reason?: string;
};

export async function POST(req: Request) {
  const { token, regressionPct, reason } = (await req.json()) as TriggerBody;

  if (!token) {
    return NextResponse.json({ error: "token is required" }, { status: 400 });
  }

  const payload = {
    // Default signal: conversion dropped 8.1% vs. 14-day baseline.
    regressionPct: typeof regressionPct === "number" ? regressionPct : -8.1,
    reason:
      reason ??
      "Conversion rate dropped 8.1% in first hour vs. 14-day baseline",
  };

  try {
    const result = await menuRollbackHook.resume(token, payload);
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
