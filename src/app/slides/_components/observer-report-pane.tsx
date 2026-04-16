"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Search, BarChart3, FileText } from "lucide-react";
import { AgentDebugDrawer, type DebugEvent } from "./agent-debug-drawer";

// ---------------------------------------------------------------------------
// Tool-call timeline — same visual language as the 6-step order timeline
// in LiveOrderConceptLab, adapted for three agent tool calls.
//
// Scripted frame sequence guarantees stage-safe cadence. The presenter
// presses r to start, watches tool-call nodes light up loop-by-loop,
// then hits the crash button mid-loop-2. The agent replays from the
// durable event log and finishes without re-executing completed steps.
//
// Every affordance here mirrors Act II: nodes with glows, badges,
// progress bar, status pill. The audience reads the same visual
// language they already learned.
// ---------------------------------------------------------------------------

type ToolId = "scan" | "analyze" | "report";
type StepState = "pending" | "running" | "success" | "replayed";
type CrashPhase = "live" | "crashed" | "replaying" | "resumed";

const TOOLS: { id: ToolId; label: string; icon: React.ReactNode }[] = [
  { id: "scan", label: "Scan Orders", icon: <Search size={24} strokeWidth={2.5} /> },
  { id: "analyze", label: "Analyze", icon: <BarChart3 size={24} strokeWidth={2.5} /> },
  { id: "report", label: "Write Report", icon: <FileText size={24} strokeWidth={2.5} /> },
];

const STATE_STYLE: Record<StepState, string> = {
  pending: "border-white/15 text-zinc-600",
  running: "border-sky-400 text-sky-300",
  success: "border-white bg-white text-black",
  replayed: "border-white bg-white text-black",
};

const GLOW_STYLE: Record<StepState, string> = {
  pending: "bg-transparent",
  running: "bg-sky-400/30 animate-pulse",
  success: "bg-white/15",
  replayed: "bg-emerald-400/20",
};

// ---------------------------------------------------------------------------
// Frame-based script — each frame is a full snapshot of visual state.
// The component renders the current frame and auto-advances by timer.
// Frame 6 pauses for the crash button; frame 7+ is the crash/resume arc.
// ---------------------------------------------------------------------------

type Frame = {
  tools: Record<ToolId, StepState>;
  loop: number;
  sleeping: boolean;
  crashPhase: CrashPhase;
  crashMessage: string | null;
  crashReady: boolean;
  statusText: string;
  activeToolLabel: string;
  delayMs: number; // 0 = wait for manual trigger
};

const s = (
  tools: [StepState, StepState, StepState],
  rest: Omit<Frame, "tools">,
): Frame => ({
  tools: { scan: tools[0], analyze: tools[1], report: tools[2] },
  ...rest,
});

const FRAMES: Frame[] = [
  // 0 — idle
  s(["pending", "pending", "pending"], {
    loop: 0, sleeping: false, crashPhase: "live", crashMessage: null,
    crashReady: false, statusText: "", activeToolLabel: "", delayMs: 0,
  }),

  // ── Loop 1 ──────────────────────────────────────────────────
  // 1 — scan running
  s(["running", "pending", "pending"], {
    loop: 1, sleeping: false, crashPhase: "live", crashMessage: null,
    crashReady: false, statusText: "fetchRecentOrders", activeToolLabel: "Scan Orders", delayMs: 1500,
  }),
  // 2 — scan done, analyze running
  s(["success", "running", "pending"], {
    loop: 1, sleeping: false, crashPhase: "live", crashMessage: null,
    crashReady: false, statusText: "analyzeWindow", activeToolLabel: "Analyze", delayMs: 2000,
  }),
  // 3 — analyze done, report running
  s(["success", "success", "running"], {
    loop: 1, sleeping: false, crashPhase: "live", crashMessage: null,
    crashReady: false, statusText: "appendToReport", activeToolLabel: "Write Report", delayMs: 1500,
  }),
  // 4 — all done, sleeping
  s(["success", "success", "success"], {
    loop: 1, sleeping: true, crashPhase: "live", crashMessage: null,
    crashReady: false, statusText: "sleep(\"30s\")", activeToolLabel: "", delayMs: 2500,
  }),

  // ── Loop 2 ──────────────────────────────────────────────────
  // 5 — scan running
  s(["running", "pending", "pending"], {
    loop: 2, sleeping: false, crashPhase: "live", crashMessage: null,
    crashReady: false, statusText: "fetchRecentOrders", activeToolLabel: "Scan Orders", delayMs: 1500,
  }),
  // 6 — scan done, analyze running — CRASH WINDOW
  s(["success", "running", "pending"], {
    loop: 2, sleeping: false, crashPhase: "live", crashMessage: null,
    crashReady: true, statusText: "analyzeWindow", activeToolLabel: "Analyze", delayMs: 8000,
  }),

  // ── Crash arc ───────────────────────────────────────────────
  // 7 — server down
  s(["success", "running", "pending"], {
    loop: 2, sleeping: false, crashPhase: "crashed", crashMessage: "SERVER DOWN",
    crashReady: false, statusText: "", activeToolLabel: "", delayMs: 2500,
  }),
  // 8 — replaying event log
  s(["success", "running", "pending"], {
    loop: 2, sleeping: false, crashPhase: "replaying", crashMessage: "REPLAYING EVENT LOG",
    crashReady: false, statusText: "", activeToolLabel: "", delayMs: 1200,
  }),
  // 9 — scan replayed (instant), analyze resumes
  s(["replayed", "running", "pending"], {
    loop: 2, sleeping: false, crashPhase: "replaying", crashMessage: "REPLAYING EVENT LOG",
    crashReady: false, statusText: "analyzeWindow · resuming", activeToolLabel: "Analyze", delayMs: 1800,
  }),
  // 10 — analyze done, report running
  s(["replayed", "success", "running"], {
    loop: 2, sleeping: false, crashPhase: "live", crashMessage: null,
    crashReady: false, statusText: "appendToReport", activeToolLabel: "Write Report", delayMs: 1500,
  }),
  // 11 — resumed complete
  s(["replayed", "success", "success"], {
    loop: 2, sleeping: false, crashPhase: "resumed", crashMessage: null,
    crashReady: false, statusText: "Resumed · 0 steps re-executed", activeToolLabel: "", delayMs: 0,
  }),
];

const CRASH_FRAME = 7;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ObserverReportPane({ slug = "agent-observer" }: { slug?: string }) {
  const [fi, setFi] = useState(0);
  const frame = FRAMES[fi];

  // Auto-advance timer
  useEffect(() => {
    if (frame.delayMs <= 0) return;
    const id = setTimeout(
      () => setFi((i) => Math.min(i + 1, FRAMES.length - 1)),
      frame.delayMs,
    );
    return () => clearTimeout(id);
  }, [fi, frame.delayMs]);

  const handleStart = useCallback(() => {
    if (fi !== 0) return;
    setFi(1);
  }, [fi]);

  const handleCrash = useCallback(() => {
    if (!frame.crashReady) return;
    setFi(CRASH_FRAME);
  }, [frame.crashReady]);

  const handleReset = useCallback(() => {
    setFi(0);
  }, []);

  // Keyboard: r to run, R to reset
  useEffect(() => {
    const onRun = (e: Event) => {
      if ((e as CustomEvent).detail?.slug === slug) handleStart();
    };
    const onReset = (e: Event) => {
      if ((e as CustomEvent).detail?.slug === slug) handleReset();
    };
    window.addEventListener("slide:run", onRun);
    window.addEventListener("slide:reset", onReset);
    return () => {
      window.removeEventListener("slide:run", onRun);
      window.removeEventListener("slide:reset", onReset);
    };
  }, [slug, handleStart, handleReset]);

  // Fire-and-forget kickoff of the real durable run so the debug drawer
  // shows a real run ID. We don't depend on the run output — the timeline
  // is scripted for stage reliability.
  const [runId, setRunId] = useState<string | undefined>(undefined);
  useEffect(() => {
    if (fi !== 1) return; // only on first start
    let cancelled = false;
    fetch("/api/agent/observer/start", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { runId?: string } | null) => {
        if (!cancelled && json?.runId) setRunId(json.runId);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [fi === 1]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive debug events from frame transitions
  const debugEvents: DebugEvent[] = useMemo(() => {
    const out: DebugEvent[] = [];
    // Walk frames 0..fi and emit events for each state change
    for (let i = 1; i <= fi; i++) {
      const f = FRAMES[i];
      if (!f) break;
      if (f.crashPhase === "crashed") {
        out.push({ kind: "ERR", msg: "server down — process killed" });
        continue;
      }
      if (f.crashPhase === "replaying" && FRAMES[i - 1]?.crashPhase === "crashed") {
        out.push({ kind: "RPL", msg: "replaying event log…" });
        continue;
      }
      if (f.sleeping) {
        out.push({ kind: "SLP", msg: "sleep(\"30s\")" });
        continue;
      }
      for (const tool of TOOLS) {
        const prev = FRAMES[i - 1]?.tools[tool.id];
        const curr = f.tools[tool.id];
        if (prev === curr) continue;
        if (curr === "running") out.push({ kind: "RUN", msg: `${tool.label} · ${f.statusText}` });
        if (curr === "success" && prev === "running") out.push({ kind: "OK ", msg: tool.label });
        if (curr === "replayed") out.push({ kind: "RPL", msg: `${tool.label} · cached` });
      }
    }
    if (fi === FRAMES.length - 1) {
      out.push({ kind: "END", msg: "resumed · 0 steps re-executed" });
    }
    return out;
  }, [fi]);

  // Derived state
  const isIdle = fi === 0;
  const isDone = fi === FRAMES.length - 1;
  const isRunning = fi > 0 && fi < FRAMES.length - 1;

  // Progress: count completed/replayed tools out of 3
  const doneCount = TOOLS.filter(
    (t) => frame.tools[t.id] === "success" || frame.tools[t.id] === "replayed",
  ).length;
  const pct = (doneCount / TOOLS.length) * 100;

  const barColor =
    frame.crashPhase === "crashed" ? "bg-red-400" :
    frame.crashPhase === "replaying" ? "bg-sky-400" :
    frame.crashPhase === "resumed" ? "bg-emerald-400" :
    frame.sleeping ? "bg-amber-400" :
    isDone ? "bg-emerald-400" :
    isRunning ? "bg-sky-400" :
    "bg-white/20";

  // Phase color for the status pill border
  const pillBorder =
    frame.crashPhase === "crashed" ? "border-red-400/30" :
    frame.crashPhase === "replaying" ? "border-sky-400/30" :
    frame.crashPhase === "resumed" ? "border-emerald-400/30" :
    frame.sleeping ? "border-amber-400/30" :
    isDone ? "border-emerald-400/30" :
    isRunning ? "border-sky-400/30" :
    "border-transparent";

  const pillText =
    frame.crashPhase === "crashed" ? "text-red-300" :
    frame.crashPhase === "replaying" ? "text-sky-300" :
    frame.crashPhase === "resumed" ? "text-emerald-300" :
    frame.sleeping ? "text-amber-300" :
    isDone ? "text-emerald-300" :
    "text-sky-300";

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_400px] gap-8 overflow-hidden">
      {/* LEFT — tool-call timeline card */}
      <div className="relative flex flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-8">
        {/* header */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Observer Agent
            </span>
            {/* loop counter badge — always rendered, opacity-gated */}
            <span
              className={`rounded-full border border-white/10 bg-white/5 px-4 py-1 font-mono text-lg tabular-nums text-zinc-300 transition-opacity duration-500 ${
                frame.loop > 0 ? "opacity-100" : "opacity-0"
              }`}
            >
              Loop {frame.loop || 1}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleStart}
              disabled={!isIdle}
              className={`rounded-lg px-4 py-2 text-sm font-semibold transition-all ${
                !isIdle
                  ? "border border-white/10 text-zinc-500 cursor-not-allowed"
                  : "bg-white text-black hover:bg-zinc-200"
              }`}
            >
              ▶ Run
            </button>
            <button
              onClick={handleReset}
              className="rounded-lg border border-white/10 px-4 py-2 text-sm transition-colors hover:border-white/30 hover:text-white"
            >
              Reset
            </button>
          </div>
        </div>

        {/* progress bar */}
        <div className="relative mt-6 h-6">
          <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-white/5" />
          <div
            className={`absolute left-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full transition-all duration-700 ease-out ${barColor}`}
            style={{ width: `${pct}%` }}
          />
          <div className="absolute inset-0 grid grid-cols-3 gap-4">
            {TOOLS.map((tool) => {
              const st = frame.tools[tool.id];
              const finished = st === "success" || st === "replayed";
              const dotColor = finished
                ? barColor
                : st === "running"
                  ? "bg-sky-400 animate-pulse"
                  : "bg-zinc-700";
              return (
                <div key={tool.id} className="flex items-center justify-center">
                  <div
                    className={`h-3 w-3 rounded-full border-2 border-zinc-950 transition-colors duration-500 ${dotColor}`}
                  />
                </div>
              );
            })}
          </div>
        </div>

        {/* sleeping indicator — between progress bar and timeline */}
        <div
          className={`mt-4 flex items-center justify-center gap-3 rounded-xl border px-5 py-3 font-mono text-xl transition-all duration-500 ${
            frame.sleeping
              ? "border-amber-400/30 bg-amber-500/5 text-amber-300 opacity-100"
              : "border-transparent bg-transparent text-transparent opacity-0"
          }`}
        >
          <span className={`h-3 w-3 rounded-full bg-amber-400 ${frame.sleeping ? "animate-pulse" : ""}`} />
          sleep(&quot;30s&quot;) — waiting for next loop
        </div>

        {/* tool-call timeline — 3 nodes with glows + badges */}
        <div className="mt-8 grid grid-cols-3 gap-8">
          {TOOLS.map((tool) => {
            const state = frame.tools[tool.id];
            const isReplayed = state === "replayed";
            return (
              <div key={tool.id} className="min-w-0 text-center">
                <div className="relative inline-flex justify-center">
                  {/* replay badge — opacity-gated, never removed from DOM */}
                  <div
                    className={`pointer-events-none absolute -top-9 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border-2 px-3 py-0.5 font-mono text-base font-bold transition-opacity duration-500 ${
                      isReplayed
                        ? "border-emerald-400 bg-emerald-500 text-white opacity-100 shadow-[0_0_24px_rgba(52,211,153,0.55)]"
                        : "border-transparent bg-transparent text-transparent opacity-0"
                    }`}
                  >
                    cached
                  </div>
                  {/* glow layer */}
                  <div
                    className={`absolute -inset-4 rounded-full blur-xl transition-colors duration-500 ${GLOW_STYLE[state]}`}
                  />
                  {/* node */}
                  <div
                    className={`relative flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 transition-all duration-500 ${STATE_STYLE[state]}`}
                  >
                    {state === "success" || state === "replayed"
                      ? tool.icon
                      : state === "running"
                        ? <span className="text-2xl">{"\u25CF"}</span>
                        : <span className="text-2xl">{"\u00B7"}</span>}
                  </div>
                </div>
                <div className="mt-4 text-xl font-semibold">{tool.label}</div>
                <div className="text-sm uppercase tracking-[0.12em] text-zinc-500">
                  {isReplayed ? "replayed" : state}
                </div>
              </div>
            );
          })}
        </div>

        {/* status pill */}
        <div className="mt-8 flex justify-center">
          <div
            className={`relative h-[52px] min-w-[420px] rounded-full border transition-colors duration-500 ${pillBorder}`}
          >
            <span
              className={`absolute inset-0 flex items-center justify-center whitespace-nowrap font-mono text-2xl transition-opacity duration-500 ${pillText} ${
                frame.statusText ? "opacity-100" : "opacity-0"
              }`}
            >
              {frame.statusText || "\u00A0"}
            </span>
          </div>
        </div>

        {/* crash overlay — dims the card during crash/replay */}
        <div
          className={`pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-2xl transition-all duration-500 ${
            frame.crashPhase === "crashed"
              ? "bg-black/70 opacity-100"
              : frame.crashPhase === "replaying"
                ? "bg-black/40 opacity-100"
                : "bg-transparent opacity-0"
          }`}
        >
          {frame.crashMessage ? (
            <div
              className={`rounded-full border px-8 py-4 font-mono text-2xl uppercase tracking-[0.2em] transition-colors duration-500 ${
                frame.crashPhase === "crashed"
                  ? "border-red-400/60 bg-black/80 text-red-300 shadow-[0_0_40px_rgba(248,113,113,0.4)]"
                  : "border-sky-400/60 bg-black/80 text-sky-300 shadow-[0_0_40px_rgba(56,189,248,0.3)]"
              }`}
            >
              {frame.crashMessage}
            </div>
          ) : null}
        </div>
      </div>

      {/* RIGHT — the demo prompt + durability proof */}
      <aside className="flex min-h-0 flex-col gap-6 overflow-hidden">
        {/* crash prompt card — mirrors first-agent's "Hit F5" card */}
        <div
          className={`flex flex-col gap-4 rounded-2xl border p-8 transition-colors duration-300 ${
            frame.crashReady
              ? "border-red-500/40 bg-red-500/10"
              : frame.crashPhase === "resumed"
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-white/10 bg-zinc-950"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {frame.crashPhase === "resumed" ? "The proof" : "The demo"}
          </p>

          {/* pre-crash prompt */}
          <div
            className={`transition-all duration-500 ${
              frame.crashPhase === "resumed" ? "h-0 overflow-hidden opacity-0" : "opacity-100"
            }`}
          >
            <p className="text-4xl font-semibold leading-[1.05] tracking-tight">
              Kill the server
              <br />
              mid-tool-call.
            </p>
            <p className="mt-3 text-lg leading-relaxed text-zinc-400">
              The agent replays completed steps from the event log and
              resumes exactly where it crashed.
            </p>
          </div>

          {/* post-crash proof */}
          <div
            className={`transition-all duration-500 ${
              frame.crashPhase === "resumed" ? "opacity-100" : "h-0 overflow-hidden opacity-0"
            }`}
          >
            <p className="text-4xl font-semibold leading-[1.05] tracking-tight text-emerald-300">
              Zero re-execution.
            </p>
            <p className="mt-3 text-lg leading-relaxed text-zinc-400">
              Completed tool calls came from the durable event log.
              The agent picked up mid-thought.
            </p>
          </div>

          <button
            type="button"
            onClick={handleCrash}
            disabled={!frame.crashReady}
            className={`mt-2 rounded-xl px-8 py-4 text-xl font-semibold transition-all duration-300 ${
              frame.crashReady
                ? "bg-red-500 text-white shadow-[0_0_30px_rgba(248,113,113,0.4)] hover:bg-red-400"
                : "bg-zinc-900 text-zinc-600 opacity-40"
            }`}
          >
            Kill server
          </button>
        </div>

        {/* debug drawer — inline, not overlapping */}
        <AgentDebugDrawer runId={runId} events={debugEvents} />
      </aside>
    </div>
  );
}
