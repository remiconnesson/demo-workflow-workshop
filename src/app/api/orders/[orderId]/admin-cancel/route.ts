import { NextResponse } from "next/server";
import { getRun, resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { hookTokens } from "@/workflows/place-order";

type AdminCancelBody = { reason?: string };

/**
 * Admin cancel endpoint. Drives the `failure-admin-cancel` slide.
 *
 * 1. Resumes the admin-cancel hook so the workflow's Promise.race
 *    sees the cancel branch and throws a FatalError.
 * 2. Calls Run.wakeUp() on the workflow to interrupt the pending
 *    sleep so the race evaluates immediately instead of waiting
 *    for the compressed timer to finish.
 *
 * Run.wakeUp() is the point of the slide — it shows the audience
 * that any suspended workflow can be interrupted from outside.
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const body = (await req.json().catch(() => ({}))) as AdminCancelBody;
  const token = hookTokens.adminCancel(orderId);
  try {
    const hook = await resumeHook(token, {
      cancelled: true,
      reason: body.reason ?? "admin-cancelled",
    });

    const result = await getRun(hook.runId).wakeUp();

    console.info("[demo] admin_cancel", {
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
      console.info("[demo] admin_cancel_not_ready", {
        orderId,
        token,
      });

      return NextResponse.json(
        { error: "Admin cancel is not ready yet. Wait for the cancel window." },
        { status: 409 },
      );
    }

    throw error;
  }
}
