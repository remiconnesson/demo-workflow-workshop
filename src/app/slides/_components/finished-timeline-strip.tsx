import { ClipboardCheck, CreditCard, ChefHat, Bike, MapPin, Receipt } from "lucide-react";
import { ORDER_STEPS, type OrderStepId } from "@/lib/order-contract";
import { isAgentGroupSlug, type SlideGroupSlug } from "../_data/agent-groups";
import type { ScenarioGroupSlug } from "../_data/scenario-groups";

const STEP_ICON: Record<OrderStepId, React.ReactNode> = {
  validateOrder: <ClipboardCheck size={16} strokeWidth={2.5} />,
  chargeCard: <CreditCard size={16} strokeWidth={2.5} />,
  pingRestaurant: <ChefHat size={16} strokeWidth={2.5} />,
  findDriver: <Bike size={16} strokeWidth={2.5} />,
  trackDelivery: <MapPin size={16} strokeWidth={2.5} />,
  sendReceipts: <Receipt size={16} strokeWidth={2.5} />,
};

type BadgeTone = "red" | "amber" | "fuchsia" | "sky";
type Badge = { label: string; tone: BadgeTone };

const TONE_CLASS: Record<BadgeTone, string> = {
  red: "border-red-400 bg-red-500 text-white shadow-[0_0_24px_rgba(248,113,113,0.6)]",
  amber: "border-amber-300 bg-amber-400 text-black shadow-[0_0_24px_rgba(252,211,77,0.55)]",
  fuchsia: "border-fuchsia-400 bg-fuchsia-500 text-white shadow-[0_0_24px_rgba(232,121,249,0.55)]",
  sky: "border-sky-400 bg-sky-500 text-white shadow-[0_0_24px_rgba(56,189,248,0.6)]",
};

// Finished-state snapshot of each scenario's dynamic affordance (same label,
// same tone as the live badge in LiveOrderConceptLab), frozen for naive/fix.
const AFFORDANCES: Record<ScenarioGroupSlug, Partial<Record<OrderStepId, Badge>>> = {
  "retry": {
    chargeCard: { label: "×2", tone: "red" },
  },
  "suspend": {
    pingRestaurant: { label: "waiting…", tone: "amber" },
  },
  "rollback": {
    sendReceipts: { label: "disputed", tone: "fuchsia" },
  },
};

type FinishedTimelineStripProps = {
  slide: SlideGroupSlug;
  highlightSteps?: OrderStepId[];
};

/**
 * Static "finished" snapshot of the demo timeline. All six steps shown in
 * their success state, with the same scenario badge that appears live during
 * the demo. Lets the -naive and -fix slides visually anchor back to the demo
 * beat the audience just watched.
 */
export function FinishedTimelineStrip({
  slide,
  highlightSteps,
}: FinishedTimelineStripProps) {
  // Agent-group slugs don't have a phone/order timeline, so render a neutral
  // spacer instead of crashing. Layouts normally skip this component for
  // agent slugs; this is the defensive fallback.
  if (isAgentGroupSlug(slide)) {
    return <div aria-hidden className="min-h-[108px]" />;
  }

  const badges = AFFORDANCES[slide as ScenarioGroupSlug] ?? {};

  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-950/60 px-8 py-5 opacity-60">
      <div className="relative grid grid-cols-6 gap-4">
        {/* Connecting line, behind nodes, clipped by node backgrounds */}
        <div className="pointer-events-none absolute left-8 right-8 top-[18px] h-px bg-white/15" />
        {ORDER_STEPS.map((step) => {
          const badge = badges[step.id];
          const dimmed = highlightSteps && !highlightSteps.includes(step.id) && !badge;
          return (
            <div
              key={step.id}
              className={`relative min-w-0 text-center transition-opacity duration-500 ${dimmed ? "opacity-25" : ""}`}
            >
              <div className="relative inline-flex justify-center">
                <div
                  className={`pointer-events-none absolute -top-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-[1px] font-mono text-xs font-bold transition-opacity duration-500 ${
                    badge ? TONE_CLASS[badge.tone] : "border-transparent bg-transparent text-transparent"
                  } ${badge ? "opacity-100" : "opacity-0"}`}
                >
                  {badge?.label ?? "·"}
                </div>
                <div className="relative flex h-9 w-9 items-center justify-center rounded-full border-2 border-white bg-white text-black">
                  {STEP_ICON[step.id]}
                </div>
              </div>
              <div className="mt-2 text-sm font-semibold text-zinc-300">{step.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
