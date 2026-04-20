"use client";

import { useCallback, useEffect, useState } from "react";
import { useObserverRunId, useSlideRunReset } from "../sentinel-demos/_shared";

// ---------------------------------------------------------------------------
// Fraud-lab shared primitives. Every variant uses the same narrative data
// so the audience can map "that fraud" → "that freeze" across all 25 designs.
// ---------------------------------------------------------------------------

export type Phase =
  | "idle"
  | "live"
  | "armed"
  | "crashed"
  | "replaying"
  | "resumed";

export type Charge = {
  time: string;
  card: string;
  merchant: string;
  amount: string;
  country: string;
  risk: number;
};

export const CHARGES: Charge[] = [
  { time: "14:32:01", card: "•••• 4242", merchant: "Apple Services",    amount: "$12.99",    country: "US", risk: 0.08 },
  { time: "14:32:02", card: "•••• 1117", merchant: "Uber Trip",          amount: "$24.40",    country: "US", risk: 0.11 },
  { time: "14:32:03", card: "•••• 9003", merchant: "Target",             amount: "$87.20",    country: "US", risk: 0.06 },
  { time: "14:32:04", card: "•••• 5541", merchant: "Starbucks #4812",    amount: "$6.80",     country: "US", risk: 0.04 },
  { time: "14:32:05", card: "•••• 2200", merchant: "Shell Oil",          amount: "$48.10",    country: "US", risk: 0.12 },
  { time: "14:32:07", card: "•••• 3384", merchant: "DoorDash",           amount: "$31.42",    country: "US", risk: 0.09 },
  { time: "14:32:08", card: "•••• 7719", merchant: "Netflix",            amount: "$17.99",    country: "US", risk: 0.02 },
  { time: "14:32:10", card: "•••• 6106", merchant: "Amazon Prime",       amount: "$139.00",   country: "US", risk: 0.21 },
  { time: "14:32:11", card: "•••• 0458", merchant: "Home Depot",         amount: "$412.88",   country: "US", risk: 0.34 },
  { time: "14:32:12", card: "•••• 4242", merchant: "Apple Services",     amount: "$0.99",     country: "US", risk: 0.05 },
  { time: "14:32:13", card: "•••• 8891", merchant: "Cryptonome-XYZ",     amount: "$2,400.00", country: "RU", risk: 0.93 },
];

export const FRAUD_CARD = "•••• 8891";
export const FRAUD_MERCHANT = "Cryptonome-XYZ";
export const FRAUD_AMOUNT = "$2,400.00";
export const FRAUD_COUNTRY = "RU";
export const FRAUD_REASON = "3× typical · RU · midday";
export const UPTIME_LABEL = "running since jan 14 · 94 days uptime";
export const STARTING_LOOP = 13_249;

// ---------------------------------------------------------------------------
// Shell: every variant renders inside this. It owns the phase state, the
// kill button, the slide-run listener, the runId for the debug drawer, and
// three reserved overlay slots: idle hint, crash overlay, resumed banner.
// ---------------------------------------------------------------------------

export type ShellRenderProps = {
  phase: Phase;
  fi: number;               // frame index within the variant's timeline
  active: boolean;          // fi > 0
  isCrashed: boolean;
  isReplaying: boolean;
  isResumed: boolean;
  isArmed: boolean;
  // lifecycle hooks the variant uses
  onAdvance: () => void;    // tick forward one frame
  onArm: () => void;        // enter armed phase (audience sees kill button pulse)
  onCrash: () => void;      // jump straight to crashed (e.g. from kill button)
  onReplay: () => void;     // enter replaying phase
  onResume: () => void;     // enter resumed phase
  runId: string | undefined;
};

// ---------------------------------------------------------------------------
// Top strip used by most variants. Uniform counters so the "94-day"
// framing reads the same across all 25 designs.
// ---------------------------------------------------------------------------

export function TopStrip({
  title,
  scanned,
  frozen,
  loop,
  resumed,
}: {
  title: string;
  scanned: number;
  frozen: number;
  loop: number;
  resumed: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-2xl border bg-zinc-950 px-8 py-5 transition-colors duration-500 ${
        resumed ? "border-emerald-500/40 bg-emerald-500/[0.06]" : "border-white/10"
      }`}
    >
      <div className="flex items-center gap-10">
        <div className="flex flex-col">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            fraud sentinel
          </span>
          <span className="text-2xl font-semibold tracking-tight text-white">
            {title}
          </span>
        </div>
        <Counter label="Scanned today" value={`$${scanned.toLocaleString()}`} tone={resumed ? "emerald" : "white"} />
        <Counter label="Frozen" value={frozen.toLocaleString()} tone={resumed ? "emerald" : "red"} />
        <Counter label="p99 score" value="47ms" tone="zinc" />
      </div>
      <div className="flex items-center gap-4">
        <span
          className={`rounded-full border bg-white/5 px-3 py-1 font-mono text-sm tabular-nums transition-colors duration-500 ${
            resumed ? "border-emerald-400/40 text-emerald-200" : "border-white/10 text-zinc-300"
          }`}
        >
          Loop {loop.toLocaleString()}
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          {UPTIME_LABEL}
        </span>
      </div>
    </div>
  );
}

function Counter({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "white" | "red" | "emerald" | "zinc";
}) {
  const color =
    tone === "emerald" ? "text-emerald-200"
    : tone === "red"   ? "text-red-200"
    : tone === "zinc"  ? "text-zinc-400"
    : "text-white";
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {label}
      </span>
      <span className={`font-mono text-3xl tabular-nums transition-colors duration-500 ${color}`}>
        {value}
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// IdleHint · CrashOverlay · ResumedBanner: three reusable absolute-positioned
// overlays variants can drop onto their canvas.
// ---------------------------------------------------------------------------

export function IdleHint({
  eyebrow,
  purpose,
  active,
}: {
  eyebrow: string;
  purpose: string;
  active: boolean;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-black/70 transition-opacity duration-500 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="max-w-2xl text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-red-400">{eyebrow}</p>
        <p className="mt-3 text-4xl font-semibold tracking-tight text-white">{purpose}</p>
        <p className="mt-4 text-base text-zinc-400">
          Press <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">r</kbd> to run · <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">⇧r</kbd> to reset
        </p>
      </div>
    </div>
  );
}

export function CrashOverlay({
  active,
  headline = "server down",
  body = "Process killed mid-score.",
  footer = "Event log intact.",
}: {
  active: boolean;
  headline?: string;
  body?: string;
  footer?: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-red-500/15 backdrop-blur-[1px] transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="rounded-2xl border-2 border-red-500/60 bg-black/85 px-10 py-6 text-center shadow-[0_0_80px_rgba(248,113,113,0.5)]">
        <p className="font-mono text-sm uppercase tracking-[0.3em] text-red-400">{headline}</p>
        <p className="mt-2 text-4xl font-semibold text-red-200">{body}</p>
        <p className="mt-3 text-sm text-zinc-400">{footer}</p>
      </div>
    </div>
  );
}

export function ReplayingChip({ active }: { active: boolean }) {
  return (
    <div
      className={`pointer-events-none absolute top-4 right-4 transition-opacity duration-300 ${
        active ? "opacity-100" : "opacity-0"
      }`}
    >
      <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/40 bg-sky-500/10 px-4 py-1.5 font-mono text-xs uppercase tracking-[0.2em] text-sky-200">
        <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
        replaying event log · 0 re-executions
      </span>
    </div>
  );
}

export function ResumedBanner({
  active,
  headline,
  stat,
}: {
  active: boolean;
  headline: string;
  stat: string;
}) {
  return (
    <div
      className={`pointer-events-none absolute top-24 left-1/2 -translate-x-1/2 transition-all duration-700 ${
        active ? "opacity-100 translate-y-0" : "-translate-y-4 opacity-0"
      }`}
    >
      <div className="rounded-2xl border-2 border-emerald-500/50 bg-emerald-500/10 px-10 py-5 text-center shadow-[0_0_60px_rgba(52,211,153,0.45)]">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-emerald-300">
          crash survived
        </p>
        <p className="mt-2 text-3xl font-semibold text-emerald-100">{headline}</p>
        <p className="mt-2 font-mono text-sm text-emerald-200">{stat}</p>
      </div>
    </div>
  );
}

export function KillButton({
  armed,
  onClick,
  label = "Kill server",
}: {
  armed: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!armed}
      className={`shrink-0 rounded-xl px-8 py-4 text-lg font-semibold transition-all duration-300 ${
        armed
          ? "bg-red-500 text-white shadow-[0_0_40px_rgba(248,113,113,0.6)] hover:bg-red-400 animate-pulse"
          : "bg-zinc-900 text-zinc-600 opacity-40 cursor-not-allowed"
      }`}
    >
      ⚡ {label}
    </button>
  );
}

// ---------------------------------------------------------------------------
// usePhaseMachine: the variant tells us the timings for each beat; we run
// the state machine. This keeps crash-on-kill + resume-auto-advance uniform
// across every variant.
// ---------------------------------------------------------------------------

export type PhaseTimings = {
  armedAfterMs: number;     // how long variant needs to play before we arm kill
  crashHoldMs: number;      // how long the crash is visible before replay starts
  replayHoldMs: number;     // how long replay runs before resumed
};

export const DEFAULT_TIMINGS: PhaseTimings = {
  armedAfterMs: 7_500,
  crashHoldMs: 2_400,
  replayHoldMs: 1_800,
};

export function usePhaseMachine(timings: PhaseTimings = DEFAULT_TIMINGS) {
  const [phase, setPhase] = useState<Phase>("idle");
  const active = phase !== "idle";
  const isArmed = phase === "armed";
  const isCrashed = phase === "crashed";
  const isReplaying = phase === "replaying";
  const isResumed = phase === "resumed";

  const start = useCallback(() => setPhase((p) => (p === "idle" ? "live" : p)), []);
  const reset = useCallback(() => setPhase("idle"), []);
  const crash = useCallback(() => setPhase("crashed"), []);
  const replay = useCallback(() => setPhase("replaying"), []);
  const resume = useCallback(() => setPhase("resumed"), []);

  useSlideRunReset({ onStart: start, onReset: reset });
  const runId = useObserverRunId(active);

  // live → armed after playback time
  useEffect(() => {
    if (phase !== "live") return;
    const id = setTimeout(() => setPhase("armed"), timings.armedAfterMs);
    return () => clearTimeout(id);
  }, [phase, timings.armedAfterMs]);

  // armed → crashed after 12s if the presenter doesn't hit kill
  useEffect(() => {
    if (phase !== "armed") return;
    const id = setTimeout(() => setPhase("crashed"), 12_000);
    return () => clearTimeout(id);
  }, [phase]);

  // crashed → replaying after hold
  useEffect(() => {
    if (phase !== "crashed") return;
    const id = setTimeout(() => setPhase("replaying"), timings.crashHoldMs);
    return () => clearTimeout(id);
  }, [phase, timings.crashHoldMs]);

  // replaying → resumed after hold
  useEffect(() => {
    if (phase !== "replaying") return;
    const id = setTimeout(() => setPhase("resumed"), timings.replayHoldMs);
    return () => clearTimeout(id);
  }, [phase, timings.replayHoldMs]);

  const kill = useCallback(() => {
    if (phase === "armed") crash();
  }, [phase, crash]);

  return {
    phase,
    active,
    isArmed,
    isCrashed,
    isReplaying,
    isResumed,
    runId,
    start,
    reset,
    kill,
    crash,
    replay,
    resume,
  };
}

// ---------------------------------------------------------------------------
// elapsed: monotonically increasing milliseconds since the first `live`
// frame. Variants use this to drive frame-based animations without having
// to manage their own timer.
// ---------------------------------------------------------------------------

export function useElapsed(active: boolean, tickMs: number = 50): number {
  const [t, setT] = useState(0);
  useEffect(() => {
    if (!active) {
      setT(0);
      return;
    }
    const start = performance.now();
    const id = setInterval(() => setT(performance.now() - start), tickMs);
    return () => clearInterval(id);
  }, [active, tickMs]);
  return t;
}
