"use client";

import type { ReactNode } from "react";
import type { OrderStepId } from "@/lib/order-contract";
import type { OrderRunScenario } from "@/lib/order-run-client";
import type { SlideGroupSlug } from "../_data/agent-groups";
import { LiveOrderConceptLab } from "./live-order-concept-lab";

type DemoSlideLayoutProps = {
  slide: SlideGroupSlug | string;
  eyebrow: string;
  headline: string;
  marker?: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  scenario?: OrderRunScenario;
  allowCrash?: boolean;
  allowAdminCancel?: boolean;
  allowDispute?: boolean;
  showSleepCost?: boolean;
  showTimeline?: boolean;
  showCompensations?: boolean;
  highlightSteps?: string[];
  /**
   * When provided, REPLACES the default LiveOrderConceptLab demo surface.
   * Use for agent-group slides whose demo surface isn't the phone/order lab
   * (e.g. a streaming agent output pane or a chat surface). The left-side
   * headline/eyebrow keeps rendering identically.
   */
  rightPanel?: ReactNode;
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
  rightPanel,
}: DemoSlideLayoutProps) {
  return (
    <div className="flex h-full w-full flex-col gap-8 px-14 py-24">
      <h2 className="text-[84px] font-semibold leading-[0.9] tracking-[-0.03em] [font-stretch:condensed]">
        {headline}
      </h2>

      <div className="min-h-0 flex-1">
        {rightPanel ? (
          rightPanel
        ) : scenario ? (
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
        ) : null}
      </div>
    </div>
  );
}
