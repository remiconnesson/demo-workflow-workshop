"use client";

import type { OrderStepId } from "@/lib/order-contract";
import type { OrderRunScenario } from "@/lib/order-run-client";
import { DemoStrip } from "./demo-strip";
import { LiveOrderConceptLab } from "./live-order-concept-lab";

type DemoSlideLayoutProps = {
  slide: string;
  eyebrow: string;
  headline: string;
  marker: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  scenario: OrderRunScenario;
  allowCrash?: boolean;
  allowAdminCancel?: boolean;
  allowDispute?: boolean;
  showSleepCost?: boolean;
  showTimeline?: boolean;
  showCompensations?: boolean;
  highlightSteps?: string[];
};

/**
 * The "demo" slide — first beat per concept in Act 2.
 * Full-width lab showing the failure in action. No code,
 * no fix — just the demo reacting to the problem. The
 * audience sees what breaks before they see how to fix it.
 */
export function DemoSlideLayout({
  slide,
  eyebrow,
  headline,
  marker,
  markerLabel,
  scenario,
  allowCrash = false,
  allowAdminCancel = false,
  allowDispute = false,
  showSleepCost = false,
  showTimeline = true,
  showCompensations = true,
  highlightSteps,
}: DemoSlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      <DemoStrip marker={marker} label={markerLabel} />

      <h2 className="text-[52px] font-semibold leading-tight tracking-tight">
        {headline}
      </h2>

      <div className="min-h-0 flex-1">
        <LiveOrderConceptLab
          slide={slide}
          scenario={scenario}
          allowCrash={allowCrash}
          allowAdminCancel={allowAdminCancel}
          allowDispute={allowDispute}
          showSleepCost={showSleepCost}
          showTimeline={showTimeline}
          showCompensations={showCompensations}
          highlightSteps={highlightSteps}
        />
      </div>
    </div>
  );
}
