import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { hookTokens } from "@/workflows/place-order";

// Demo helper: automatically resolves a hook so the saga can run end-to-end
// without requiring a human to click buttons in the UI.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const kind = new URL(req.url).searchParams.get("kind");

  switch (kind) {
    case "restaurant-accept":
      await resumeHook(hookTokens.restaurantAccept(orderId), { accepted: true });
      break;
    case "driver-accept":
      await resumeHook(hookTokens.driverAccept(orderId), { accepted: true });
      break;
    case "delivered":
      await resumeHook(hookTokens.delivered(orderId), {});
      break;
    default:
      return NextResponse.json({ error: "unknown kind" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
