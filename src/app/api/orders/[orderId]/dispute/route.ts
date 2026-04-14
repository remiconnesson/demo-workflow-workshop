import { NextResponse } from "next/server";
import { getRun, resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { hookTokens } from "@/workflows/place-order";

type DisputeBody = { reason?: string };

/**
 * Delivery dispute endpoint. Drives the `failure-driver-refuses` /
 * "Dispute the Order" finale slide.
 *
 * 1. Resumes the delivery-dispute hook so the workflow's Promise.race
 *    sees the disputed branch and throws a FatalError — cascading
 *    every compensation in reverse (refund, cancel, release) even
 *    though all six steps already reported success.
 * 2. Calls Run.wakeUp() on the workflow so the pending 5s sleep
 *    returns immediately and the race evaluates at once.
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

    const result = await getRun(hook.runId).wakeUp();

    console.info("[demo] delivery_dispute", {
      orderId,
      token,
      runId: hook.runId,
      stoppedSleeps: result.stoppedCount,
    });

    return NextResponse.json({
      ok: true,
      token,
      runId: hook.runId,
      stoppedSleeps: result.stoppedCount,
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
