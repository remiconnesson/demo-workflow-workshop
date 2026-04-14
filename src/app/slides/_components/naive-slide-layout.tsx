import type { OrderStepId } from "@/lib/order-contract";
import { CodeSlideCard } from "./code-slide-card";
import { DemoStrip } from "./demo-strip";

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
 * Shares CodeSlideCard with the fix slide; only the red accent border
 * distinguishes it.
 */
export async function NaiveSlideLayout({
  eyebrow,
  headline,
  marker,
  markerLabel,
  naiveCode,
}: NaiveSlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      <DemoStrip marker={marker} label={markerLabel} />

      <h2 className="text-[52px] font-semibold leading-tight tracking-tight">
        {headline}
      </h2>

      <CodeSlideCard code={naiveCode} tone="naive" />
    </div>
  );
}
