"use client";

import { ORDER_STEPS, type OrderStepId } from "@/lib/order-contract";
import { LiveOrderConceptLab } from "../../_components/live-order-concept-lab";
import { failureGroups } from "../../_data/failure-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

/**
 * v5 — Editorial lockup.
 * Eyebrow rule + headline, no DemoStrip pill.
 * The marker is encoded as a compact inline caret above the pipeline.
 */
export default function V5() {
  const { headline, marker, markerLabel } = failureGroups["failure-crash"];
  const markedIds: Set<OrderStepId> =
    marker === "span"
      ? new Set(ORDER_STEPS.map((s) => s.id))
      : new Set(Array.isArray(marker) ? marker : [marker]);

  return (
    <div className="flex h-full w-full flex-col gap-8 px-14 py-10">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-6">
        <div className="flex items-center justify-between">
          <span className="font-mono text-[11px] uppercase tracking-[0.32em] text-zinc-500">
            Act II · Failure 01 · The crash
          </span>
          <span className="font-mono text-sm text-amber-300/80">
            ↯ {markerLabel}
          </span>
        </div>
        <h2 className="text-[64px] font-semibold leading-[0.95] tracking-tight">
          {headline}
        </h2>
        <div className="mt-2 grid grid-cols-6">
          {ORDER_STEPS.map((s) => (
            <div key={s.id} className="flex flex-col items-center gap-2">
              <div
                className={`h-1.5 w-full ${
                  markedIds.has(s.id) ? "bg-amber-300/70" : "bg-white/10"
                }`}
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-600">
                {s.label}
              </span>
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
