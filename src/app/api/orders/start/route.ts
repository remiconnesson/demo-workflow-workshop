import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  placeOrderWorkflow,
  type OrderInput,
} from "@/workflows/place-order";

export async function POST(req: Request) {
  const input = (await req.json()) as OrderInput;
  const demoMode = input.demoMode ?? "standard";
  const driverTimeout = input.driverTimeout ?? "2m";
  const autoAck = input.autoAck ?? true;
  const failAt = input.failAt ?? null;
  console.info("[demo] order_started", {
    orderId: input.orderId,
    failAt,
    autoAck,
    demoMode,
    driverTimeout,
    itemCount: input.items.length,
  });
  const run = await start(placeOrderWorkflow, [input]);
  console.info("[demo] order_run_started", {
    orderId: input.orderId,
    runId: run.runId,
    failAt,
    autoAck,
    demoMode,
    driverTimeout,
  });
  return NextResponse.json({ runId: run.runId, orderId: input.orderId });
}
