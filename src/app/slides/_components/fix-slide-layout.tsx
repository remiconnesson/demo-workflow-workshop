import type { OrderStepId } from "@/lib/order-contract";
import type { FailureGroupSlug } from "../_data/failure-groups";
import { CodeSlideCard } from "./code-slide-card";
import { FinishedTimelineStrip } from "./finished-timeline-strip";

export type WorkflowFix = {
  code: string;
};

type FixSlideLayoutProps = {
  slide: FailureGroupSlug;
  eyebrow: string;
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  highlightSteps?: OrderStepId[];
  workflowFix: WorkflowFix;
};

/**
 * The "workflow code" slide — third beat per concept in Act 2.
 * Full-width SDK code as the hero. Shares CodeSlideCard with the
 * naive slide so typography/spacing stay identical; only the accent
 * border differs.
 */
export async function FixSlideLayout({
  slide,
  headline,
  highlightSteps,
  workflowFix,
}: FixSlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      <FinishedTimelineStrip slide={slide} highlightSteps={highlightSteps} />

      <h2 className="text-[52px] font-semibold leading-tight tracking-tight">
        {headline}
      </h2>

      <CodeSlideCard code={workflowFix.code} tone="fix" />
    </div>
  );
}
