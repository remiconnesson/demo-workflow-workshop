"use client";

import { useEffect, useRef } from "react";
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

  // Derive active step for the status pill
  const activeStep = ORDER_STEPS.find((s) => {
    const st = controller.stepState[s.id];
    return st === "running" || st === "waiting";
  });

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {scenario.title}
          </div>
          <div className="mt-2 text-lg text-zinc-400 h-[56px] overflow-hidden line-clamp-2">
            {scenario.subtitle ?? "\u00A0"}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void controller.start()}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:border-white/30 hover:text-white transition-colors"
          >
            Run
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

      {/* step timeline with ambient glow */}
      {showTimeline && (
      <div className="mt-8 grid grid-cols-6 gap-4">
        {ORDER_STEPS.map((step) => {
          const state = controller.stepState[step.id] ?? "pending";
          const dimmed = highlightSteps && !highlightSteps.includes(step.id);
          return (
            <div key={step.id} className={`min-w-0 text-center transition-opacity duration-500 ${dimmed ? "opacity-25" : ""}`}>
              <div className="relative inline-flex justify-center">
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
              <div className="text-sm uppercase tracking-[0.12em] text-zinc-500">
                {state}
              </div>
            </div>
          );
        })}
      </div>
      )}

      {/* status pill — fixed size, content swaps via opacity only */}
      <div className="mt-6 flex justify-center">
        <div className={`relative h-[52px] min-w-[420px] rounded-full border transition-colors duration-500 ${
          phase === "idle" ? "border-transparent" :
          phase === "running" ? "border-sky-400/30" :
          phase === "waiting" ? "border-amber-400/30" :
          phase === "completed" ? "border-emerald-400/30" :
          phase === "rolled_back" ? "border-fuchsia-400/30" :
          phase === "error" ? "border-red-400/30" :
          "border-white/10"
        }`}>
          {/* Each label is absolutely positioned so swapping never shifts layout */}
          {ORDER_STEPS.map((step) => {
            const st = controller.stepState[step.id] ?? "pending";
            const isRunning = st === "running";
            const isWaiting = st === "waiting";
            return (
              <span
                key={step.id}
                className={`absolute inset-0 flex items-center justify-center whitespace-nowrap font-mono text-2xl transition-opacity duration-500 ${
                  isRunning ? "opacity-100 text-sky-300" :
                  isWaiting ? "opacity-100 text-amber-300" :
                  "opacity-0"
                }`}
              >
                {step.label}{isWaiting ? <span className="text-zinc-500 ml-2">· waiting</span> : null}
              </span>
            );
          })}
          <span className={`absolute inset-0 flex items-center justify-center font-mono text-2xl text-emerald-300 transition-opacity duration-500 ${phase === "completed" ? "opacity-100" : "opacity-0"}`}>
            Complete
          </span>
          <span className={`absolute inset-0 flex items-center justify-center font-mono text-2xl text-fuchsia-300 transition-opacity duration-500 ${phase === "rolled_back" ? "opacity-100" : "opacity-0"}`}>
            Rolled back
          </span>
          <span className={`absolute inset-0 flex items-center justify-center font-mono text-2xl text-red-300 transition-opacity duration-500 ${phase === "error" ? "opacity-100" : "opacity-0"}`}>
            Error
          </span>
        </div>
      </div>

      {/* manual hook controls — always rendered when scenario uses manual hooks, visibility via opacity */}
      {!scenario.input.autoAck ? (
        <div className={`mt-6 rounded-xl border p-5 min-h-[100px] transition-all duration-300 ${
          showManualControls
            ? "border-amber-500/30 bg-amber-500/5 opacity-100"
            : "border-white/5 bg-transparent opacity-30"
        }`}>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
            {showManualControls ? `Waiting on ${controller.waitingOn}` : "Hook controls"}
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
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
                  Restaurant accept
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
                  Restaurant reject
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
      ) : null}

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
