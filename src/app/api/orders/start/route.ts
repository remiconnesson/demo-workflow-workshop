import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  placeOrderWorkflow,
  type OrderInput,
} from "@/workflows/place-order";
import { setLatestRunId } from "@/lib/latest-run-store";

export async function POST(req: Request) {
  const raw = (await req.json()) as OrderInput;
  const input: OrderInput = {
    ...raw,
    failAt: raw.failAt ?? null,
    autoAck: raw.autoAck ?? true,
    demoMode: raw.demoMode ?? "standard",
    driverTimeout: raw.driverTimeout ?? "2m",
  };
  console.info("[demo] order_started", {
    orderId: input.orderId,
    failAt: input.failAt,
    autoAck: input.autoAck,
    demoMode: input.demoMode,
    driverTimeout: input.driverTimeout,
    itemCount: input.items.length,
  });
  const run = await start(placeOrderWorkflow, [input]);
  setLatestRunId(run.runId);
  console.info("[demo] order_run_started", {
    orderId: input.orderId,
    runId: run.runId,
    failAt: input.failAt,
    autoAck: input.autoAck,
    demoMode: input.demoMode,
    driverTimeout: input.driverTimeout,
  });
  return NextResponse.json({ runId: run.runId, orderId: input.orderId });
}
