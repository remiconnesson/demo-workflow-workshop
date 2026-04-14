import type { OrderStepId } from "@/lib/order-contract";
import type { OrderRunScenario } from "@/lib/order-run-client";
import { CodeBlock } from "./code-block";
import { DemoStrip } from "./demo-strip";
import { LiveOrderConceptLab } from "./live-order-concept-lab";

export type WorkflowFix = {
  caption: string;
  code: string;
};

type FailureSlideLayoutProps = {
  slide: string;
  eyebrow: string;
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  scenario: OrderRunScenario;
  allowCrash?: boolean;
  allowAdminCancel?: boolean;
  showTimeline?: boolean;
  showCompensations?: boolean;
  highlightSteps?: string[];
  workflowFix: WorkflowFix;
};

/**
 * Act 2 slide layout — projector-legible.
 *
 * Previous iterations tried to fit lab + naive-tree + fix-strip all
 * on one slide, which squeezed every element below the 30-foot rule.
 * This version makes two things equally the hero:
 *   (1) the LAB on the left — the demo reacting to the failure
 *   (2) the WORKFLOW FIX on the right — text-3xl code, big caption
 * The naive cost is an ambient ticker above the main area (a single
 * line: "Naive cost: N files · M lines — new: latest-file.ts"). The
 * full file-tree reveal happens once on slide 13.
 */
export async function FailureSlideLayout({
  slide,
  eyebrow,
  headline,
  marker,
  markerLabel,
  scenario,
  allowCrash = false,
  allowAdminCancel = false,
  showTimeline = true,
  showCompensations = true,
  highlightSteps,
  workflowFix,
}: FailureSlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      <DemoStrip marker={marker} label={markerLabel} />

      <h2 className="text-[52px] font-semibold leading-tight tracking-tight">
        {headline}
      </h2>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-6 overflow-hidden">
        <div className="min-h-0">
          <LiveOrderConceptLab
            slide={slide}
            scenario={scenario}
            allowCrash={allowCrash}
            allowAdminCancel={allowAdminCancel}
            showTimeline={showTimeline}
            showCompensations={showCompensations}
            highlightSteps={highlightSteps}
          />
        </div>
        <WorkflowFixPanel fix={workflowFix} />
      </div>
    </div>
  );
}

/**
 * The workflow fix is the right-side hero. Full-column card, emerald
 * accent, with the code itself as the main element at text-4xl Geist
 * Mono. The caption is a short subtitle above, sized large enough to
 * read from 30 feet but secondary to the code. Every snippet is
 * ≤4 lines so it fits at text-4xl without wrapping in a half-column.
 */
async function WorkflowFixPanel({ fix }: { fix: WorkflowFix }) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-center gap-8 rounded-2xl border border-emerald-400/30 bg-zinc-950 px-10 py-12">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
          The fix — Workflow SDK
        </div>
        <div className="mt-3 font-sans text-2xl leading-snug text-emerald-100/80">
          {fix.caption}
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/60 px-8 py-8">
        <CodeBlock code={fix.code} lang="ts" textClass="text-2xl" />
      </div>
    </div>
  );
}
