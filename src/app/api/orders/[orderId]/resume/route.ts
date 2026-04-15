import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { hookTokens } from "@/workflows/place-order";

type ResumeBody =
  | { kind: "restaurant-accept"; accepted: boolean; reason?: string }
  | { kind: "driver-accept"; accepted: boolean }
  | { kind: "delivered"; photo?: string };

export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const body = (await req.json()) as ResumeBody;

  let token: string;
  let payload: unknown;

  switch (body.kind) {
    case "restaurant-accept":
      token = hookTokens.restaurantAccept(orderId);
      payload = { accepted: body.accepted, reason: body.reason };
      break;
    case "driver-accept":
      token = hookTokens.driverAccept(orderId);
      payload = { accepted: body.accepted };
      break;
    case "delivered":
      token = hookTokens.delivered(orderId);
      payload = { photo: body.photo };
      break;
    default:
      return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }

  try {
    const hook = await resumeHook(token, payload);
    console.info("[demo] hook_resume", { orderId, kind: body.kind, token, runId: hook.runId });
    return NextResponse.json({ ok: true, token, runId: hook.runId });
  } catch (error) {
    if (HookNotFoundError.is(error)) {
      console.info("[demo] hook_resume_not_ready", {
        orderId,
        kind: body.kind,
        token,
      });

      return NextResponse.json(
        { error: "Hook is not ready yet or has already been resumed." },
        { status: 409 },
      );
    }

    throw error;
  }
}
