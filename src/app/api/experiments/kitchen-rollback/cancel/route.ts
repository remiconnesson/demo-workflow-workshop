import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";

type CancelBody = {
  ticketId?: string;
  reason?: string;
};

/**
 * Guest-cancel endpoint for the kitchen-rollback chapter.
 *
 * Resumes the durable hook the DurableAgent created when it called
 * `watchForCustomerCancel`. Resuming returns { cancel: true, reason }
 * to the agent, which trips the rollback branch of the instructions
 * and unwinds every forward tool in reverse.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as CancelBody;
  const ticketId = body.ticketId ?? "tkt-8821";
  const token = `kitchen-rollback:${ticketId}`;

  try {
    const hook = await resumeHook(token, {
      cancel: true,
      reason: body.reason ?? "Guest reported allergy concern via the app",
    });

    return NextResponse.json({ ok: true, token, runId: hook.runId });
  } catch (error) {
    if (HookNotFoundError.is(error)) {
      return NextResponse.json(
        {
          error:
            "Cancel window is not open yet. Wait for the agent to finish firing the ticket.",
          token,
        },
        { status: 409 },
      );
    }
    throw error;
  }
}
