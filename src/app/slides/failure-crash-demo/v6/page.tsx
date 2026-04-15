"use client";

import { LiveOrderConceptLab } from "../../_components/live-order-concept-lab";
import { DemoStrip } from "../../_components/demo-strip";
import { failureGroups } from "../../_data/failure-groups";
import { slideScenarios } from "../../_lib/slide-scenarios";

/**
 * v6 — Two-line poster.
 * Headline split across two lines with mixed weight. Subtitle promoted into
 * the title block as a muted tagline, but reduced to four words.
 */
export default function V6() {
  const { marker, markerLabel } = failureGroups["failure-crash"];
  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-10">
      <DemoStrip marker={marker} label={markerLabel} />

      <div className="flex items-end gap-8">
        <h2 className="text-[72px] leading-[0.92] tracking-tight">
          <span className="font-light text-zinc-400">Unexpected failures</span>
          <br />
          <span className="font-semibold text-white">happen anywhere.</span>
        </h2>
        <span className="mb-3 font-mono text-base text-zinc-500">
          — and the workflow survives them.
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
