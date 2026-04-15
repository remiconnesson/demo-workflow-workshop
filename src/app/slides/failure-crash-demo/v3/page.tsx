"use client";

import { LiveOrderConceptLab } from "../../_components/live-order-concept-lab";
import { DemoStrip } from "../../_components/demo-strip";
import { failureGroups } from "../../_data/failure-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

/**
 * v3 — Asymmetric split.
 * Headline left, demo strip right — single horizontal band replaces two stacked bands.
 */
export default function V3() {
  const { headline, marker, markerLabel } = failureGroups["failure-crash"];
  return (
    <div className="flex h-full w-full flex-col gap-8 px-14 py-10">
      <div className="grid grid-cols-[1fr_1.2fr] items-center gap-10">
        <h2 className="text-[60px] font-semibold leading-[0.95] tracking-tight">
          {headline}
        </h2>
        <DemoStrip marker={marker} label={markerLabel} />
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
