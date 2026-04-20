"use client";

import { useEffect, useRef, useState } from "react";
import { ORDER_STEPS, type SlideStepState, type CompensationAction } from "@/lib/order-contract";
import { ClipboardCheck, CreditCard, ChefHat, Bike, MapPin, Receipt, Undo2 } from "lucide-react";
import type { OrderStepId } from "@/lib/order-contract";

const STEP_ICON: Record<OrderStepId, React.ReactNode> = {
  validateOrder: <ClipboardCheck size={24} strokeWidth={2.5} />,
  chargeCard: <CreditCard size={24} strokeWidth={2.5} />,
  pingRestaurant: <ChefHat size={24} strokeWidth={2.5} />,
  findDriver: <Bike size={24} strokeWidth={2.5} />,
  trackDelivery: <MapPin size={24} strokeWidth={2.5} />,
  sendReceipts: <Receipt size={24} strokeWidth={2.5} />,
};
import {
  useOrderRun,
  type OrderRunScenario,
  type ResumeBody,
} from "@/lib/order-run-client";
import { SleepCostComparison } from "./sleep-cost-comparison";

type DemoPhase =
  | "idle"
  | "running"
  | "waiting"
  | "completed"
  | "rolled_back"
  | "error";

function getDemoPhase(args: {
  running: boolean;
  waitingOn: string | null;
  doneStatus: "completed" | "rolled_back" | null;
  error: string | null;
}): DemoPhase {
  if (args.error) return "error";
  if (args.waitingOn) return "waiting";
  if (args.doneStatus === "completed") return "completed";
  if (args.doneStatus === "rolled_back") return "rolled_back";
  if (args.running) return "running";
  return "idle";
}


const STATE_STYLE: Record<SlideStepState, string> = {
  pending: "border-white/15 text-zinc-600",
  running: "border-sky-400 text-sky-300",
  waiting: "border-amber-400 text-amber-300",
  success: "border-white bg-white text-black",
  failed: "border-red-500 bg-red-500/10 text-red-400",
  skipped: "border-zinc-800 bg-zinc-900 text-zinc-500",
};

const ALL_COMPENSATIONS: CompensationAction[] = [
  "refundPayment",
  "cancelRestaurantOrder",
  "releaseDriver",
];

// Which step each compensation unwinds. Drives the fuchsia "undone" treatment
// on the main timeline (circle color + compensation-name affordance).
const COMPENSATION_FOR_STEP: Partial<Record<OrderStepId, CompensationAction>> = {
  chargeCard: "refundPayment",
  pingRestaurant: "cancelRestaurantOrder",
  findDriver: "releaseDriver",
};

const GLOW_STYLE: Record<SlideStepState, string> = {
  pending: "bg-transparent",
  running: "bg-sky-400/30 animate-pulse",
  waiting: "bg-amber-400/30 animate-pulse",
  success: "bg-white/15",
  failed: "bg-red-400/30 animate-pulse",
  skipped: "bg-transparent",
};

type ConceptCueTone = "sky" | "amber" | "fuchsia" | "emerald" | "zinc";

type ConceptCue = {
  eyebrow: string;
  headline: string;
  detail: string;
  tone: ConceptCueTone;
};

const CONCEPT_CUE_BY_SLIDE: Partial<Record<string, ConceptCue>> = {
  retry: {
    eyebrow: "Stable proof",
    headline: "Same payment step. Two attempts.",
    detail:
      "Watch the charge fail once, retry, and show why duplicate side effects are dangerous.",
    tone: "sky",
  },
  suspend: {
    eyebrow: "Suspendable proof",
    headline: "The workflow parks for a human.",
    detail:
      "The restaurant taps Accept, and the same run resumes from the waiting step.",
    tone: "amber",
  },
  rollback: {
    eyebrow: "Undoable proof",
    headline: "A finished order gets disputed.",
    detail:
      "Let the happy path finish, then trigger the dispute and watch the undo path light up.",
    tone: "fuchsia",
  },
};

const CUE_TONE_CLASS: Record<
  ConceptCueTone,
  {
    card: string;
    dot: string;
    eyebrow: string;
  }
> = {
  sky: {
    card: "border-sky-400/25 bg-sky-500/[0.06]",
    dot: "bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.55)]",
    eyebrow: "text-sky-300",
  },
  amber: {
    card: "border-amber-400/25 bg-amber-500/[0.06]",
    dot: "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]",
    eyebrow: "text-amber-300",
  },
  fuchsia: {
    card: "border-fuchsia-400/25 bg-fuchsia-500/[0.06]",
    dot: "bg-fuchsia-400 shadow-[0_0_18px_rgba(232,121,249,0.55)]",
    eyebrow: "text-fuchsia-300",
  },
  emerald: {
    card: "border-emerald-400/25 bg-emerald-500/[0.06]",
    dot: "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.55)]",
    eyebrow: "text-emerald-300",
  },
  zinc: {
    card: "border-white/10 bg-black/30",
    dot: "bg-zinc-500",
    eyebrow: "text-zinc-500",
  },
};


export function LiveOrderConceptLab({
  slide,
  scenario,
  showTimeline = true,
  showCompensations = true,
  highlightSteps,
  allowCrash = false,
  allowAdminCancel = false,
  allowDispute = false,
  showSleepCost = false,
}: {
  slide: string;
  scenario: OrderRunScenario;
  /** Show the 6-step timeline row. Default true. */
  showTimeline?: boolean;
  /** Show the fuchsia compensation pills. Default true. */
  showCompensations?: boolean;
  /** Only show these steps in the timeline (dim others). */
  highlightSteps?: string[];
  /** Show a 💥 crash button that tears down UI state and replays from the event log. */
  allowCrash?: boolean;
  /** Show an Admin cancel button that resumes the admin-cancel hook via the route. */
  allowAdminCancel?: boolean;
  /** Show a Dispute order button that fires the post-delivery dispute hook. */
  allowDispute?: boolean;
  /** Show the split cost comparison (naive polling vs SDK sleep) during durable sleep. */
  showSleepCost?: boolean;
}) {
  const controller = useOrderRun(`slides/${slide}`, scenario);

  const phase = getDemoPhase({
    running: controller.running,
    waitingOn: controller.waitingOn,
    doneStatus: controller.doneStatus,
    error: controller.error,
  });

  const waitStrategy = controller.waitStrategy;
  const showManualControls =
    controller.waitingOn !== null && waitStrategy === "manual";

  const cue = CONCEPT_CUE_BY_SLIDE[slide] ?? {
    eyebrow: "Live run",
    headline: scenario.title,
    detail: scenario.subtitle || "Press Run to start the workflow.",
    tone: "zinc" as const,
  };
  const cueTone = CUE_TONE_CLASS[cue.tone];

  // Count chargePayment successes. naiveDoubleCharge emits step_succeeded twice.
  const chargeCount = controller.events.reduce(
    (n, e) => (e.type === "step_succeeded" && e.step === "chargeCard" ? n + 1 : n),
    0,
  );
  // Count chargePayment failures. naiveDoubleCharge emits step_failed on attempt 1.
  const chargeFailed = controller.events.some(
    (e) => e.type === "step_failed" && e.step === "chargeCard",
  );

  const compensationFired = controller.compensations.length > 0;

  type BadgeTone = "red" | "amber" | "fuchsia" | "sky" | "emerald";
  type Badge = { label: string; tone: BadgeTone; pulse?: boolean };

  const toneClass: Record<BadgeTone, string> = {
    red: "border-red-400 bg-red-500 text-white shadow-[0_0_24px_rgba(248,113,113,0.6)]",
    amber: "border-amber-300 bg-amber-400 text-black shadow-[0_0_24px_rgba(252,211,77,0.55)]",
    fuchsia: "border-fuchsia-400 bg-fuchsia-500 text-white shadow-[0_0_24px_rgba(232,121,249,0.55)]",
    sky: "border-sky-400 bg-sky-500 text-white shadow-[0_0_24px_rgba(56,189,248,0.6)]",
    emerald: "border-emerald-400 bg-emerald-500 text-white shadow-[0_0_24px_rgba(52,211,153,0.6)]",
  };

  // Derive active step for the status pill
  const activeStep = ORDER_STEPS.find((s) => {
    const st = controller.stepState[s.id];
    return st === "running" || st === "waiting";
  });

  const isResetState = ORDER_STEPS.every((step) => {
    const st = controller.stepState[step.id];
    return st === undefined || st === "pending";
  });

  // Live cost ticker for the slow-restaurant wait. Dramatizes the naive
  // polling cost you WOULD pay without a durable hook.
  const [waitElapsedMs, setWaitElapsedMs] = useState(0);
  useEffect(() => {
    if (!controller.waitingOn) {
      setWaitElapsedMs(0);
      return;
    }
    const start = performance.now();
    const id = window.setInterval(() => {
      setWaitElapsedMs(performance.now() - start);
    }, 120);
    return () => window.clearInterval(id);
  }, [controller.waitingOn]);
  // $60/hr naive compute × 1,000 orders → ~$1/sec across the fleet.
  const waitCost = (waitElapsedMs / 1000) * 1.0;

  // Track the step that was running at the moment of a crash, so we can
  // persist a "replayed" chip on it after recovery.
  const crashedStepRef = useRef<OrderStepId | null>(null);
  useEffect(() => {
    if (controller.crashPhase === "crashed" && !crashedStepRef.current && activeStep) {
      crashedStepRef.current = activeStep.id;
    }
    if (phase === "idle" && isResetState) {
      crashedStepRef.current = null;
    }
  }, [controller.crashPhase, activeStep, phase, isResetState]);

  const stepBadges: Partial<Record<OrderStepId, Badge[]>> = (() => {
    switch (slide) {
      case "retry": {
        const badges: Badge[] = [];
        if (chargeFailed) badges.push({ label: "$", tone: "red" });
        if (chargeCount >= 2) badges.push({ label: "$", tone: "emerald" });
        return badges.length > 0 ? { chargeCard: badges } : {};
      }
      case "suspend":
        if (controller.waitingOn === "pingRestaurant") {
          return { pingRestaurant: [{ label: "waiting", tone: "amber", pulse: true }] };
        }
        return {};
      case "rollback":
        if (compensationFired || phase === "rolled_back") {
          return { sendReceipts: [{ label: "disputed", tone: "fuchsia", pulse: true }] };
        }
        return {};
      default:
        return {};
    }
  })();

  // phase transition logging (signature-guarded to avoid noise)
  const lastPhaseSignatureRef = useRef("");
  useEffect(() => {
    const signature = JSON.stringify({
      phase,
      waitingOn: controller.waitingOn,
      waitStrategy,
      runId: controller.runId,
      orderId: controller.orderId,
    });
    if (signature === lastPhaseSignatureRef.current) return;
    lastPhaseSignatureRef.current = signature;
    console.info("[slide-live] phase", {
      slide,
      scenarioId: scenario.scenarioId,
      phase,
      waitingOn: controller.waitingOn,
      waitStrategy,
      runId: controller.runId,
      orderId: controller.orderId,
      eventCount: controller.events.length,
    });
  }, [
    slide,
    scenario.scenarioId,
    phase,
    controller.waitingOn,
    waitStrategy,
    controller.runId,
    controller.orderId,
    controller.events.length,
  ]);

  // wait-panel log
  useEffect(() => {
    if (phase !== "waiting" || !controller.waitingOn || !waitStrategy) return;
    console.info("[slide-live] wait_panel", {
      slide,
      scenarioId: scenario.scenarioId,
      waitingOn: controller.waitingOn,
      waitStrategy,
      driverTimeout: scenario.input.driverTimeout ?? "2m",
    });
  }, [
    slide,
    scenario.scenarioId,
    phase,
    controller.waitingOn,
    waitStrategy,
    scenario.input.driverTimeout,
  ]);

  // Listen for slide:run and slide:reset keyboard events
  useEffect(() => {
    const onRun = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.slug === slide) void controller.start();
    };
    const onReset = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.slug === slide) controller.reset("keyboard");
    };
    window.addEventListener("slide:run", onRun);
    window.addEventListener("slide:reset", onReset);
    return () => {
      window.removeEventListener("slide:run", onRun);
      window.removeEventListener("slide:reset", onReset);
    };
  }, [controller, slide]);

  useEffect(() => {
    console.info("[slide-live] ready", {
      slide,
      scenarioId: scenario.scenarioId,
    });
    if (scenario.autoStart) {
      void controller.start();
    }
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify layout when a workflow run starts so the debug drawer can show the runId
  useEffect(() => {
    if (controller.runId) {
      window.dispatchEvent(
        new CustomEvent("slide:workflow-started", {
          detail: { runId: controller.runId, orderId: controller.orderId },
        }),
      );
    }
  }, [controller.runId, controller.orderId]);

  // Broadcast events to the debug drawer
  useEffect(() => {
    if (controller.events.length === 0) return;
    window.dispatchEvent(
      new CustomEvent("slide:workflow-events", {
        detail: { events: controller.events },
      }),
    );
  }, [controller.events]);

  const manualResume = async (body: ResumeBody) => {
    console.info("[slide-live] manual_resume", {
      slide,
      scenarioId: scenario.scenarioId,
      body,
    });
    await controller.resume(body);
  };

  return (
    <div className="relative rounded-2xl border border-white/10 bg-zinc-950 p-8 flex flex-col overflow-hidden">
      <div className="grid min-h-[124px] grid-cols-[minmax(0,1fr)_auto] items-stretch gap-5">
        <div
          className={`relative min-w-0 overflow-hidden rounded-2xl border transition-colors duration-500 ${cueTone.card}`}
        >
          {/* Default semantic cue, always occupies the same slot */}
          <div
            className={`absolute inset-0 flex items-center gap-5 px-6 py-5 transition-opacity duration-300 ${
              showManualControls
                ? "pointer-events-none opacity-0"
                : "opacity-100"
            }`}
          >
            <span
              aria-hidden
              className={`h-3.5 w-3.5 shrink-0 rounded-full ${cueTone.dot}`}
            />
            <div className="min-w-0">
              <p
                className={`font-mono text-base font-semibold uppercase tracking-[0.22em] ${cueTone.eyebrow}`}
              >
                {cue.eyebrow}
              </p>
              <p className="mt-1 text-3xl font-semibold leading-tight text-white">
                {cue.headline}
              </p>
              <p className="mt-1 max-w-4xl text-xl leading-snug text-zinc-400">
                {cue.detail}
              </p>
            </div>
          </div>

          {/* Human/manual resume controls, opacity-gated, no layout shift */}
          <div
            className={`absolute inset-0 flex items-center gap-5 px-6 py-5 transition-opacity duration-300 ${
              showManualControls
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
          >
            <div className="min-w-[280px]">
              <p className="font-mono text-base font-semibold uppercase tracking-[0.22em] text-amber-300">
                {controller.waitingOn === "pingRestaurant"
                  ? "Waiting on restaurant"
                  : controller.waitingOn === "findDriver"
                    ? "Waiting on driver"
                    : "Waiting on delivery"}
              </p>
              <p className="mt-1 text-3xl font-semibold leading-tight text-white">
                Human decision required.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {controller.waitingOn === "pingRestaurant" ? (
                <>
                  <button
                    onClick={() =>
                      void manualResume({
                        kind: "restaurant-accept",
                        accepted: true,
                      })
                    }
                    className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() =>
                      void manualResume({
                        kind: "restaurant-accept",
                        accepted: false,
                        reason: "closed",
                      })
                    }
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-3 text-lg font-semibold text-red-300 transition hover:border-red-400 hover:text-red-200"
                  >
                    Reject
                  </button>
                </>
              ) : null}
              {controller.waitingOn === "findDriver" ? (
                <>
                  <button
                    onClick={() =>
                      void manualResume({
                        kind: "driver-accept",
                        accepted: true,
                      })
                    }
                    className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200"
                  >
                    Accept
                  </button>
                  <button
                    onClick={() =>
                      void manualResume({
                        kind: "driver-accept",
                        accepted: false,
                      })
                    }
                    className="rounded-xl border border-red-500/40 bg-red-500/10 px-6 py-3 text-lg font-semibold text-red-300 transition hover:border-red-400 hover:text-red-200"
                  >
                    Decline
                  </button>
                </>
              ) : null}
              {controller.waitingOn === "trackDelivery" ? (
                <button
                  onClick={() => void manualResume({ kind: "delivered" })}
                  className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200"
                >
                  Mark delivered
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-3">
          <button
            onClick={() => void controller.start()}
            disabled={controller.running}
            className={`rounded-xl px-5 py-3 text-base font-semibold transition-all ${
              controller.running
                ? "cursor-not-allowed border border-white/10 text-zinc-500"
                : "bg-white text-black hover:bg-zinc-200"
            }`}
          >
            ▶ Run
          </button>
          {allowCrash ? (
            <button
              onClick={() => void controller.crash()}
              disabled={
                controller.crashPhase !== "live" ||
                !controller.orderId ||
                controller.doneStatus !== null
              }
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-3 text-base font-semibold text-red-300 transition-colors hover:border-red-400 hover:text-red-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Crash
            </button>
          ) : null}
          {allowAdminCancel ? (
            <button
              onClick={() => void controller.adminCancel("support")}
              disabled={
                !controller.running ||
                !controller.orderId ||
                !controller.adminCancelReady ||
                controller.doneStatus !== null
              }
              className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-5 py-3 text-base font-semibold text-amber-300 transition-colors hover:border-amber-400 hover:text-amber-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Admin cancel
            </button>
          ) : null}
          {allowDispute ? (
            <button
              onClick={() => void controller.dispute("never arrived")}
              disabled={
                !controller.running ||
                !controller.orderId ||
                !controller.disputeReady ||
                controller.doneStatus !== null
              }
              className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-5 py-3 text-base font-semibold text-fuchsia-300 transition-colors hover:border-fuchsia-400 hover:text-fuchsia-200 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Dispute order
            </button>
          ) : null}
          <button
            onClick={() => controller.reset()}
            className="rounded-xl border border-white/10 px-5 py-3 text-base font-semibold text-zinc-400 transition-colors hover:border-white/30 hover:text-white"
          >
            Reset
          </button>
        </div>
      </div>

      {/* crash overlay: dims the lab during crash/replay */}
      {allowCrash ? (
        <div
          className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl transition-all duration-500 ${
            controller.crashPhase === "crashed"
              ? "bg-black/70 opacity-100"
              : controller.crashPhase === "replaying"
                ? "bg-black/40 opacity-100"
                : "bg-transparent opacity-0"
          }`}
        >
          {controller.crashMessage ? (
            <div
              className={`rounded-full border px-6 py-3 font-mono text-lg uppercase tracking-[0.2em] transition-colors duration-500 ${
                controller.crashPhase === "crashed"
                  ? "border-red-400/60 bg-black/80 text-red-300"
                  : "border-sky-400/60 bg-black/80 text-sky-300"
              }`}
            >
              {controller.crashMessage}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* progress bar: fills based on completed steps */}
      {(() => {
        const total = ORDER_STEPS.length;
        const done = ORDER_STEPS.filter((s) => {
          const st = controller.stepState[s.id];
          return st === "success" || st === "failed" || st === "skipped";
        }).length;
        const pct = total > 0 ? (done / total) * 100 : 0;
        const barColor =
          phase === "error" ? "bg-red-400" :
          phase === "rolled_back" ? "bg-fuchsia-400" :
          phase === "completed" ? "bg-emerald-400" :
          phase === "waiting" ? "bg-amber-400" :
          phase === "running" ? "bg-sky-400" :
          "bg-white/20";
        return (
          <div className="relative mt-4 h-6">
            {/* track */}
            <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/5" />
            {/* fill */}
            <div
              className={`absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-all duration-700 ease-out ${barColor}`}
              style={{ width: `${pct}%` }}
            />
            <div className="absolute inset-0 grid grid-cols-6 gap-4">
              {ORDER_STEPS.map((step) => {
                const st = controller.stepState[step.id] ?? "pending";
                const finished =
                  st === "success" || st === "failed" || st === "skipped";
                const dotColor =
                  finished ? barColor :
                  st === "running" ? "bg-sky-400 animate-pulse" :
                  st === "waiting" ? "bg-amber-400 animate-pulse" :
                  "bg-zinc-700";
                return (
                  <div key={step.id} className="flex items-center justify-center">
                    <div
                      className={`h-3 w-3 rounded-full border-2 border-zinc-950 transition-colors duration-500 ${dotColor}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* sleep cost comparison: split counter during durable sleep */}
      {showSleepCost && (
        <SleepCostComparison
          stepState={controller.stepState}
          running={controller.running}
        />
      )}

      {/* step timeline with ambient glow */}
      {showTimeline && (
      <div className="mt-8 grid grid-cols-6 gap-4">
        {ORDER_STEPS.map((step) => {
          const state = controller.stepState[step.id] ?? "pending";
          const dimmed = highlightSteps && !highlightSteps.includes(step.id);
          const compensationAction = COMPENSATION_FOR_STEP[step.id as OrderStepId];
          const compensated =
            showCompensations &&
            !!compensationAction &&
            controller.compensations.includes(compensationAction);
          return (
            <div key={step.id} className={`min-w-0 text-center transition-opacity duration-500 ${dimmed ? "opacity-25" : ""}`}>
              <div className="relative inline-flex justify-center">
                {/* Scenario affordance badges, opacity-gated to avoid CLS */}
                {(() => {
                  const badges = stepBadges[step.id];
                  const hasBadges = badges && badges.length > 0;
                  return (
                    <div
                      className={`pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 flex gap-1.5 transition-opacity duration-500 ${
                        hasBadges ? "opacity-100" : "opacity-0"
                      }`}
                    >
                      {hasBadges ? badges.map((badge) => (
                        <div
                          key={badge.tone}
                          className={`whitespace-nowrap rounded-full border-2 px-3 py-0.5 font-mono text-base font-bold ${
                            toneClass[badge.tone]
                          } ${badge.pulse ? "animate-pulse" : ""}`}
                        >
                          {badge.label}
                        </div>
                      )) : (
                        <div className="border-transparent bg-transparent text-transparent rounded-full border-2 px-3 py-0.5 font-mono text-base font-bold">·</div>
                      )}
                    </div>
                  );
                })()}
                {/* Glow layer, always in DOM, visibility via bg color.
                    When compensated, swap to a fuchsia pulse to signal "unwinding". */}
                <div
                  className={`absolute -inset-3 rounded-full blur-xl transition-colors duration-500 ${
                    compensated ? "bg-fuchsia-400/40 animate-pulse" : GLOW_STYLE[state]
                  }`}
                />
                {/* Node: fuchsia compensation skin overrides success white once the undo fires */}
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-semibold transition-all duration-500 ${
                    compensated
                      ? "border-fuchsia-400 bg-fuchsia-500/20 text-fuchsia-200"
                      : STATE_STYLE[state]
                  }`}
                >
                  {compensated ? (
                    <Undo2 size={24} strokeWidth={2.5} />
                  ) : state === "success"
                    ? STEP_ICON[step.id as OrderStepId]
                    : state === "waiting"
                      ? "II"
                      : state === "running"
                        ? "\u25CF"
                        : state === "failed"
                          ? "!"
                          : state === "skipped"
                            ? "\u21BA"
                            : "\u00B7"}
                </div>
              </div>
              <div
                className={`mt-3 text-lg font-semibold transition-colors duration-500 ${
                  compensated ? "text-fuchsia-200 line-through decoration-fuchsia-400/70" : ""
                }`}
              >
                {step.label}
              </div>
              {/* compensation name affordance, always reserves a row to prevent CLS */}
              <div
                className={`mt-1 font-mono text-sm text-fuchsia-300 transition-opacity duration-300 ${
                  compensated ? "opacity-100" : "opacity-0"
                }`}
              >
                {compensationAction ?? "\u00A0"}
              </div>
            </div>
          );
        })}
      </div>
      )}


      {/* event feed removed; events broadcast to debug drawer via slide:workflow-events */}
      {/* compensations now render as an "undo timeline" at the top-right of the card */}

      {/* error display */}
      <div className={`rounded-xl border p-4 text-sm transition-all duration-300 ${
        controller.error
          ? "mt-6 border-red-500/30 bg-red-500/5 text-red-300 opacity-100"
          : "h-0 mt-0 p-0 border-transparent opacity-0 overflow-hidden"
      }`}>
        {controller.error || "\u00A0"}
      </div>

    </div>
  );
}
