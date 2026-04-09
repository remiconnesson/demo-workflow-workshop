"use client";

import { useEffect, useRef, useState } from "react";
import { ORDER_STEPS, type SlideStepState } from "@/lib/order-contract";
import {
  useOrderRun,
  type OrderRunScenario,
  type ResumeBody,
  type WaitStrategy,
} from "@/lib/order-run-client";
import type { OrderEvent } from "@/workflows/place-order";

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

function phaseCardClass(phase: DemoPhase): string {
  switch (phase) {
    case "running":
      return "border-sky-400/30 bg-sky-400/5 text-sky-100";
    case "waiting":
      return "border-amber-400/30 bg-amber-400/5 text-amber-100";
    case "completed":
      return "border-emerald-400/30 bg-emerald-400/5 text-emerald-100";
    case "rolled_back":
      return "border-fuchsia-400/30 bg-fuchsia-400/5 text-fuchsia-100";
    case "error":
      return "border-red-400/30 bg-red-400/5 text-red-100";
    default:
      return "border-white/10 bg-white/5 text-zinc-200";
  }
}

function formatCountdown(ms: number | null): string | null {
  if (ms === null) return null;
  return `${(Math.max(0, ms) / 1000).toFixed(1)}s`;
}

const STATE_STYLE: Record<SlideStepState, string> = {
  pending: "border-white/15 text-zinc-600",
  running: "border-sky-400 text-sky-300",
  waiting: "border-amber-400 text-amber-300",
  success: "border-white bg-white text-black",
  failed: "border-red-500 bg-red-500/10 text-red-400",
  skipped: "border-zinc-800 bg-zinc-900 text-zinc-500",
};

function formatEventLine(event: OrderEvent): { kind: string; msg: string } {
  switch (event.type) {
    case "step_running":
      return { kind: "RUN", msg: `${event.step} \u00b7 ${event.label}` };
    case "step_succeeded":
      return {
        kind: "OK ",
        msg: `${event.step}${event.detail ? ` \u00b7 ${event.detail}` : ""}`,
      };
    case "step_failed":
      return { kind: "ERR", msg: `${event.step} \u00b7 ${event.error}` };
    case "step_skipped":
      return { kind: "SKP", msg: event.step };
    case "waiting_for_hook":
      return {
        kind: "WAI",
        msg: `${event.step} \u00b7 awaiting ${event.token}`,
      };
    case "hook_resolved":
      return {
        kind: "HOK",
        msg: `${event.step}${event.detail ? ` \u00b7 ${event.detail}` : ""}`,
      };
    case "compensation_pushed":
      return {
        kind: "CMP",
        msg: `pushed ${event.action} (for ${event.forStep})`,
      };
    case "compensating":
      return { kind: "CMP", msg: `running ${event.action}` };
    case "compensated":
      return { kind: "CMP", msg: `done ${event.action}` };
    case "log":
      return { kind: "LOG", msg: event.message };
    case "done":
      return { kind: "END", msg: `${event.status} \u00b7 ${event.orderId}` };
  }
}

function kindColor(kind: string): string {
  switch (kind) {
    case "OK ":
      return "text-emerald-400";
    case "ERR":
      return "text-red-400";
    case "WAI":
    case "HOK":
      return "text-amber-400";
    case "CMP":
      return "text-fuchsia-400";
    case "RUN":
      return "text-sky-400";
    case "END":
      return "text-white";
    default:
      return "text-zinc-500";
  }
}

function WaitStatePanel({
  step,
  strategy,
  countdownLabel,
  driverTimeout,
}: {
  step: string;
  strategy: WaitStrategy;
  countdownLabel: string | null;
  driverTimeout?: string;
}) {
  const tone =
    strategy === "manual"
      ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
      : strategy === "silent"
        ? "border-fuchsia-400/30 bg-fuchsia-400/10 text-fuchsia-100"
        : strategy === "scripted"
          ? "border-sky-400/30 bg-sky-400/10 text-sky-100"
          : "border-emerald-400/30 bg-emerald-400/10 text-emerald-100";

  const title =
    strategy === "manual"
      ? "Manual decision required"
      : strategy === "silent"
        ? "Timeout is deciding"
        : strategy === "scripted"
          ? "Scripted response queued"
          : "Auto-resume queued";

  const detail =
    strategy === "manual"
      ? `Use the controls below to resume ${step} with a real hook payload.`
      : strategy === "silent"
        ? `The workflow is intentionally dormant at ${step}. No controls are shown; timeout is armed for ${driverTimeout ?? "2m"}.`
        : strategy === "scripted"
          ? `This slide will send the next hook payload automatically in ${countdownLabel ?? "\u2026"} so one presenter click demonstrates the concept cleanly.`
          : `This hook is real. Auto-ack will resume it in ${countdownLabel ?? "\u2026"} to keep the run moving.`;

  const pill =
    strategy === "silent" ? (driverTimeout ?? "2m") : (countdownLabel ?? "queued");

  return (
    <div
      className={`mt-4 rounded-xl border px-4 py-3 transition-all duration-300 ${tone}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.2em]">
            {title}
          </div>
          <div className="mt-2 text-sm text-zinc-200">{detail}</div>
        </div>
        <div className="rounded-full border border-white/15 bg-black/30 px-3 py-1 font-mono text-xs animate-pulse">
          {pill}
        </div>
      </div>
    </div>
  );
}

export function LiveOrderConceptLab({
  slide,
  scenario,
}: {
  slide: string;
  scenario: OrderRunScenario;
}) {
  const controller = useOrderRun(`slides/${slide}`, scenario);
  const [clockNow, setClockNow] = useState(() => performance.now());

  // countdown ticker for auto-resume
  useEffect(() => {
    if (controller.autoResumeAt === null) return;
    const t = window.setInterval(() => setClockNow(performance.now()), 50);
    return () => window.clearInterval(t);
  }, [controller.autoResumeAt]);

  const phase = getDemoPhase({
    running: controller.running,
    waitingOn: controller.waitingOn,
    doneStatus: controller.doneStatus,
    error: controller.error,
  });

  const countdownLabel = formatCountdown(
    controller.autoResumeAt === null
      ? null
      : controller.autoResumeAt - clockNow,
  );

  const waitStrategy = controller.waitStrategy;
  const showManualControls =
    controller.waitingOn !== null && waitStrategy === "manual";

  const scenarioChips = [
    `fail:${scenario.input.failAt ?? "none"}`,
    `autoAck:${scenario.input.autoAck ? "on" : "manual"}`,
    `mode:${scenario.input.demoMode ?? "standard"}`,
    ...(scenario.scriptedResumes?.length
      ? [
          `scripted:${scenario.scriptedResumes.map(({ step }) => step).join(",")}`,
        ]
      : []),
    ...(scenario.silentWaitingSteps?.length
      ? [`silent:${scenario.silentWaitingSteps.join(",")}`]
      : []),
    ...(scenario.input.driverTimeout && scenario.input.driverTimeout !== "2m"
      ? [`driverTimeout:${scenario.input.driverTimeout}`]
      : []),
  ];

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

  const manualResume = async (body: ResumeBody) => {
    console.info("[slide-live] manual_resume", {
      slide,
      scenarioId: scenario.scenarioId,
      body,
    });
    await controller.resume(body);
  };

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {scenario.title}
          </div>
          {scenario.subtitle ? (
            <div className="mt-2 text-lg text-zinc-400">
              {scenario.subtitle}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void controller.start()}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:border-white/30 hover:text-white transition-colors"
          >
            Run
          </button>
          <button
            onClick={() => controller.reset()}
            className="rounded-lg border border-white/10 px-4 py-2 text-sm hover:border-white/30 hover:text-white transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* phase card */}
      <div className={`mt-6 rounded-xl border p-4 ${phaseCardClass(phase)}`}>
        <div className="flex flex-wrap gap-2">
          {scenarioChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full border border-white/10 bg-black/20 px-3 py-1 font-mono text-xs text-zinc-200"
            >
              {chip}
            </span>
          ))}
        </div>
        <div className="mt-3 text-sm font-semibold uppercase tracking-[0.2em]">
          {phase === "idle" && "Ready"}
          {phase === "running" && "Streaming live"}
          {phase === "waiting" &&
            (waitStrategy === "scripted"
              ? `Scripted wait at ${controller.waitingOn}`
              : waitStrategy === "autoAck"
                ? `Auto-resume at ${controller.waitingOn}`
                : waitStrategy === "silent"
                  ? `Silent wait at ${controller.waitingOn}`
                  : `Paused at ${controller.waitingOn}`)}
          {phase === "completed" && "Workflow completed"}
          {phase === "rolled_back" && "Workflow rolled back"}
          {phase === "error" && "Connection issue"}
        </div>
        <div className="mt-2 text-sm text-zinc-300">
          {phase === "idle" && "Press Run to start the real workflow."}
          {phase === "running" &&
            `${controller.events.length} events received.`}
          {phase === "waiting" &&
            (waitStrategy === "scripted"
              ? `Scripted response in ${countdownLabel ?? "\u2026"}`
              : waitStrategy === "autoAck"
                ? `Auto-resume in ${countdownLabel ?? "\u2026"}`
                : waitStrategy === "silent"
                  ? `Waiting for driver response. Timeout armed for ${scenario.input.driverTimeout ?? "2m"}.`
                  : "Resume from the hook controls below.")}
          {phase === "completed" &&
            `Run ${controller.runId ?? "\u2014"} finished successfully.`}
          {phase === "rolled_back" &&
            (controller.compensations.length > 0
              ? `Compensations: ${controller.compensations.join(" \u2192 ")}`
              : "Rollback completed.")}
          {phase === "error" && controller.error}
        </div>
        {controller.resumeToast ? (
          <div className="mt-3 rounded-lg border border-emerald-400/30 bg-emerald-400/5 px-4 py-3 text-sm text-emerald-200">
            {controller.resumeToast}
          </div>
        ) : null}
        {phase === "waiting" && controller.waitingOn && waitStrategy ? (
          <WaitStatePanel
            step={controller.waitingOn}
            strategy={waitStrategy}
            countdownLabel={countdownLabel}
            driverTimeout={scenario.input.driverTimeout}
          />
        ) : null}
      </div>

      {/* step timeline */}
      <div className="mt-8 flex flex-wrap gap-4">
        {ORDER_STEPS.map((step) => {
          const state = controller.stepState[step.id] ?? "pending";
          return (
            <div key={step.id} className="min-w-[130px] flex-1">
              <div
                className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-semibold ${STATE_STYLE[state]}`}
              >
                {state === "success"
                  ? "\u25B2"
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
              <div className="mt-3 text-lg font-semibold">{step.label}</div>
              <div className="text-sm uppercase tracking-[0.12em] text-zinc-500">
                {state}
              </div>
            </div>
          );
        })}
      </div>

      {/* manual hook controls */}
      {showManualControls ? (
        <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
            Waiting on {controller.waitingOn}
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

      {/* event feed */}
      <div className="mt-8 rounded-xl border border-white/10 bg-black p-4 font-mono text-sm max-h-[400px] overflow-y-auto">
        {controller.events.length === 0 ? (
          <div className="text-zinc-600">No events yet.</div>
        ) : (
          controller.events.map((event, index) => {
            const line = formatEventLine(event);
            return (
              <div key={index} className="flex gap-4 py-1">
                <span
                  className={`w-10 shrink-0 font-semibold ${kindColor(line.kind)}`}
                >
                  {line.kind}
                </span>
                <span className="text-zinc-200">{line.msg}</span>
              </div>
            );
          })
        )}
      </div>

      {/* compensations */}
      {controller.compensations.length > 0 ? (
        <div className="mt-6 flex flex-wrap gap-3">
          {controller.compensations.map((action) => (
            <span
              key={action}
              className="rounded-full border border-fuchsia-400/40 bg-black px-4 py-2 font-mono text-sm text-fuchsia-200"
            >
              {action}
            </span>
          ))}
        </div>
      ) : null}

      {/* error display */}
      {controller.error ? (
        <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
          {controller.error}
        </div>
      ) : null}
    </div>
  );
}
