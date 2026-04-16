import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { hookTokens } from "@/workflows/place-order";

type DisputeBody = { reason?: string };

/**
 * Delivery dispute endpoint. Drives the `dispute` /
 * "Dispute the Order" finale slide.
 *
 * Resumes the delivery-dispute hook. The workflow is paused inside
 * `Promise.race([disputeHook, sleep("24h")])` — resuming wins the
 * race, the workflow throws a plain Error, and compensations unwind
 * in reverse (refund, cancel, release) even though all six steps
 * already reported success. `resumeHook` wakes the suspended
 * workflow automatically, so no explicit `run.wakeUp()` is needed.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const body = (await req.json().catch(() => ({}))) as DisputeBody;
  const token = hookTokens.deliveryDispute(orderId);
  try {
    const hook = await resumeHook(token, {
      reason: body.reason ?? "never arrived",
    });

    console.info("[demo] delivery_dispute", {
      orderId,
      token,
      runId: hook.runId,
    });

    return NextResponse.json({
      ok: true,
      token,
      runId: hook.runId,
    });
  } catch (error) {
    if (HookNotFoundError.is(error)) {
      console.info("[demo] delivery_dispute_not_ready", {
        orderId,
        token,
      });

      return NextResponse.json(
        {
          error:
            "Dispute window is not open yet. Wait for all six steps to complete.",
        },
        { status: 409 },
      );
    }

    throw error;
  }
}
