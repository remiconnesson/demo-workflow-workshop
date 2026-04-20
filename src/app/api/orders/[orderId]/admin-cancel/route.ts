import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { hookTokens } from "@/workflows/place-order";

type AdminCancelBody = { reason?: string };

/**
 * Admin cancel endpoint. Drives the `failure-admin-cancel` slide.
 *
 * Resumes the admin-cancel hook. The workflow is paused inside a
 * `Promise.race([cancelHook, sleep("6s")])`. Resuming the hook
 * wins the race and the workflow throws to trigger saga rollback.
 * `resumeHook` wakes a suspended workflow automatically, so no
 * explicit `run.wakeUp()` is needed.
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

    console.info("[demo] admin_cancel", {
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
