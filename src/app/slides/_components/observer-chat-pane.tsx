"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Search, BarChart3, FileText, Check } from "lucide-react";
import { AgentDebugDrawer, type DebugEvent } from "./agent-debug-drawer";
import { useSlidesDebug } from "./slides-debug-context";

// ---------------------------------------------------------------------------
// Observer demo, chat-window edition.
//
// Same scripted frame machine as the original (stage-safe cadence), but
// rendered as a chat thread so the audience reads a language they already
// know from first-agent and analyst: bubbles, tool-call pills, a clear
// status banner. Big overlays call out the three beats:
//   SERVER DIES  →  RETRYING (replay)  →  RESUMED
// ---------------------------------------------------------------------------

type ToolId = "scan" | "analyze" | "report";
type ToolState = "pending" | "running" | "success" | "replayed";
type CrashPhase = "live" | "crashed" | "replaying" | "resumed";

const TOOLS: Record<ToolId, { label: string; icon: React.ReactNode; args: string }> = {
  scan:    { label: "fetchRecentOrders", icon: <Search size={16} strokeWidth={2.5} />,  args: "limit: 25" },
  analyze: { label: "analyzeWindow",     icon: <BarChart3 size={16} strokeWidth={2.5} />, args: "orders: [25]" },
  report:  { label: "appendToReport",    icon: <FileText size={16} strokeWidth={2.5} />,  args: "entries: [3]" },
};

type Frame = {
  tools: Record<ToolId, ToolState>;
  loop: number;           // 0 = idle, 1 = first loop, 2 = second loop
  sleeping: boolean;
  crashPhase: CrashPhase;
  crashReady: boolean;
  activeTool: ToolId | null;
  delayMs: number;        // 0 = wait for manual trigger
};

const f = (
  tools: [ToolState, ToolState, ToolState],
  rest: Omit<Frame, "tools">,
): Frame => ({
  tools: { scan: tools[0], analyze: tools[1], report: tools[2] },
  ...rest,
});

const FRAMES: Frame[] = [
  // 0: idle
  f(["pending", "pending", "pending"], {
    loop: 0, sleeping: false, crashPhase: "live",
    crashReady: false, activeTool: null, delayMs: 0,
  }),

  // ── Loop 1 ──────────────────────────────────────────────
  // 1: scan running
  f(["running", "pending", "pending"], {
    loop: 1, sleeping: false, crashPhase: "live",
    crashReady: false, activeTool: "scan", delayMs: 1500,
  }),
  // 2: scan done, analyze running
  f(["success", "running", "pending"], {
    loop: 1, sleeping: false, crashPhase: "live",
    crashReady: false, activeTool: "analyze", delayMs: 2000,
  }),
  // 3: analyze done, report running
  f(["success", "success", "running"], {
    loop: 1, sleeping: false, crashPhase: "live",
    crashReady: false, activeTool: "report", delayMs: 1500,
  }),
  // 4: loop 1 done, sleeping
  f(["success", "success", "success"], {
    loop: 1, sleeping: true, crashPhase: "live",
    crashReady: false, activeTool: null, delayMs: 2500,
  }),

  // ── Loop 2 ──────────────────────────────────────────────
  // 5: scan running (new loop)
  f(["running", "pending", "pending"], {
    loop: 2, sleeping: false, crashPhase: "live",
    crashReady: false, activeTool: "scan", delayMs: 1500,
  }),
  // 6: scan done, analyze running. CRASH WINDOW (button armed)
  f(["success", "running", "pending"], {
    loop: 2, sleeping: false, crashPhase: "live",
    crashReady: true, activeTool: "analyze", delayMs: 9000,
  }),

  // ── Crash arc ───────────────────────────────────────────
  // 7: server down
  f(["success", "running", "pending"], {
    loop: 2, sleeping: false, crashPhase: "crashed",
    crashReady: false, activeTool: "analyze", delayMs: 2500,
  }),
  // 8: replaying event log
  f(["success", "running", "pending"], {
    loop: 2, sleeping: false, crashPhase: "replaying",
    crashReady: false, activeTool: "analyze", delayMs: 1400,
  }),
  // 9 — scan replayed (cached), analyze resumes running
  f(["replayed", "running", "pending"], {
    loop: 2, sleeping: false, crashPhase: "replaying",
    crashReady: false, activeTool: "analyze", delayMs: 1800,
  }),
  // 10 — analyze done, report running (back to live)
  f(["replayed", "success", "running"], {
    loop: 2, sleeping: false, crashPhase: "live",
    crashReady: false, activeTool: "report", delayMs: 1500,
  }),
  // 11 — resumed, fully complete
  f(["replayed", "success", "success"], {
    loop: 2, sleeping: false, crashPhase: "resumed",
    crashReady: false, activeTool: null, delayMs: 0,
  }),
];

const CRASH_FRAME = 7;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ObserverChatPane({ slug = "agent-observer" }: { slug?: string }) {
  const debugOpen = useSlidesDebug();
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

  // Keyboard: r to run, R to reset (via slide layout events)
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
    if (fi !== 1) return;
    let cancelled = false;
    fetch("/api/agent/observer/start", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json: { runId?: string } | null) => {
        if (!cancelled && json?.runId) setRunId(json.runId);
      })
      .catch(() => null);
    return () => { cancelled = true; };
  }, [fi === 1]); // eslint-disable-line react-hooks/exhaustive-deps

  // Derive debug events from frame transitions (drawer only)
  const debugEvents: DebugEvent[] = useMemo(() => {
    const out: DebugEvent[] = [];
    for (let i = 1; i <= fi; i++) {
      const fr = FRAMES[i];
      if (!fr) break;
      if (fr.crashPhase === "crashed") {
        out.push({ kind: "ERR", msg: "server down — process killed" });
        continue;
      }
      if (fr.crashPhase === "replaying" && FRAMES[i - 1]?.crashPhase === "crashed") {
        out.push({ kind: "RPL", msg: "replaying event log…" });
        continue;
      }
      if (fr.sleeping) {
        out.push({ kind: "SLP", msg: "sleep(\"30s\")" });
        continue;
      }
      for (const id of Object.keys(TOOLS) as ToolId[]) {
        const prev = FRAMES[i - 1]?.tools[id];
        const curr = fr.tools[id];
        if (prev === curr) continue;
        const label = TOOLS[id].label;
        if (curr === "running") out.push({ kind: "RUN", msg: label });
        if (curr === "success" && prev === "running") out.push({ kind: "OK ", msg: label });
        if (curr === "replayed") out.push({ kind: "RPL", msg: `${label} · cached` });
      }
    }
    if (fi === FRAMES.length - 1) {
      out.push({ kind: "END", msg: "resumed · 0 steps re-executed" });
    }
    return out;
  }, [fi]);

  const isIdle = fi === 0;
  const isResumed = frame.crashPhase === "resumed";

  // Build chat "history" from frame index — past loops render full,
  // current loop renders live.
  const showLoop1 = fi >= 1;
  const showLoop1Complete = fi >= 4;
  const showSleep = fi === 4;
  const showLoop2 = fi >= 5;

  // Inline system rows. Each stays visible once it's happened so the
  // narrative reads chronologically in the chat history.
  const showCrashRow = fi >= CRASH_FRAME;
  const showReplayRow = fi >= CRASH_FRAME + 1;
  const showResumedRow = isResumed;

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_440px] gap-8 overflow-hidden">
      {/* LEFT — chat surface */}
      <div className="relative flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/10 px-8 py-5">
          <div className="flex items-center gap-4">
            <span
              className={`h-3 w-3 rounded-full transition-colors duration-300 ${
                frame.crashPhase === "crashed"
                  ? "bg-red-400 animate-pulse"
                  : frame.crashPhase === "replaying"
                    ? "bg-sky-400 animate-pulse"
                    : isResumed
                      ? "bg-emerald-400"
                      : isIdle
                        ? "bg-zinc-600"
                        : "bg-emerald-400"
              }`}
            />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Autonomous agent · forever loop
            </span>
            <span
              className={`rounded-full border border-white/10 bg-white/5 px-3 py-0.5 font-mono text-sm tabular-nums text-zinc-300 transition-opacity duration-500 ${
                frame.loop > 0 ? "opacity-100" : "opacity-0"
              }`}
            >
              Loop {frame.loop || 1} / 20
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
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
              type="button"
              onClick={handleReset}
              className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs text-zinc-400 hover:bg-white/10"
            >
              Reset
            </button>
          </div>
        </div>

        {/* chat body */}
        <ChatScroll
          frame={frame}
          showLoop1={showLoop1}
          showLoop1Complete={showLoop1Complete}
          showSleep={showSleep}
          showLoop2={showLoop2}
          showCrashRow={showCrashRow}
          showReplayRow={showReplayRow}
          showResumedRow={showResumedRow}
          fi={fi}
        />

        {/* idle placeholder */}
        {isIdle && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-10">
            <div className="max-w-xl text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Observer demo
              </p>
              <p className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white">
                An autonomous loop.
              </p>
              <p className="mt-4 text-xl leading-relaxed text-zinc-400">
                Three tool calls per turn. Every call is a durable step.
                Press <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">r</kbd> to start.
              </p>
            </div>
          </div>
        )}

      </div>

      {/* RIGHT — kill-server CTA + debug drawer */}
      <aside
        className={`flex min-h-0 flex-col overflow-hidden ${
          debugOpen ? "gap-6" : "justify-center"
        }`}
      >
        <div
          className={`flex flex-col gap-4 rounded-2xl border p-8 transition-colors duration-300 ${
            debugOpen ? "" : "min-h-[340px] justify-center"
          } ${
            frame.crashReady
              ? "border-red-500/40 bg-red-500/10"
              : isResumed
                ? "border-emerald-500/40 bg-emerald-500/10"
                : "border-white/10 bg-zinc-950"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {isResumed ? "The proof" : "The demo"}
          </p>

          {/* pre-crash prompt */}
          <div
            className={`transition-all duration-500 ${
              isResumed ? "h-0 overflow-hidden opacity-0" : "opacity-100"
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
              isResumed ? "opacity-100" : "h-0 overflow-hidden opacity-0"
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

        {debugOpen ? <AgentDebugDrawer runId={runId} events={debugEvents} /> : null}
      </aside>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chat scroll — renders the cumulative conversation based on frame state
// ---------------------------------------------------------------------------

type ChatScrollProps = {
  frame: Frame;
  showLoop1: boolean;
  showLoop1Complete: boolean;
  showSleep: boolean;
  showLoop2: boolean;
  showCrashRow: boolean;
  showReplayRow: boolean;
  showResumedRow: boolean;
  fi: number;
};

function ChatScroll({
  frame,
  showLoop1,
  showLoop1Complete,
  showSleep,
  showLoop2,
  showCrashRow,
  showReplayRow,
  showResumedRow,
  fi,
}: ChatScrollProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [fi]);

  // Loop-1 tool states: at frame 4 (done/sleeping), all three are success.
  // While in loop 1 (fi=1..3), they track the live frame.
  // In loop 2 (fi>=5), loop 1 is complete — all three success.
  const loop1States: Record<ToolId, ToolState> =
    fi >= 4
      ? { scan: "success", analyze: "success", report: "success" }
      : frame.tools;

  const loop2States = frame.tools;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-8">
      {showLoop1 && (
        <LoopBlock
          loopNumber={1}
          toolStates={loop1States}
          activeTool={frame.loop === 1 ? frame.activeTool : null}
          complete={showLoop1Complete}
          crashPhase="live"
        />
      )}

      <SleepDivider visible={showSleep} />

      {showLoop2 && (
        <LoopBlock
          loopNumber={2}
          toolStates={loop2States}
          activeTool={frame.loop === 2 ? frame.activeTool : null}
          complete={frame.crashPhase === "resumed"}
          crashPhase={frame.crashPhase}
        />
      )}

      {/* inline system rows — appear right where the crash happened */}
      {showCrashRow && <SystemRow kind="crash" active={frame.crashPhase === "crashed"} />}
      {showReplayRow && <SystemRow kind="replay" active={frame.crashPhase === "replaying"} />}
      {showResumedRow && <SystemRow kind="resumed" active />}

      <div ref={bottomRef} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Loop block — a "user turn" (the loop prompt) followed by the assistant's
// response: one text bubble and three tool-call pills.
// ---------------------------------------------------------------------------

function LoopBlock({
  loopNumber,
  toolStates,
  activeTool,
  complete,
  crashPhase,
}: {
  loopNumber: number;
  toolStates: Record<ToolId, ToolState>;
  activeTool: ToolId | null;
  complete: boolean;
  crashPhase: CrashPhase;
}) {
  const anyRunning = Object.values(toolStates).some((s) => s === "running");
  const anyReplayed = Object.values(toolStates).some((s) => s === "replayed");
  const isCrashed = crashPhase === "crashed";
  const isReplaying = crashPhase === "replaying";

  return (
    <div className="flex flex-col gap-4">
      {/* loop divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-white/10" />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          Loop {loopNumber}
        </span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* user prompt bubble */}
      <div className="flex justify-end">
        <div className="max-w-[86%] rounded-2xl border border-white/15 bg-white/5 px-6 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Workflow
          </p>
          <p className="mt-2 text-lg leading-[1.35] text-zinc-100">
            Loop {loopNumber} of 20. Fetch recent orders, analyze, append
            report entries.
          </p>
        </div>
      </div>

      {/* assistant bubble */}
      <div className="flex justify-start">
        <div className="max-w-[86%] flex-1 rounded-2xl border border-white/10 bg-black px-6 py-5">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
            Autonomous agent
          </p>
          <p className="mt-2 text-lg leading-[1.35] text-zinc-100">
            {isCrashed
              ? "—"
              : isReplaying
                ? "Reconnecting to the run…"
                : complete
                  ? anyReplayed
                    ? "Picked up where I left off. One tool call replayed from the event log — the other two finished fresh."
                    : "Loop complete. Sleeping until the next window."
                  : anyRunning
                    ? "Scanning recent orders, looking for anomalies, and appending report entries…"
                    : "Running the monitoring loop…"}
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <ToolPill id="scan"    state={toolStates.scan}    isActive={activeTool === "scan"}    crashPhase={crashPhase} />
            <ToolPill id="analyze" state={toolStates.analyze} isActive={activeTool === "analyze"} crashPhase={crashPhase} />
            <ToolPill id="report"  state={toolStates.report}  isActive={activeTool === "report"}  crashPhase={crashPhase} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tool pill — renders running / done / cached (replayed) with clear affordance
// ---------------------------------------------------------------------------

function ToolPill({
  id,
  state,
  isActive,
  crashPhase,
}: {
  id: ToolId;
  state: ToolState;
  isActive: boolean;
  crashPhase: CrashPhase;
}) {
  const tool = TOOLS[id];

  // The running tool during crash/replay gets a special treatment so
  // the kill is visible exactly where it happened.
  const killed = isActive && state === "running" && crashPhase === "crashed";
  const resuming = isActive && state === "running" && crashPhase === "replaying";

  const styles = killed
    ? "border-red-500/60 bg-red-500/10 text-red-200 shadow-[0_0_24px_rgba(248,113,113,0.35)]"
    : resuming
      ? "border-sky-500/60 bg-sky-500/10 text-sky-200 shadow-[0_0_24px_rgba(56,189,248,0.3)]"
      : state === "replayed"
        ? "border-emerald-500/40 bg-emerald-500/5 text-emerald-200"
        : state === "success"
          ? "border-white/15 bg-white/5 text-zinc-200"
          : state === "running"
            ? "border-sky-500/50 bg-sky-500/10 text-sky-200"
            : "border-white/5 bg-white/[0.02] text-zinc-500";

  const dot = killed
    ? "bg-red-400 animate-pulse"
    : resuming
      ? "bg-sky-400 animate-pulse"
      : state === "replayed"
        ? "bg-emerald-400"
        : state === "success"
          ? "bg-emerald-400"
          : state === "running"
            ? "bg-sky-400 animate-pulse"
            : "bg-zinc-700";

  const statusLabel = killed
    ? "killed"
    : resuming
      ? "resuming"
      : state === "running"
        ? "running"
        : state === "success"
          ? "done"
          : state === "replayed"
            ? "replayed"
            : "queued";

  const statusColor = killed
    ? "text-red-300"
    : resuming
      ? "text-sky-300"
      : "text-zinc-500";

  return (
    <div
      className={`flex items-center gap-3 rounded-xl border px-4 py-3 font-mono text-sm transition-all duration-500 ${styles} ${
        isActive && state === "running" && !killed && !resuming
          ? "shadow-[0_0_24px_rgba(56,189,248,0.25)]"
          : ""
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${dot}`} />
      <span className="text-zinc-500">tool</span>
      <span className="text-zinc-400">{tool.icon}</span>
      <span className="tabular-nums text-zinc-100">{tool.label}</span>
      <span className="text-zinc-600">({tool.args})</span>
      <span className="ml-auto flex items-center gap-2">
        {state === "replayed" && (
          <span className="rounded-full border border-emerald-400/60 bg-emerald-500/20 px-2 py-0.5 text-xs font-bold uppercase tracking-[0.15em] text-emerald-200">
            cached
          </span>
        )}
        <span className={`uppercase tracking-[0.15em] ${statusColor}`}>{statusLabel}</span>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sleep divider — an amber chip that marks the sleep(30s) between loops
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// SystemRow — inline "system" chat message calling out the crash, retry,
// and resumed events right where they happened in the timeline.
// ---------------------------------------------------------------------------

type SystemKind = "crash" | "replay" | "resumed";

function SystemRow({ kind, active }: { kind: SystemKind; active: boolean }) {
  const palette = {
    crash: {
      border: "border-red-500/50",
      bg: "bg-red-500/10",
      dot: "bg-red-400",
      label: "text-red-200",
      title: "Server down · process killed",
      subtitle: "Running tool call interrupted mid-analyze.",
      icon: <XIcon />,
    },
    replay: {
      border: "border-sky-500/50",
      bg: "bg-sky-500/10",
      dot: "bg-sky-400",
      label: "text-sky-200",
      title: "Retrying · replaying event log",
      subtitle: "Completed steps return from cache. Zero re-execution.",
      icon: <RetryIcon />,
    },
    resumed: {
      border: "border-emerald-500/50",
      bg: "bg-emerald-500/10",
      dot: "bg-emerald-400",
      label: "text-emerald-200",
      title: "Resumed · 0 steps re-executed",
      subtitle: "Agent picked up exactly where it crashed.",
      icon: <Check size={18} strokeWidth={3} />,
    },
  }[kind];

  const shadow =
    kind === "crash"
      ? "shadow-[0_0_40px_rgba(248,113,113,0.3)]"
      : kind === "replay"
        ? "shadow-[0_0_40px_rgba(56,189,248,0.3)]"
        : "shadow-[0_0_40px_rgba(52,211,153,0.3)]";

  return (
    <div className="flex justify-center">
      <div
        className={`flex items-center gap-4 rounded-2xl border px-6 py-4 ${palette.border} ${palette.bg} ${active ? shadow : ""}`}
      >
        <span
          className={`flex h-8 w-8 items-center justify-center rounded-full ${palette.dot} ${active ? "animate-pulse" : ""} text-black`}
        >
          {palette.icon}
        </span>
        <div className="flex flex-col">
          <span className={`font-mono text-base uppercase tracking-[0.2em] ${palette.label}`}>
            {palette.title}
          </span>
          <span className="font-sans text-sm text-zinc-400">{palette.subtitle}</span>
        </div>
      </div>
    </div>
  );
}

function XIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
    </svg>
  );
}

function SleepDivider({ visible }: { visible: boolean }) {
  return (
    <div
      className={`flex items-center justify-center gap-3 rounded-xl border px-5 py-3 font-mono text-base transition-all duration-500 ${
        visible
          ? "border-amber-400/30 bg-amber-500/5 text-amber-300 opacity-100"
          : "h-0 overflow-hidden border-transparent bg-transparent text-transparent opacity-0"
      }`}
    >
      <span className={`h-2.5 w-2.5 rounded-full bg-amber-400 ${visible ? "animate-pulse" : ""}`} />
      sleep(&quot;30s&quot;) — waiting for next loop
    </div>
  );
}
