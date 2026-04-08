import { NextResponse } from "next/server";
import { start } from "workflow/api";
import {
  placeOrderWorkflow,
  type OrderInput,
} from "@/workflows/place-order";

export async function POST(req: Request) {
  const input = (await req.json()) as OrderInput;
  const run = await start(placeOrderWorkflow, [input]);
  return NextResponse.json({ runId: run.runId, orderId: input.orderId });
}
