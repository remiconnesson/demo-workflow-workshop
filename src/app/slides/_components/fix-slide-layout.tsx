import type { OrderStepId } from "@/lib/order-contract";
import { CodeBlock } from "./code-block";
import { DemoStrip } from "./demo-strip";

export type WorkflowFix = {
  caption: string;
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

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-10 rounded-2xl border border-emerald-400/30 bg-zinc-950 px-14 py-12">
        <div className="font-sans text-3xl leading-snug text-emerald-100/80">
          {workflowFix.caption}
        </div>
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-black/60 px-10 py-10">
          <CodeBlock code={workflowFix.code} lang="ts" textClass="text-3xl" />
        </div>
      </div>
    </div>
  );
}
