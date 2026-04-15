"use client";

import { LiveOrderConceptLab } from "../../_components/live-order-concept-lab";
import { DemoStrip } from "../../_components/demo-strip";
import { failureGroups } from "../../_data/failure-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

/**
 * v2 — Mono hero.
 * Headline rendered in Geist Mono, lowercased, all-one-line.
 * Subtitle removed; the card becomes a quiet stage.
 */
export default function V2() {
  const { headline, marker, markerLabel } = failureGroups["failure-crash"];
  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-10">
      <DemoStrip marker={marker} label={markerLabel} />

      <h2 className="font-mono text-[44px] leading-[1.02] tracking-tight text-white">
        <span className="text-zinc-500">// </span>
        unexpected failures happen anywhere
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
