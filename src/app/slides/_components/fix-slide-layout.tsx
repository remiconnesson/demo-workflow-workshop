import type { OrderStepId } from "@/lib/order-contract";
import { CodeBlock } from "./code-block";
import { DemoStrip } from "./demo-strip";

export type WorkflowFix = {
  code: string;
};

type FixSlideLayoutProps = {
  eyebrow: string;
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  workflowFix: WorkflowFix;
};

/**
 * The "workflow code" slide — third beat per concept in Act 2.
 * Full-width SDK code as the hero. No lab — that was the
 * previous slide. Big emerald-accent card with the caption
 * and Shiki-highlighted code at projector scale.
 */
export async function FixSlideLayout({
  eyebrow,
  headline,
  marker,
  markerLabel,
  workflowFix,
}: FixSlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      <DemoStrip marker={marker} label={markerLabel} />

      <h2 className="text-[52px] font-semibold leading-tight tracking-tight">
        {headline}
      </h2>

      <div className="min-h-0 flex-1 overflow-hidden rounded-2xl border border-emerald-400/30 bg-black/60 p-6">
        <CodeBlock code={workflowFix.code} lang="ts" textClass="text-3xl" />
      </div>
    </div>
  );
}
