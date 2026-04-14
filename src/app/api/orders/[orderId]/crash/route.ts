import { NextResponse } from "next/server";
import { getRun, resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { hookTokens } from "@/workflows/place-order";

/**
 * Crash-injection endpoint. Drives the `failure-crash` slide.
 *
 * 1. Resumes the crash-inject hook so the workflow's Promise.race
 *    (between each major step) sees the "crash" branch and throws a
 *    PLAIN Error — not FatalError, not RetryableError. Unhandled
 *    exceptions cause the Workflow runtime to retry the run and
 *    replay every completed step from the event log.
 * 2. Calls Run.wakeUp() so any pending sleeps inside the workflow
 *    resolve immediately and the race evaluates on the next tick.
 *
 * This is the heart of the crash story: the audience can verify in
 * `npx workflow web` that the run retried and resumed from the last
 * durable checkpoint instead of starting over.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const token = hookTokens.crashInject(orderId);
  try {
    const hook = await resumeHook(token, { crashed: true });

    const result = await getRun(hook.runId).wakeUp();

    console.info("[demo] crash_injected", {
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
      console.info("[demo] crash_inject_not_ready", { orderId, token });

      return NextResponse.json(
        { error: "Crash-inject hook is not open yet. Start a run first." },
        { status: 409 },
      );
    }

    throw error;
  }
}
