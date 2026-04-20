"use client";

import type { ReactNode } from "react";
import type { OrderStepId } from "@/lib/order-contract";
import type { OrderRunScenario } from "@/lib/order-run-client";
import {
  AGENT_GROUPS,
  isAgentGroupSlug,
  type AgentVerbMapping,
  type AgentVerbMappingTone,
  type SlideGroupSlug,
} from "../_data/agent-groups";
import { LiveOrderConceptLab } from "./live-order-concept-lab";

const VERB_MAPPING_TONE_CLASS: Record<AgentVerbMappingTone, string> = {
  emerald:
    "border-emerald-400/35 bg-emerald-500/10 text-emerald-300 shadow-[0_0_28px_rgba(52,211,153,0.10)]",
  sky:
    "border-sky-400/35 bg-sky-500/10 text-sky-300 shadow-[0_0_28px_rgba(56,189,248,0.12)]",
  amber:
    "border-amber-400/35 bg-amber-500/10 text-amber-300 shadow-[0_0_28px_rgba(251,191,36,0.12)]",
  fuchsia:
    "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-300 shadow-[0_0_28px_rgba(232,121,249,0.12)]",
  "amber-fuchsia":
    "border-fuchsia-400/35 bg-gradient-to-r from-amber-500/10 to-fuchsia-500/10 text-white shadow-[0_0_28px_rgba(232,121,249,0.12)]",
};

function AgentVerbMappingRow({
  mapping,
}: {
  mapping: AgentVerbMapping | undefined;
}) {
  if (!mapping) return null;
  return (
    <div className="flex min-h-[56px] items-center gap-5">
      <span
        className={`inline-flex shrink-0 items-center rounded-full border px-5 py-2.5 font-mono text-xl font-semibold uppercase tracking-[0.18em] ${VERB_MAPPING_TONE_CLASS[mapping.tone]}`}
      >
        {mapping.label}
      </span>
      <span className="max-w-4xl text-xl leading-snug text-zinc-400">
        {mapping.caption}
      </span>
    </div>
  );
}

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
   * Optional explicit mapping. When absent for agent-group slides,
   * the layout auto-derives it from AGENT_GROUPS.
   */
  verbMapping?: AgentVerbMapping;
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
  verbMapping,
  rightPanel,
}: DemoSlideLayoutProps) {
  const resolvedVerbMapping =
    verbMapping ??
    (isAgentGroupSlug(slide) ? AGENT_GROUPS[slide].verbMapping : undefined);
  return (
    <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col gap-8 px-10 pt-20 pb-12">
      <div className="flex flex-col gap-3">
        <h2 className="text-[56px] font-semibold leading-[1.0] tracking-tight">
          {headline}
        </h2>
        <AgentVerbMappingRow mapping={resolvedVerbMapping} />
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
