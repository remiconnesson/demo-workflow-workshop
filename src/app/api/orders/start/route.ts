import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  placeOrderWorkflow,
  type OrderInput,
} from "@/workflows/place-order";

export async function POST(req: Request) {
  const input = (await req.json()) as OrderInput;
  console.info("[demo] order_started", {
    orderId: input.orderId,
    failAt: input.failAt ?? null,
    autoAck: input.autoAck ?? true,
    itemCount: input.items.length,
  });
  const run = await start(placeOrderWorkflow, [input]);
  console.info("[demo] order_run_started", {
    orderId: input.orderId,
    runId: run.runId,
  });
  return NextResponse.json({ runId: run.runId, orderId: input.orderId });
}
