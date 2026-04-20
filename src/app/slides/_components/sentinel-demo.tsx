"use client";

import type { SentinelVariant } from "../_data/sentinel-variants";
import { FraudDemo } from "./sentinel-demos/fraud-demo";
import { SloDemo } from "./sentinel-demos/slo-demo";
import { ModerationDemo } from "./sentinel-demos/moderation-demo";
import { PatcherDemo } from "./sentinel-demos/patcher-demo";
import { OrderSafetyDemo } from "./sentinel-demos/order-safety-demo";

// ---------------------------------------------------------------------------
// Thin slug-switch. Each variant owns its own bespoke full-bleed demo.
// ---------------------------------------------------------------------------

export function SentinelDemo({ variant }: { variant: SentinelVariant }) {
  switch (variant.slug) {
    case "fraud":
      return <FraudDemo variant={variant} />;
    case "slo":
      return <SloDemo variant={variant} />;
    case "moderation":
      return <ModerationDemo variant={variant} />;
    case "patcher":
      return <PatcherDemo variant={variant} />;
    case "order-safety":
      return <OrderSafetyDemo variant={variant} />;
  }
}
