import type { OrderStepId } from "@/lib/order-contract";
import { DemoStrip } from "./demo-strip";

type PatternSlideLayoutProps = {
  eyebrow: string;
  patternName: string;
  description: string;
  docUrl: string;
  docSection: string;
  apiPrimitive: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
};

/**
 * The "pattern" slide — third beat per concept in Act 2.
 * Teaches the SDK vocabulary and gives the audience a breadcrumb
 * to the docs. Clean, one-concept, photo-friendly (audience
 * captures the URL from this slide).
 */
export function PatternSlideLayout({
  eyebrow,
  patternName,
  description,
  docUrl,
  docSection,
  apiPrimitive,
  marker,
  markerLabel,
}: PatternSlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-8">
      <DemoStrip marker={marker} label={markerLabel} />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-10">
        <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-500">
          {eyebrow}
        </div>

        <h2 className="text-center text-7xl font-semibold tracking-tight">
          {patternName}
        </h2>

        <p className="max-w-3xl text-center text-3xl leading-relaxed text-zinc-400">
          {description}
        </p>

        <div className="rounded-2xl border border-white/10 bg-zinc-950 px-10 py-6 text-center font-mono text-3xl text-white">
          {apiPrimitive}
        </div>

        <div className="mt-4 flex flex-col items-center gap-2">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-600">
            {docSection}
          </div>
          <div className="font-mono text-2xl text-zinc-300">
            {docUrl}
          </div>
        </div>
      </div>
    </div>
  );
}
