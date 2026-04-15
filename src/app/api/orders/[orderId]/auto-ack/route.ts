import { NextResponse } from "next/server";
import { resumeHook } from "workflow/api";
import { HookNotFoundError } from "workflow/errors";
import { hookTokens } from "@/workflows/place-order";

// Demo helper: automatically resolves a hook so the saga can run end-to-end
// without requiring a human to click buttons in the UI.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ orderId: string }> },
) {
  const { orderId } = await params;
  const kind = new URL(req.url).searchParams.get("kind");

  try {
    let hook: Awaited<ReturnType<typeof resumeHook>>;
    switch (kind) {
      case "restaurant-accept":
        hook = await resumeHook(hookTokens.restaurantAccept(orderId), { accepted: true });
        break;
      case "driver-accept":
        hook = await resumeHook(hookTokens.driverAccept(orderId), { accepted: true });
        break;
      case "delivered":
        hook = await resumeHook(hookTokens.delivered(orderId), {});
        break;
      default:
        return NextResponse.json({ error: "unknown kind" }, { status: 400 });
    }

    return NextResponse.json({ ok: true, runId: hook.runId });
  } catch (error) {
    if (HookNotFoundError.is(error)) {
      console.info("[demo] auto_ack_not_ready", {
        orderId,
        kind,
      });

      return NextResponse.json(
        { error: "Hook is not ready yet or has already been resumed." },
        { status: 409 },
      );
    }

    throw error;
  }
}
