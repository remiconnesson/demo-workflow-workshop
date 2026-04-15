"use client";

import { ORDER_STEPS, type OrderStepId } from "@/lib/order-contract";
import { LiveOrderConceptLab } from "../../_components/live-order-concept-lab";
import { failureGroups } from "../../_data/failure-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

/**
 * v7 — Minimal: headline + lab.
 * No DemoStrip above the card. The marker moves into a single pill anchored
 * to the headline. Step context appears inside the lab only.
 */
export default function V7() {
  const { headline, marker, markerLabel } = failureGroups["failure-crash"];
  const markedIds: Set<OrderStepId> =
    marker === "span"
      ? new Set(ORDER_STEPS.map((s) => s.id))
      : new Set(Array.isArray(marker) ? marker : [marker]);
  const markedLabels = ORDER_STEPS.filter((s) => markedIds.has(s.id))
    .map((s) => s.label)
    .join(" · ");

  return (
    <div className="flex h-full w-full flex-col gap-8 px-14 py-12">
      <div className="flex items-center gap-5">
        <h2 className="text-[68px] font-semibold leading-[0.95] tracking-tight">
          {headline}
        </h2>
        <span className="ml-auto inline-flex items-center gap-3 rounded-full border border-amber-300/40 bg-amber-300/5 px-5 py-2 font-mono text-xs uppercase tracking-[0.24em] text-amber-200">
          <span className="h-2 w-2 rounded-full bg-amber-300 shadow-[0_0_12px_rgba(252,211,77,0.7)]" />
          {markerLabel} · {markedLabels}
        </span>
      </div>

      <div className="min-h-0 flex-1">
        <LiveOrderConceptLab
          slide="failure-crash"
          scenario={{ ...slideScenarios.failureCrash, subtitle: "" }}
          allowCrash
        />
      </div>
    </div>
  );
}
