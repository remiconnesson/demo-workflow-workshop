"use client";

import { useEffect, useRef, useState } from "react";
import { ORDER_STEPS, type SlideStepState, type CompensationAction } from "@/lib/order-contract";
import { ClipboardCheck, CreditCard, ChefHat, Bike, MapPin, Receipt } from "lucide-react";
import type { OrderStepId } from "@/lib/order-contract";

const STEP_ICON: Record<OrderStepId, React.ReactNode> = {
  validateOrder: <ClipboardCheck size={24} strokeWidth={2.5} />,
  chargePayment: <CreditCard size={24} strokeWidth={2.5} />,
  notifyRestaurant: <ChefHat size={24} strokeWidth={2.5} />,
  assignDriver: <Bike size={24} strokeWidth={2.5} />,
  trackDelivery: <MapPin size={24} strokeWidth={2.5} />,
  sendReceipt: <Receipt size={24} strokeWidth={2.5} />,
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

const GLOW_STYLE: Record<SlideStepState, string> = {
  pending: "bg-transparent",
  running: "bg-sky-400/30 animate-pulse",
  waiting: "bg-amber-400/30 animate-pulse",
  success: "bg-white/15",
  failed: "bg-red-400/30 animate-pulse",
  skipped: "bg-transparent",
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

  // Count chargePayment successes — naiveDoubleCharge emits step_succeeded twice.
  const chargeCount = controller.events.reduce(
    (n, e) => (e.type === "step_succeeded" && e.step === "chargePayment" ? n + 1 : n),
    0,
  );
  // Count chargePayment failures — naiveDoubleCharge emits step_failed on attempt 1.
  const chargeFailed = controller.events.some(
    (e) => e.type === "step_failed" && e.step === "chargePayment",
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

  // Live cost ticker for the slow-restaurant wait — dramatizes the naive
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
        return badges.length > 0 ? { chargePayment: badges } : {};
      }
      case "suspend":
        if (controller.waitingOn === "notifyRestaurant") {
          return { notifyRestaurant: [{ label: "waiting", tone: "amber", pulse: true }] };
        }
        return {};
      case "rollback":
        if (compensationFired || phase === "rolled_back") {
          return { sendReceipt: [{ label: "disputed", tone: "fuchsia", pulse: true }] };
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
      <div className="flex items-center justify-between gap-4 min-h-[88px]">
        {/* hook controls on the left — only visible when actively waiting */}
        {showManualControls ? (
          <div className="flex items-center gap-4 rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-3">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300 whitespace-nowrap">
              Waiting on Restaurant
            </div>
            <div className="flex flex-wrap gap-3">
              {controller.waitingOn === "notifyRestaurant" ? (
                <>
                  <button
                    onClick={() =>
                      void manualResume({
                        kind: "restaurant-accept",
                        accepted: true,
                      })
                    }
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
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
                    className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300"
                  >
                    Reject
                  </button>
                </>
              ) : null}
              {controller.waitingOn === "assignDriver" ? (
                <>
                  <button
                    onClick={() =>
                      void manualResume({
                        kind: "driver-accept",
                        accepted: true,
                      })
                    }
                    className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
                  >
                    Driver accept
                  </button>
                  <button
                    onClick={() =>
                      void manualResume({
                        kind: "driver-accept",
                        accepted: false,
                      })
                    }
                    className="rounded-lg border border-red-500/40 px-4 py-2 text-sm text-red-300"
                  >
                    Driver reject
                  </button>
                </>
              ) : null}
              {controller.waitingOn === "trackDelivery" ? (
                <button
                  onClick={() => void manualResume({ kind: "delivered" })}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black"
                >
                  Mark delivered
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          <div className="flex-1">
            <div className="text-3xl text-white/80 h-[88px] overflow-hidden line-clamp-2">
              {scenario.subtitle ?? scenario.title}
            </div>
          </div>
        )}
        <div className="flex gap-2">
          <button
            onClick={() => void controller.start()}
            disabled={controller.running}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
              controller.running
                ? "border border-white/10 text-zinc-500 cursor-not-allowed"
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
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-2 text-sm text-red-300 hover:border-red-400 hover:text-red-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              💥 Crash
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
              className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-sm text-amber-300 hover:border-amber-400 hover:text-amber-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
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
              className="rounded-lg border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-2 text-sm text-fuchsia-300 hover:border-fuchsia-400 hover:text-fuchsia-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Dispute order
            </button>
          ) : null}
          <button
            onClick={() => controller.reset()}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:border-white/30 hover:text-white transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* crash overlay — dims the lab during crash/replay */}
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

      {/* progress bar — fills based on completed steps */}
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

      {/* sleep cost comparison — split counter during durable sleep */}
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
          return (
            <div key={step.id} className={`min-w-0 text-center transition-opacity duration-500 ${dimmed ? "opacity-25" : ""}`}>
              <div className="relative inline-flex justify-center">
                {/* Scenario affordance badges — opacity-gated to avoid CLS */}
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
                {/* Glow layer — always in DOM, visibility via bg color */}
                <div className={`absolute -inset-3 rounded-full blur-xl transition-colors duration-500 ${GLOW_STYLE[state]}`} />
                {/* Node */}
                <div
                  className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-semibold transition-all duration-500 ${STATE_STYLE[state]}`}
                >
                  {state === "success"
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
              <div className="mt-3 text-lg font-semibold">{step.label}</div>
            </div>
          );
        })}
      </div>
      )}


      {/* event feed removed — events broadcast to debug drawer via slide:workflow-events */}

      {/* compensations — all slots pre-rendered, fade individually */}
      {showCompensations && (
        <div className="mt-6 flex flex-wrap gap-3 min-h-[40px]">
          {ALL_COMPENSATIONS.map((action) => (
            <span
              key={action}
              className={`rounded-full border border-fuchsia-400/40 bg-black px-4 py-2 font-mono text-sm text-fuchsia-200 transition-opacity duration-300 ${
                controller.compensations.includes(action) ? "opacity-100" : "opacity-0"
              }`}
            >
              {action}
            </span>
          ))}
        </div>
      )}

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
