import type { OrderStepId } from "@/lib/order-contract";
import type { FailureGroupSlug } from "../_data/failure-groups";
import { CodeSlideCard } from "./code-slide-card";
import { FinishedTimelineStrip } from "./finished-timeline-strip";

type NaiveSlideLayoutProps = {
  slide: FailureGroupSlug;
  eyebrow: string;
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  highlightSteps?: OrderStepId[];
  naiveCode: string;
};

/**
 * "The pain" slide — the first half of every Act 2 beat.
 * Shares CodeSlideCard with the fix slide; only the red accent border
 * distinguishes it.
 */
export async function NaiveSlideLayout({
  slide,
  headline,
  highlightSteps,
  naiveCode,
}: NaiveSlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      <FinishedTimelineStrip slide={slide} highlightSteps={highlightSteps} />

      <h2 className="text-[52px] font-semibold leading-tight tracking-tight">
        {headline}
      </h2>

      <CodeSlideCard code={naiveCode} tone="naive" />
    </div>
  );
}
