"use client";

import { useEffect } from "react";
import { ORDER_STEPS, type SlideStepState } from "@/lib/order-contract";
import {
  useOrderRun,
  type OrderRunScenario,
  type ResumeBody,
} from "@/lib/order-run-client";
import type { OrderEvent } from "@/workflows/place-order";

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

export function LiveOrderConceptLab({
  slide,
  scenario,
}: {
  slide: string;
  scenario: OrderRunScenario;
}) {
  const controller = useOrderRun(`slides/${slide}`, scenario);

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
      {controller.waitingOn && !scenario.input.autoAck ? (
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
