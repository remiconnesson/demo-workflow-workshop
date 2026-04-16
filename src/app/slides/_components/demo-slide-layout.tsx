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
  subcopy: string;
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
  subcopy,
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
    <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col gap-8 px-10 pt-20 pb-12">
      <div className="flex items-start justify-between gap-10">
        <div className="flex flex-col gap-2">
          <h2 className="text-[56px] font-semibold leading-[1.0] tracking-tight">
            {headline}
          </h2>
        </div>
        <p className="max-w-[520px] pt-6 text-xl leading-[1.5] text-zinc-400">
          {subcopy}
        </p>
      </div>

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
