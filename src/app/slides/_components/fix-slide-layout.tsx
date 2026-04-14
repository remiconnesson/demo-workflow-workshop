import type { OrderStepId } from "@/lib/order-contract";
import { CodeSlideCard } from "./code-slide-card";
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
 * Full-width SDK code as the hero. Shares CodeSlideCard with the
 * naive slide so typography/spacing stay identical; only the accent
 * border differs.
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

      <CodeSlideCard code={workflowFix.code} tone="fix" />
    </div>
  );
}
