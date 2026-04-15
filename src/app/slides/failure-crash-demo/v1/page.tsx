"use client";

import { ORDER_STEPS, type OrderStepId } from "@/lib/order-contract";
import { LiveOrderConceptLab } from "../../_components/live-order-concept-lab";
import { failureGroups } from "../../_data/failure-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

/**
 * v1 — Inline eyebrow lockup.
 * Single-row header: eyebrow · headline · crash-here label.
 * DemoStrip collapses to a thin progress rail, step labels removed.
 */
export default function V1() {
  const { headline, marker, markerLabel } = failureGroups["failure-crash"];
  const markedIds: Set<OrderStepId> =
    marker === "span"
      ? new Set(ORDER_STEPS.map((s) => s.id))
      : new Set(Array.isArray(marker) ? marker : [marker]);

  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-10">
      <div className="flex items-baseline justify-between gap-10">
        <div className="flex items-baseline gap-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.3em] text-zinc-500">
            04a
          </span>
          <h2 className="text-[56px] font-semibold leading-[0.95] tracking-tight">
            {headline}
          </h2>
        </div>
        <span className="font-mono text-sm uppercase tracking-[0.24em] text-amber-300/80">
          {markerLabel}
        </span>
      </div>

      <div className="relative h-3">
        <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/10" />
        <div className="relative grid h-full grid-cols-6">
          {ORDER_STEPS.map((s) => (
            <div key={s.id} className="flex items-center justify-center">
              <div
                className={`h-2.5 w-2.5 rounded-full ${
                  markedIds.has(s.id)
                    ? "bg-amber-300 shadow-[0_0_14px_rgba(252,211,77,0.6)]"
                    : "bg-zinc-700"
                }`}
              />
            </div>
          ))}
        </div>
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
