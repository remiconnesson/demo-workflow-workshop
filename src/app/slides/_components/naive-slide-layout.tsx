import type { OrderStepId } from "@/lib/order-contract";
import { isAgentGroupSlug, type SlideGroupSlug } from "../_data/agent-groups";
import { CodeSlideCard } from "./code-slide-card";
import { FinishedTimelineStrip } from "./finished-timeline-strip";

type NaiveSlideLayoutProps = {
  slide: SlideGroupSlug;
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
 *
 * For agent-group slugs the phone/order timeline strip is skipped, but
 * the same vertical space is reserved so the deck transitions without CLS.
 */
export async function NaiveSlideLayout({
  slide,
  headline,
  highlightSteps,
  naiveCode,
}: NaiveSlideLayoutProps) {
  const isAgent = isAgentGroupSlug(slide);

  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      {isAgent ? (
        // CLS-preserving spacer — matches the rendered height of the
        // FinishedTimelineStrip used for failure-group slides.
        <div aria-hidden className="min-h-[108px]" />
      ) : (
        <FinishedTimelineStrip slide={slide} highlightSteps={highlightSteps} />
      )}

      <h2 className="text-[52px] font-semibold leading-tight tracking-tight">
        {headline}
      </h2>

      <CodeSlideCard code={naiveCode} tone="naive" />
    </div>
  );
}
