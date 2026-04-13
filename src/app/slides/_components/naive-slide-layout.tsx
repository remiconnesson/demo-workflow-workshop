import type { OrderStepId } from "@/lib/order-contract";
import { CodeBlock } from "./code-block";
import { DemoStrip } from "./demo-strip";
import { NaiveCostTicker } from "./naive-cost-ticker";

type NaiveSlideLayoutProps = {
  slide: string;
  eyebrow: string;
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  naiveCode: string;
};

/**
 * "The pain" slide — the first half of every Act 2 beat.
 * Shows the naive approach as a big, readable code block.
 * No lab, no fix — just the red-accented mess the audience has to
 * imagine maintaining. The audience sees this, thinks "ugh", then
 * the presenter advances to the fix slide.
 */
export async function NaiveSlideLayout({
  slide,
  eyebrow,
  headline,
  marker,
  markerLabel,
  naiveCode,
}: NaiveSlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      <DemoStrip marker={marker} label={markerLabel} />

      <div className="flex items-end justify-between gap-8">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-red-400/80">
            {eyebrow}
          </div>
          <h2 className="mt-2 text-[52px] font-semibold leading-tight tracking-tight">
            {headline}
          </h2>
        </div>
        <NaiveCostTicker slide={slide} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-red-500/30 bg-zinc-950 px-10 py-10">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-red-300/80">
          What you&apos;d actually write
        </div>
        <div className="mt-6 min-h-0 flex-1 overflow-y-auto">
          <CodeBlock code={naiveCode} lang="ts" textClass="text-2xl" />
        </div>
      </div>
    </div>
  );
}
