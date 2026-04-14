import { NextResponse } from "next/server";
import { armCrash } from "@/lib/crash-flags";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  armCrash(orderId);
  console.info("[demo] crash_armed", { orderId });
  return NextResponse.json({ ok: true, orderId });
}
