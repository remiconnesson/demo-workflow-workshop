import type { OrderStepId } from "@/lib/order-contract";
import { CopyablePrompt } from "./copyable-prompt";
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
 * The "concept / pattern" slide — fourth beat per concept in Act 2.
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
  const docHref = docUrl.startsWith("http") ? docUrl : `https://${docUrl}`;

  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      <DemoStrip marker={marker} label={markerLabel} />

      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-6">
        <h2 className="text-center text-6xl font-semibold tracking-tight">
          {patternName}
        </h2>

        <p className="max-w-3xl text-center text-2xl leading-relaxed text-zinc-400">
          {description}
        </p>

        <div className="rounded-2xl border border-white/10 bg-zinc-950 px-10 py-5 text-center font-mono text-2xl text-white">
          {apiPrimitive}
        </div>

        <CopyablePrompt />

        <div className="flex flex-col items-center gap-1">
          <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-600">
            {docSection}
          </div>
          <a
            href={docHref}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-xl text-zinc-300 underline decoration-zinc-700 underline-offset-4 transition hover:text-white hover:decoration-white"
          >
            {docUrl}
          </a>
        </div>
      </div>
    </div>
  );
}
