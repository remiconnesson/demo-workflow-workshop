"use client";

import type { OrderStepId } from "@/lib/order-contract";
import type { OrderRunScenario } from "@/lib/order-run-client";
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
 * Condensed headline sits directly above the lab; subtitle is suppressed
 * so one text layer competes for attention. The audience sees the problem,
 * not a ladder of titles.
 */
export function DemoSlideLayout({
  slide,
  headline,
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
    <div className="flex h-full w-full flex-col gap-8 px-14 py-24">
      <h2 className="text-[84px] font-semibold leading-[0.9] tracking-[-0.03em] [font-stretch:condensed]">
        {headline}
      </h2>

      <div className="min-h-0 flex-1">
        <LiveOrderConceptLab
          slide={slide}
          scenario={{ ...scenario, subtitle: "" }}
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
