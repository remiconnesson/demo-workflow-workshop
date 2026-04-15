"use client";

import { LiveOrderConceptLab } from "../../_components/live-order-concept-lab";
import { DemoStrip } from "../../_components/demo-strip";
import { failureGroups } from "../../_data/failure-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

/**
 * v4 — Condensed display.
 * One giant condensed headline only. No subtitle, no inline eyebrow above.
 * The demo strip keeps its context; everything else is ruthlessly cut.
 */
export default function V4() {
  const { headline, marker, markerLabel } = failureGroups["failure-crash"];
  return (
    <div className="flex h-full w-full flex-col gap-8 px-14 py-10">
      <DemoStrip marker={marker} label={markerLabel} />

      <h2 className="text-[84px] font-semibold leading-[0.9] tracking-[-0.03em] [font-stretch:condensed]">
        {headline}
      </h2>

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
