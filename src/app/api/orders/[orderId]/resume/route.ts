import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
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

  await resumeHook(token, payload);
  return NextResponse.json({ ok: true, token });
}
