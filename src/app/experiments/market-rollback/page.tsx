"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Market · Rollback  ·  Chapter 3
//
// Narrative: ch.2's 2.5x surge is live. The agent fans it out across four
// surfaces (pricing service, driver fleet, customer app banner, internal
// dashboard flag), each returning an ID that will be needed to undo it.
// Then the agent calls watchForBacklash — the workflow SUSPENDS.
//
// A trigger arrives (UI click OR autonomous): driver union post, legal
// flag, or conversion cliff. The runtime resumes the agent with the
// signal. The agent then calls four compensation tools in strict REVERSE
// order, each referencing the forward tool's ID. SOMA lands back at
// 1.5x and an incident report is filed.
//
// Visual grammar: a vertical stack. Forward row (emerald when done) on top,
// compensation row (fuchsia when done) on bottom, connected by a big
// fuchsia "REVERSE UNWIND" arrow that lights up when the trigger fires.
// ---------------------------------------------------------------------------

type ForwardKey =
  | "pushSurgeToPricingService"
  | "notifyDriverFleet"
  | "pushCustomerAppBanner"
  | "flagZoneInternalDashboard";

type CompKey =
  | "retractZoneInternalFlag"
  | "retractCustomerAppBanner"
  | "sendDriverCorrectionNotice"
  | "revertSurgeToBaseline";

type WatchKey = "watchForBacklash";
type ReportKey = "fileIncidentReport";

type AnyKey = ForwardKey | CompKey | WatchKey | ReportKey;

type ToolState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "waiting" }
  | { phase: "done"; summary: string };

type AllTools = Record<AnyKey, ToolState>;

const INITIAL: AllTools = {
  pushSurgeToPricingService: { phase: "idle" },
  notifyDriverFleet: { phase: "idle" },
  pushCustomerAppBanner: { phase: "idle" },
  flagZoneInternalDashboard: { phase: "idle" },
  watchForBacklash: { phase: "idle" },
  retractZoneInternalFlag: { phase: "idle" },
  retractCustomerAppBanner: { phase: "idle" },
  sendDriverCorrectionNotice: { phase: "idle" },
  revertSurgeToBaseline: { phase: "idle" },
  fileIncidentReport: { phase: "idle" },
};

const FORWARD_ORDER: ForwardKey[] = [
  "pushSurgeToPricingService",
  "notifyDriverFleet",
  "pushCustomerAppBanner",
  "flagZoneInternalDashboard",
];

const COMP_ORDER: CompKey[] = [
  "retractZoneInternalFlag",
  "retractCustomerAppBanner",
  "sendDriverCorrectionNotice",
  "revertSurgeToBaseline",
];

const FORWARD_LABELS: Record<ForwardKey, { title: string; subtitle: string }> =
  {
    pushSurgeToPricingService: {
      title: "pushSurgeToPricingService",
      subtitle: "Apply 2.5x at pricing gateway",
    },
    notifyDriverFleet: {
      title: "notifyDriverFleet",
      subtitle: "Push 'earnings boost' to 12 drivers",
    },
    pushCustomerAppBanner: {
      title: "pushCustomerAppBanner",
      subtitle: "Light surge banner to 8.4k customers",
    },
    flagZoneInternalDashboard: {
      title: "flagZoneInternalDashboard",
      subtitle: "Flag zn-soma as AGGRESSIVE_SURGE",
    },
  };

const COMP_LABELS: Record<CompKey, { title: string; subtitle: string; pair: ForwardKey }> = {
  retractZoneInternalFlag: {
    title: "retractZoneInternalFlag",
    subtitle: "Clear ops-heatmap flag",
    pair: "flagZoneInternalDashboard",
  },
  retractCustomerAppBanner: {
    title: "retractCustomerAppBanner",
    subtitle: "Pull customer banner",
    pair: "pushCustomerAppBanner",
  },
  sendDriverCorrectionNotice: {
    title: "sendDriverCorrectionNotice",
    subtitle: "Supersede prior driver push",
    pair: "notifyDriverFleet",
  },
  revertSurgeToBaseline: {
    title: "revertSurgeToBaseline",
    subtitle: "Push 1.5x pricing ticket",
    pair: "pushSurgeToPricingService",
  },
};

type Chunk = {
  type?: string;
  toolName?: string;
  toolCallId?: string;
  output?: unknown;
  errorText?: string;
  input?: unknown;
};

type TriggerSource = "pr" | "legal" | "conversion" | "autonomous";

const TOKEN = "market-rollback:zn-soma";

export default function MarketRollbackPage() {
  const [tools, setTools] = useState<AllTools>(INITIAL);
  const [status, setStatus] = useState<
    | { kind: "idle" }
    | { kind: "rolling-forward"; message: string }
    | { kind: "watching"; message: string }
    | { kind: "triggered"; message: string; source: TriggerSource }
    | { kind: "unwinding"; message: string }
    | { kind: "done"; message: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });
  const [trigger, setTrigger] = useState<null | {
    source: TriggerSource;
    reason: string;
  }>(null);
  const activeToolByCallId = useRef<Map<string, AnyKey>>(new Map());
  const watchArmed = useRef(false);

  const setTool = useCallback((key: AnyKey, next: ToolState) => {
    setTools((prev) => ({ ...prev, [key]: next }));
  }, []);

  const run = useCallback(async () => {
    setTools(INITIAL);
    setTrigger(null);
    watchArmed.current = false;
    setStatus({
      kind: "rolling-forward",
      message: "Agent rolling out approved 2.5x across four surfaces…",
    });
    activeToolByCallId.current.clear();

    let res: Response;
    try {
      res = await fetch("/api/experiments/market-rollback/start", {
        method: "POST",
      });
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
      return;
    }

    if (!res.ok || !res.body) {
      setStatus({ kind: "error", message: `HTTP ${res.status}` });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: Chunk | null = null;
          try {
            chunk = JSON.parse(line) as Chunk;
          } catch {
            continue;
          }
          if (!chunk) continue;
          handleChunk(chunk);
        }
      }
    } catch (err) {
      setStatus({
        kind: "error",
        message: err instanceof Error ? err.message : "Stream error",
      });
      return;
    }

    setStatus((s) => {
      if (s.kind === "error") return s;
      return {
        kind: "done",
        message: "SOMA back at 1.5x baseline · incident report filed.",
      };
    });

    function handleChunk(chunk: Chunk) {
      const t = chunk.type ?? "";
      const callId = chunk.toolCallId ?? "";
      const name = (chunk.toolName ?? "") as AnyKey;

      if (t === "tool-input-start" || t === "tool-input-available") {
        if (isAnyKey(name)) {
          activeToolByCallId.current.set(callId, name);
          if (name === "watchForBacklash") {
            watchArmed.current = true;
            setTool(name, { phase: "waiting" });
            setStatus({
              kind: "watching",
              message:
                "Forward rollout complete · agent watching for backlash",
            });
          } else if (isCompKey(name)) {
            setTool(name, { phase: "running" });
            setStatus({
              kind: "unwinding",
              message: `Reverse unwind · ${name}`,
            });
          } else if (name === "fileIncidentReport") {
            setTool(name, { phase: "running" });
            setStatus({
              kind: "unwinding",
              message: "Filing incident report…",
            });
          } else {
            setTool(name, { phase: "running" });
            setStatus({
              kind: "rolling-forward",
              message: `Rolling out · ${name}`,
            });
          }
        }
        return;
      }

      if (t === "tool-output-available") {
        const key =
          (isAnyKey(name) && name) || activeToolByCallId.current.get(callId);
        if (!key) return;
        const output = chunk.output as Record<string, unknown> | undefined;

        if (key === "watchForBacklash") {
          const source = (output?.source as TriggerSource) ?? "autonomous";
          const reason =
            (typeof output?.reason === "string" && output.reason) ||
            "Backlash detected";
          setTrigger({ source, reason });
          setTool(key, {
            phase: "done",
            summary: `${source.toUpperCase()} · ${reason}`,
          });
          setStatus({
            kind: "triggered",
            message: `Signal: ${source.toUpperCase()} — beginning reverse unwind`,
            source,
          });
          return;
        }

        const summary = summarize(key, output);
        setTool(key, { phase: "done", summary });
        return;
      }
    }
  }, [setTool]);

  const fireTrigger = useCallback(
    async (source: TriggerSource, reason: string) => {
      if (!watchArmed.current) return;
      try {
        await fetch("/api/experiments/market-rollback/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: TOKEN, fired: true, source, reason }),
        });
      } catch (err) {
        setStatus({
          kind: "error",
          message: err instanceof Error ? err.message : "Trigger failed",
        });
      }
    },
    [],
  );

  const running =
    status.kind === "rolling-forward" ||
    status.kind === "watching" ||
    status.kind === "triggered" ||
    status.kind === "unwinding";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black text-white">
      <header className="flex items-baseline justify-between border-b border-white/10 px-12 py-7">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Market · Rollback  ·  Chapter 3
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Backlash hits. Agent unwinds the 2.5x surge in reverse.
          </h1>
          <p className="mt-3 max-w-4xl text-lg text-zinc-400">
            The approved 2.5x surge is live across four surfaces — pricing,
            drivers, customers, ops. Then a{" "}
            <span className="font-mono text-fuchsia-300">
              driver-union post goes viral
            </span>{" "}
            and orders drop 45%. The DurableAgent pops its compensation stack
            and unwinds every forward action{" "}
            <span className="font-mono text-fuchsia-300">in reverse</span> —
            back to a 1.5x baseline, incident report filed.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {running ? "Running…" : "Roll out 2.5x (Fri 7:35pm)"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-6 overflow-hidden px-12 py-6">
        <StatusLine status={status} />

        <div className="flex flex-col gap-4">
          <RowLabel
            label="Forward rollout"
            hint="pushed in order · each returns an undo ID"
            accent="emerald"
          />
          <div className="grid grid-cols-4 gap-4">
            {FORWARD_ORDER.map((k) => (
              <ForwardCard key={k} toolKey={k} state={tools[k]} />
            ))}
          </div>
        </div>

        <ReverseArrow
          active={
            status.kind === "triggered" ||
            status.kind === "unwinding" ||
            status.kind === "done"
          }
        />

        <div className="flex flex-col gap-4">
          <RowLabel
            label="Reverse unwind"
            hint="popped in reverse · each compensates its pair"
            accent="fuchsia"
          />
          <div className="grid grid-cols-4 gap-4">
            {COMP_ORDER.map((k, idx) => (
              <CompCard
                key={k}
                toolKey={k}
                state={tools[k]}
                order={idx + 1}
              />
            ))}
          </div>
        </div>

        <TriggerPanel
          watchState={tools.watchForBacklash}
          reportState={tools.fileIncidentReport}
          trigger={trigger}
          onFire={fireTrigger}
          status={status}
        />
      </div>
    </div>
  );
}

function isAnyKey(x: string): x is AnyKey {
  return (
    x === "pushSurgeToPricingService" ||
    x === "notifyDriverFleet" ||
    x === "pushCustomerAppBanner" ||
    x === "flagZoneInternalDashboard" ||
    x === "watchForBacklash" ||
    x === "retractZoneInternalFlag" ||
    x === "retractCustomerAppBanner" ||
    x === "sendDriverCorrectionNotice" ||
    x === "revertSurgeToBaseline" ||
    x === "fileIncidentReport"
  );
}

function isCompKey(x: string): x is CompKey {
  return (
    x === "retractZoneInternalFlag" ||
    x === "retractCustomerAppBanner" ||
    x === "sendDriverCorrectionNotice" ||
    x === "revertSurgeToBaseline"
  );
}

function summarize(key: AnyKey, output?: Record<string, unknown>): string {
  if (!output) return "ok";
  if (key === "pushSurgeToPricingService") {
    const m = output.multiplier ?? "?";
    const t = (output.pricingTicket as string) ?? "";
    return `2.5x applied · ${t}`;
  }
  if (key === "notifyDriverFleet") {
    const id = (output.noticeId as string) ?? "";
    const n = output.driversNotified ?? "?";
    return `${n} drivers · ${id}`;
  }
  if (key === "pushCustomerAppBanner") {
    const id = (output.bannerId as string) ?? "";
    const n = output.audienceSize ?? "?";
    return `${Number(n).toLocaleString()} customers · ${id}`;
  }
  if (key === "flagZoneInternalDashboard") {
    const id = (output.flagId as string) ?? "";
    return `AGGRESSIVE_SURGE · ${id}`;
  }
  if (key === "retractZoneInternalFlag") {
    const id = (output.flagId as string) ?? "";
    return `cleared · was ${id}`;
  }
  if (key === "retractCustomerAppBanner") {
    const id = (output.bannerId as string) ?? "";
    return `pulled · was ${id}`;
  }
  if (key === "sendDriverCorrectionNotice") {
    const id = (output.supersedes as string) ?? "";
    return `correction sent · supersedes ${id}`;
  }
  if (key === "revertSurgeToBaseline") {
    const m = output.multiplier ?? "?";
    const t = (output.pricingTicket as string) ?? "";
    return `${m}x applied · ${t}`;
  }
  if (key === "fileIncidentReport") {
    const id = (output.reportId as string) ?? "";
    return `filed · ${id}`;
  }
  return "ok";
}

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------

function StatusLine({
  status,
}: {
  status:
    | { kind: "idle" }
    | { kind: "rolling-forward"; message: string }
    | { kind: "watching"; message: string }
    | { kind: "triggered"; message: string; source: TriggerSource }
    | { kind: "unwinding"; message: string }
    | { kind: "done"; message: string }
    | { kind: "error"; message: string };
}) {
  const color =
    status.kind === "rolling-forward"
      ? "text-emerald-300"
      : status.kind === "watching"
        ? "text-amber-300"
        : status.kind === "triggered" || status.kind === "unwinding"
          ? "text-fuchsia-300"
          : status.kind === "done"
            ? "text-emerald-300"
            : status.kind === "error"
              ? "text-red-400"
              : "text-zinc-400";

  const dot =
    status.kind === "rolling-forward"
      ? "bg-emerald-400 animate-pulse"
      : status.kind === "watching"
        ? "bg-amber-400 animate-pulse"
        : status.kind === "triggered" || status.kind === "unwinding"
          ? "bg-fuchsia-400 animate-pulse"
          : status.kind === "done"
            ? "bg-emerald-400"
            : status.kind === "error"
              ? "bg-red-500"
              : "bg-zinc-700";

  const label =
    status.kind === "idle"
      ? "Idle · press Roll out to begin"
      : status.kind === "error"
        ? `Error: ${status.message}`
        : status.message;

  return (
    <div className="flex h-10 items-center gap-4">
      <span className={`h-3 w-3 rounded-full ${dot}`} />
      <span className={`font-mono text-2xl ${color}`}>{label}</span>
      {status.kind === "watching" && (
        <span className="ml-auto rounded-full border border-amber-400/40 bg-amber-500/10 px-4 py-1 font-mono text-sm uppercase tracking-[0.2em] text-amber-300">
          WATCHING · durable hook
        </span>
      )}
      {(status.kind === "triggered" || status.kind === "unwinding") && (
        <span className="ml-auto rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-1 font-mono text-sm uppercase tracking-[0.2em] text-fuchsia-300">
          REVERSE UNWIND
        </span>
      )}
    </div>
  );
}

function RowLabel({
  label,
  hint,
  accent,
}: {
  label: string;
  hint: string;
  accent: "emerald" | "fuchsia";
}) {
  const color =
    accent === "fuchsia" ? "text-fuchsia-300" : "text-emerald-300";
  return (
    <div className="flex items-baseline gap-4">
      <span
        className={`text-sm font-semibold uppercase tracking-[0.2em] ${color}`}
      >
        {label}
      </span>
      <span className="font-mono text-sm text-zinc-500">{hint}</span>
    </div>
  );
}

function ForwardCard({
  toolKey,
  state,
}: {
  toolKey: ForwardKey;
  state: ToolState;
}) {
  const labels = FORWARD_LABELS[toolKey];
  const borderClass =
    state.phase === "done"
      ? "border-emerald-400/40"
      : state.phase === "running"
        ? "border-emerald-400/60"
        : "border-white/10";
  const glowClass =
    state.phase === "running"
      ? "shadow-[0_0_40px_-12px_rgba(52,211,153,0.5)]"
      : "";
  const dot =
    state.phase === "done"
      ? "bg-emerald-400"
      : state.phase === "running"
        ? "bg-emerald-400 animate-pulse"
        : "bg-zinc-700";

  return (
    <div
      className={`flex min-h-[180px] flex-col rounded-2xl border bg-zinc-950 p-6 transition ${borderClass} ${glowClass}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${dot}`} />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          forward
        </span>
      </div>
      <div className="mt-2 font-mono text-lg text-white">{labels.title}</div>
      <div className="mt-1 text-sm text-zinc-500">{labels.subtitle}</div>
      <div className="mt-auto flex min-h-[40px] flex-col justify-end">
        {state.phase === "idle" && (
          <div className="font-mono text-sm text-zinc-600">queued</div>
        )}
        {state.phase === "running" && (
          <div className="font-mono text-sm text-emerald-300">pushing…</div>
        )}
        {state.phase === "done" && (
          <div className="font-mono text-sm text-emerald-200">
            {state.summary}
          </div>
        )}
      </div>
    </div>
  );
}

function CompCard({
  toolKey,
  state,
  order,
}: {
  toolKey: CompKey;
  state: ToolState;
  order: number;
}) {
  const labels = COMP_LABELS[toolKey];
  const borderClass =
    state.phase === "done"
      ? "border-fuchsia-400/50"
      : state.phase === "running"
        ? "border-fuchsia-400/70"
        : "border-white/10";
  const glowClass =
    state.phase === "running"
      ? "shadow-[0_0_50px_-10px_rgba(232,121,249,0.7)]"
      : state.phase === "done"
        ? "shadow-[0_0_30px_-14px_rgba(232,121,249,0.5)]"
        : "";
  const dot =
    state.phase === "done"
      ? "bg-fuchsia-400"
      : state.phase === "running"
        ? "bg-fuchsia-400 animate-pulse"
        : "bg-zinc-700";

  const dim =
    state.phase === "idle" ? "opacity-60" : "opacity-100";

  return (
    <div
      className={`flex min-h-[180px] flex-col rounded-2xl border bg-zinc-950 p-6 transition ${borderClass} ${glowClass} ${dim}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${dot}`} />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-fuchsia-300">
            comp · pop {order}
          </span>
        </div>
        <span className="font-mono text-xs text-zinc-600">
          ↺ {labels.pair}
        </span>
      </div>
      <div className="mt-2 font-mono text-lg text-white">{labels.title}</div>
      <div className="mt-1 text-sm text-zinc-500">{labels.subtitle}</div>
      <div className="mt-auto flex min-h-[40px] flex-col justify-end">
        {state.phase === "idle" && (
          <div className="font-mono text-sm text-zinc-600">armed</div>
        )}
        {state.phase === "running" && (
          <div className="font-mono text-sm text-fuchsia-300">unwinding…</div>
        )}
        {state.phase === "done" && (
          <div className="font-mono text-sm text-fuchsia-200">
            {state.summary}
          </div>
        )}
      </div>
    </div>
  );
}

function ReverseArrow({ active }: { active: boolean }) {
  return (
    <div className="flex h-8 items-center justify-center">
      <div
        className={`flex items-center gap-4 font-mono text-sm uppercase tracking-[0.3em] transition-opacity duration-500 ${
          active ? "opacity-100 text-fuchsia-300" : "opacity-30 text-zinc-600"
        }`}
      >
        <span>1</span>
        <span>→</span>
        <span>2</span>
        <span>→</span>
        <span>3</span>
        <span>→</span>
        <span>4</span>
        <span className="mx-6 rounded-full border border-current px-3 py-0.5">
          reverse
        </span>
        <span>4</span>
        <span>→</span>
        <span>3</span>
        <span>→</span>
        <span>2</span>
        <span>→</span>
        <span>1</span>
      </div>
    </div>
  );
}

function TriggerPanel({
  watchState,
  reportState,
  trigger,
  onFire,
  status,
}: {
  watchState: ToolState;
  reportState: ToolState;
  trigger: { source: TriggerSource; reason: string } | null;
  onFire: (source: TriggerSource, reason: string) => void;
  status: { kind: string };
}) {
  const awaiting = watchState.phase === "waiting" && !trigger;
  const revealed = watchState.phase !== "idle";

  return (
    <div
      className={`flex min-h-[140px] items-stretch gap-8 rounded-2xl border bg-zinc-950 p-7 transition-opacity duration-500 ${
        revealed
          ? awaiting
            ? "border-amber-400/40 opacity-100"
            : trigger
              ? "border-fuchsia-400/40 opacity-100"
              : "border-white/10 opacity-100"
          : "border-white/10 opacity-40"
      }`}
    >
      <div className="flex flex-col justify-center">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Backlash monitor
        </span>
        <span className="mt-2 font-mono text-2xl text-white">
          watchForBacklash · zn-soma
        </span>
        {trigger ? (
          <span className="mt-1 font-mono text-base text-fuchsia-300">
            {trigger.source.toUpperCase()} · {trigger.reason}
          </span>
        ) : (
          <span className="mt-1 font-mono text-base text-zinc-400">
            {awaiting
              ? "Workflow suspended — listening for backlash signal"
              : "idle"}
          </span>
        )}
        {reportState.phase === "done" && (
          <span className="mt-2 font-mono text-sm text-emerald-300">
            incident report · {reportState.summary}
          </span>
        )}
      </div>

      <div className="ml-auto flex flex-col items-end justify-center gap-3">
        {awaiting ? (
          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={() =>
                onFire(
                  "pr",
                  "Driver union post went viral · 24k reposts in 12m",
                )
              }
              className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-5 py-2 font-semibold text-fuchsia-300 transition hover:bg-fuchsia-500/20"
            >
              PR backlash
            </button>
            <button
              type="button"
              onClick={() =>
                onFire(
                  "conversion",
                  "Orders collapsed 45% · 168 → 92 in 15m at 2.5x",
                )
              }
              className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-5 py-2 font-semibold text-fuchsia-300 transition hover:bg-fuchsia-500/20"
            >
              Conversion cliff
            </button>
            <button
              type="button"
              onClick={() =>
                onFire("legal", "Regulator flagged 2.5x as surge abuse")
              }
              className="rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-5 py-2 font-semibold text-fuchsia-300 transition hover:bg-fuchsia-500/20"
            >
              Legal flag
            </button>
          </div>
        ) : trigger ? (
          <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-4 py-1 font-mono text-sm uppercase tracking-[0.2em] text-fuchsia-300">
            SIGNAL · {trigger.source}
          </span>
        ) : status.kind === "done" ? (
          <span className="rounded-full border border-emerald-400/40 bg-emerald-500/10 px-4 py-1 font-mono text-sm uppercase tracking-[0.2em] text-emerald-300">
            ROLLBACK COMPLETE
          </span>
        ) : (
          <span className="font-mono text-sm text-zinc-600">
            waiting for agent to watch…
          </span>
        )}
      </div>
    </div>
  );
}
