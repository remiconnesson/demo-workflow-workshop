import type { OrderStepId } from "@/lib/order-contract";
import { isAgentGroupSlug, type SlideGroupSlug } from "../_data/agent-groups";
import { CodeBlock } from "./code-block";
import { FinishedTimelineStrip } from "./finished-timeline-strip";

export type WorkflowFix = {
  code: string;
};

export type FixStep = { label: string; detail: string };

type StatusTone = "fuchsia" | "red" | "amber" | "sky" | "emerald";

type FixSlideLayoutProps = {
  slide: SlideGroupSlug;
  eyebrow: string;
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  highlightSteps?: OrderStepId[];
  workflowFix: WorkflowFix;
  steps: [FixStep, FixStep, FixStep];
  filename?: string;
  statusLabel?: string;
  statusTone?: StatusTone;
};

const DOT_COLOR: Record<StatusTone, string> = {
  fuchsia: "bg-fuchsia-400",
  red: "bg-red-400",
  amber: "bg-amber-400",
  sky: "bg-sky-400",
  emerald: "bg-emerald-400",
};

const DOT_GLOW: Record<StatusTone, string> = {
  fuchsia: "0 0 10px rgba(232,121,249,0.6)",
  red: "0 0 10px rgba(248,113,113,0.6)",
  amber: "0 0 10px rgba(252,211,77,0.6)",
  sky: "0 0 10px rgba(56,189,248,0.6)",
  emerald: "0 0 10px rgba(52,211,153,0.6)",
};

/**
 * Workflow-code slide — Geist-aligned split.
 * Left rail: eyebrow, headline, three numbered steps, status dot.
 * Right: code card with mono filename + "use workflow" directive label.
 */
export async function FixSlideLayout({
  slide,
  eyebrow,
  headline,
  highlightSteps,
  workflowFix,
  steps,
  filename = "placeOrder.ts",
  statusLabel,
  statusTone = "fuchsia",
  markerLabel,
}: FixSlideLayoutProps) {
  const isAgent = isAgentGroupSlug(slide);
  const pillLabel = statusLabel ?? markerLabel;

  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-8">
      {isAgent ? (
        <div aria-hidden className="min-h-[108px]" />
      ) : (
        <FinishedTimelineStrip slide={slide} highlightSteps={highlightSteps} />
      )}

      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr] gap-12">
        <div className="flex flex-col">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
            {eyebrow}
          </div>
          <h2
            className="mt-6 text-[44px] font-semibold text-white"
            style={{ lineHeight: "46px", letterSpacing: "-2.2px" }}
          >
            {headline}
          </h2>

          <ol className="mt-8 flex flex-col gap-4">
            {steps.map((step, i) => (
              <li key={step.label} className="flex gap-4">
                <span className="pt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="flex flex-col gap-1">
                  <span className="text-[15px] font-medium text-zinc-100">
                    {step.label}
                  </span>
                  <span className="font-mono text-[12px] text-zinc-500">
                    {step.detail}
                  </span>
                </div>
              </li>
            ))}
          </ol>

          {pillLabel ? (
            <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-6">
              <span
                className={`inline-block h-[7px] w-[7px] rounded-full ${DOT_COLOR[statusTone]}`}
                style={{ boxShadow: DOT_GLOW[statusTone] }}
              />
              <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-zinc-400">
                {pillLabel}
              </span>
            </div>
          ) : null}
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
            <span className="font-mono text-[12px] text-zinc-500">{filename}</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-400/80">
              use workflow
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            <CodeBlock code={workflowFix.code} lang="ts" textClass="text-[26px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
