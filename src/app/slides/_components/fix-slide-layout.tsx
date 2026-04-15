import type { OrderStepId } from "@/lib/order-contract";
import { isAgentGroupSlug, type SlideGroupSlug } from "../_data/agent-groups";
import { CodeSlideCard } from "./code-slide-card";
import { FinishedTimelineStrip } from "./finished-timeline-strip";

export type WorkflowFix = {
  code: string;
};

type FixSlideLayoutProps = {
  slide: SlideGroupSlug;
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
 *
 * For agent-group slugs the phone/order timeline strip is skipped, but
 * the same vertical space is reserved so the deck transitions without CLS.
 */
export async function FixSlideLayout({
  slide,
  headline,
  highlightSteps,
  workflowFix,
}: FixSlideLayoutProps) {
  const isAgent = isAgentGroupSlug(slide);

  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      {isAgent ? (
        <div aria-hidden className="min-h-[108px]" />
      ) : (
        <FinishedTimelineStrip slide={slide} highlightSteps={highlightSteps} />
      )}

      <h2 className="text-[52px] font-semibold leading-tight tracking-tight">
        {headline}
      </h2>

      <CodeSlideCard code={workflowFix.code} tone="fix" />
    </div>
  );
}
