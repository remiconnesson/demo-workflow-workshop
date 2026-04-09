"use client";

import {
  ORDER_STEPS,
  type OrderStepId,
  type SlideStepState,
} from "@/lib/order-contract";
import { ScenarioPlayer, type ScenarioFrame } from "./scenario-player";

export type OrderLabLog = {
  kind: "RUN" | "OK " | "ERR" | "SKP" | "WAI" | "HOK" | "CMP" | "LOG";
  msg: string;
};

export type OrderLabFrame = {
  title: string;
  subtitle?: string;
  stepState: Partial<Record<OrderStepId, SlideStepState>>;
  logs: OrderLabLog[];
  callout?: {
    tone: "red" | "emerald" | "sky" | "amber" | "fuchsia";
    title: string;
    body: string;
  };
  compensationOrder?: string[];
};

const NODE_STYLE: Record<SlideStepState, string> = {
  pending: "border-white/15 text-zinc-600",
  running: "border-sky-400 text-sky-300",
  waiting: "border-amber-400 text-amber-300",
  success: "border-white bg-white text-black",
  failed: "border-red-500 bg-red-500/10 text-red-400",
  skipped: "border-zinc-800 bg-zinc-900 text-zinc-500",
};

const LOG_STYLE: Record<OrderLabLog["kind"], string> = {
  RUN: "text-sky-400",
  "OK ": "text-emerald-400",
  ERR: "text-red-400",
  SKP: "text-zinc-500",
  WAI: "text-amber-400",
  HOK: "text-amber-300",
  CMP: "text-fuchsia-400",
  LOG: "text-zinc-500",
};

const CALLOUT_STYLE = {
  red: "border-red-500/30 bg-red-500/5 text-red-200",
  emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-200",
  sky: "border-sky-500/30 bg-sky-500/5 text-sky-200",
  amber: "border-amber-500/30 bg-amber-500/5 text-amber-200",
  fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-200",
} as const;

export function OrderConceptLab({
  slide,
  scenarioId,
  frames,
}: {
  slide: string;
  scenarioId: string;
  frames: ScenarioFrame<OrderLabFrame>[];
}) {
  return (
    <ScenarioPlayer slide={slide} scenarioId={scenarioId} frames={frames}>
      {({ current, playing, play, pause, reset, next, prev }) => (
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                {current.title}
              </div>
              {current.subtitle ? (
                <div className="mt-2 text-lg text-zinc-400">
                  {current.subtitle}
                </div>
              ) : null}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={prev}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:border-white/30"
              >
                Prev
              </button>
              <button
                onClick={playing ? pause : play}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:border-white/30"
              >
                {playing ? "Pause" : "Play"}
              </button>
              <button
                onClick={next}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:border-white/30"
              >
                Next
              </button>
              <button
                onClick={reset}
                className="rounded-lg border border-white/10 px-3 py-2 text-sm text-zinc-300 hover:border-white/30"
              >
                Reset
              </button>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap items-start gap-4">
            {ORDER_STEPS.map((step) => {
              const state = current.stepState[step.id] ?? "pending";
              return (
                <div key={step.id} className="min-w-[130px] flex-1">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-semibold ${NODE_STYLE[state]}`}
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

          <div
            className={`mt-8 rounded-xl border px-5 py-4 min-h-[72px] transition-all duration-300 ${
              current.callout
                ? CALLOUT_STYLE[current.callout.tone]
                : "border-transparent opacity-0"
            }`}
          >
            <div className="text-sm font-semibold uppercase tracking-[0.2em]">
              {current.callout?.title ?? "\u00A0"}
            </div>
            <div className="mt-2 text-base text-zinc-300">
              {current.callout?.body ?? "\u00A0"}
            </div>
          </div>

          <div className="mt-8 rounded-xl border border-white/10 bg-black p-4 font-mono text-sm min-h-[120px]">
            {current.logs.map((log, i) => (
              <div key={i} className="flex gap-4 py-1">
                <span
                  className={`w-10 shrink-0 font-semibold ${LOG_STYLE[log.kind]}`}
                >
                  {log.kind}
                </span>
                <span className="text-zinc-200">{log.msg}</span>
              </div>
            ))}
          </div>

          <div className={`mt-6 flex flex-wrap gap-3 min-h-[40px] transition-opacity duration-300 ${
            current.compensationOrder?.length ? "opacity-100" : "opacity-0"
          }`}>
            {(current.compensationOrder ?? []).map((action) => (
              <span
                key={action}
                className="rounded-full border border-fuchsia-400/40 bg-black px-4 py-2 font-mono text-sm text-fuchsia-200"
              >
                {action}
              </span>
            ))}
          </div>
        </div>
      )}
    </ScenarioPlayer>
  );
}
