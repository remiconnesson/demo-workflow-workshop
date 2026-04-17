"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// menu-rollback demo page — chapter 3 of the menu-curator story.
//
// Forward row (left→right):  POS → app → partners
// Sentinel card (center):    conversion-sentinel + Trigger button (fuchsia)
// Compensation row:           revert POS ← revert app ← revert partners
//                             (fills right→left, mirroring reverse unwind)
// Coda:                       record rollback incident
//
// Fuchsia-400 is the verb accent. Layout is fixed — every slot has a
// reserved min-height and the reverse row has placeholder cards from t=0
// so no CLS when compensations arrive.
// ---------------------------------------------------------------------------

type SlotState =
  | "idle"
  | "calling"
  | "live"
  | "waiting"
  | "reverting"
  | "reverted"
  | "ok";

type ForwardKey = "applyPosPrice" | "pushAppCatalog" | "notifyPartnerIntegrations";
type SentinelKey = "watchConversionSentinel";
type CompKey = "revertPosPrice" | "revertAppCatalog" | "revertPartnerIntegrations";
type CodaKey = "recordRollbackIncident";
type ToolKey = ForwardKey | SentinelKey | CompKey | CodaKey;

type SlotView = {
  key: ToolKey;
  label: string;
  sub: string;
  state: SlotState;
  detail: string;
};

const INITIAL_SLOTS: Record<ToolKey, SlotView> = {
  applyPosPrice: {
    key: "applyPosPrice",
    label: "Apply POS price",
    sub: "148 registers",
    state: "idle",
    detail: "",
  },
  pushAppCatalog: {
    key: "pushAppCatalog",
    label: "Push app catalog",
    sub: "catalog CDN",
    state: "idle",
    detail: "",
  },
  notifyPartnerIntegrations: {
    key: "notifyPartnerIntegrations",
    label: "Notify partners",
    sub: "doordash · ubereats · grubhub",
    state: "idle",
    detail: "",
  },
  watchConversionSentinel: {
    key: "watchConversionSentinel",
    label: "Conversion sentinel",
    sub: "burger-classic · zip 94110",
    state: "idle",
    detail: "",
  },
  revertPartnerIntegrations: {
    key: "revertPartnerIntegrations",
    label: "Revert partners",
    sub: "compensates · notifyPartners",
    state: "idle",
    detail: "",
  },
  revertAppCatalog: {
    key: "revertAppCatalog",
    label: "Revert app catalog",
    sub: "compensates · pushAppCatalog",
    state: "idle",
    detail: "",
  },
  revertPosPrice: {
    key: "revertPosPrice",
    label: "Revert POS price",
    sub: "compensates · applyPosPrice",
    state: "idle",
    detail: "",
  },
  recordRollbackIncident: {
    key: "recordRollbackIncident",
    label: "Record incident",
    sub: "incident-log-v1",
    state: "idle",
    detail: "",
  },
};

const FORWARD_ORDER: ForwardKey[] = [
  "applyPosPrice",
  "pushAppCatalog",
  "notifyPartnerIntegrations",
];

// Compensation row reads left→right in REVERSE of the forward row, so the
// unwind animation sweeps opposite the rollout.
const COMP_ORDER: CompKey[] = [
  "revertPartnerIntegrations",
  "revertAppCatalog",
  "revertPosPrice",
];

type ChunkLike = {
  type?: string;
  toolName?: string;
  toolCallId?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  delta?: string;
};

function isToolKey(name: string | undefined): name is ToolKey {
  return (
    name === "applyPosPrice" ||
    name === "pushAppCatalog" ||
    name === "notifyPartnerIntegrations" ||
    name === "watchConversionSentinel" ||
    name === "revertPartnerIntegrations" ||
    name === "revertAppCatalog" ||
    name === "revertPosPrice" ||
    name === "recordRollbackIncident"
  );
}

type SentinelContext = {
  token: string;
  regressionPct: number | null;
  reason: string | null;
};

function summarizeOutput(key: ToolKey, output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const o = output as Record<string, unknown>;
  if (key === "applyPosPrice" || key === "pushAppCatalog" || key === "notifyPartnerIntegrations") {
    const p = typeof o.livePrice === "number" ? o.livePrice : null;
    return p != null ? `live · $${p.toFixed(2)}` : "live";
  }
  if (key === "watchConversionSentinel") {
    const r = typeof o.regressionPct === "number" ? o.regressionPct : null;
    return r != null ? `Δ ${r > 0 ? "+" : ""}${r.toFixed(1)}%` : "";
  }
  if (
    key === "revertPosPrice" ||
    key === "revertAppCatalog" ||
    key === "revertPartnerIntegrations"
  ) {
    const r = typeof o.restoredPrice === "number" ? o.restoredPrice : null;
    return r != null ? `restored · $${r.toFixed(2)}` : "reverted";
  }
  if (key === "recordRollbackIncident") {
    const id = typeof o.incidentId === "string" ? o.incidentId : "";
    return id ? id : "logged";
  }
  return "";
}

type Status =
  | "idle"
  | "running"
  | "live"
  | "armed"
  | "rolling-back"
  | "done"
  | "error";

export default function MenuRollbackExperimentPage() {
  const [slots, setSlots] = useState<Record<ToolKey, SlotView>>(INITIAL_SLOTS);
  const [status, setStatus] = useState<Status>("idle");
  const [summary, setSummary] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);
  const [sentinel, setSentinel] = useState<SentinelContext | null>(null);
  const [triggered, setTriggered] = useState(false);
  const runningRef = useRef(false);

  const reset = useCallback(() => {
    setSlots(INITIAL_SLOTS);
    setSummary("");
    setRunId(null);
    setSentinel(null);
    setTriggered(false);
    setStatus("idle");
  }, []);

  const handleRun = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    reset();
    setStatus("running");

    const ctx: SentinelContext = {
      token: "menu-rollback:burger-classic",
      regressionPct: null,
      reason: null,
    };

    try {
      const res = await fetch("/api/experiments/menu-rollback/start", {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        setStatus("error");
        runningRef.current = false;
        return;
      }
      const xRunId = res.headers.get("X-Run-Id");
      if (xRunId) setRunId(xRunId);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      const perCall = new Map<string, { key: ToolKey }>();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          let chunk: ChunkLike;
          try {
            chunk = JSON.parse(trimmed) as ChunkLike;
          } catch {
            continue;
          }
          handleChunk(
            chunk,
            perCall,
            ctx,
            setSlots,
            setSummary,
            setSentinel,
            setStatus,
          );
        }
      }
      setStatus((prev) => (prev === "error" ? prev : "done"));
    } catch {
      setStatus("error");
    } finally {
      runningRef.current = false;
    }
  }, [reset]);

  const handleTrigger = useCallback(async () => {
    if (!sentinel || triggered) return;
    setTriggered(true);
    setStatus("rolling-back");
    try {
      await fetch("/api/experiments/menu-rollback/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: sentinel.token,
          regressionPct: -8.1,
          reason:
            "Conversion rate dropped 8.1% in first hour vs. 14-day baseline",
        }),
      });
    } catch {
      setTriggered(false);
      setStatus("armed");
    }
  }, [sentinel, triggered]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-10 py-10">
      <div className="flex w-full max-w-6xl flex-col gap-8">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
              Menu curator · Rollback
            </p>
            <h1 className="mt-2 text-5xl font-semibold tracking-tight">
              Conversion drops. Agent unwinds the rollout.
            </h1>
            <p className="mt-3 max-w-3xl text-lg text-zinc-400">
              Chapter 3. The approved Classic Burger tweak ($12.50 → $13.12)
              shipped across POS, the app, and partners. An hour in, the
              conversion sentinel flags an 8.1% regression. The agent
              compensates each forward tool in reverse order — and logs the
              incident.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={status} />
            <button
              onClick={handleRun}
              disabled={
                status === "running" ||
                status === "live" ||
                status === "armed" ||
                status === "rolling-back"
              }
              className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "running"
                ? "Running…"
                : status === "armed"
                  ? "Live"
                  : status === "rolling-back"
                    ? "Unwinding…"
                    : "Run agent"}
            </button>
          </div>
        </header>

        <section className="flex flex-col gap-3">
          <RowLabel text="Forward rollout" />
          <div className="grid grid-cols-3 gap-4">
            {FORWARD_ORDER.map((key) => (
              <ToolSlotCard key={key} slot={slots[key]} tone="forward" />
            ))}
          </div>
        </section>

        <SentinelCard
          sentinel={sentinel}
          slot={slots.watchConversionSentinel}
          status={status}
          triggered={triggered}
          onTrigger={handleTrigger}
        />

        <section className="flex flex-col gap-3">
          <RowLabel text="Reverse unwind" accent />
          <div className="grid grid-cols-3 gap-4">
            {COMP_ORDER.map((key) => (
              <ToolSlotCard key={key} slot={slots[key]} tone="rollback" />
            ))}
          </div>
        </section>

        <CodaCard slot={slots.recordRollbackIncident} />

        <SummaryCard summary={summary} runId={runId} />
      </div>
    </div>
  );
}

function handleChunk(
  chunk: ChunkLike,
  perCall: Map<string, { key: ToolKey }>,
  ctx: SentinelContext,
  setSlots: React.Dispatch<React.SetStateAction<Record<ToolKey, SlotView>>>,
  setSummary: React.Dispatch<React.SetStateAction<string>>,
  setSentinel: React.Dispatch<React.SetStateAction<SentinelContext | null>>,
  setStatus: React.Dispatch<React.SetStateAction<Status>>,
) {
  const t = chunk.type ?? "";
  const id = chunk.toolCallId;
  const name = chunk.toolName;

  if (t.startsWith("tool-") && id && isToolKey(name)) {
    if (!perCall.has(id)) {
      perCall.set(id, { key: name });
    }
  }

  if (t === "tool-input-start" || t === "tool-input-available") {
    if (id && perCall.has(id)) {
      const entry = perCall.get(id)!;
      const isSentinel = entry.key === "watchConversionSentinel";
      const isComp =
        entry.key === "revertPosPrice" ||
        entry.key === "revertAppCatalog" ||
        entry.key === "revertPartnerIntegrations";

      setSlots((prev) => ({
        ...prev,
        [entry.key]: {
          ...prev[entry.key],
          state: isSentinel ? "waiting" : isComp ? "reverting" : "calling",
        },
      }));

      if (isSentinel && t === "tool-input-available") {
        setSentinel({ ...ctx });
        setStatus("armed");
      }
    }
    return;
  }

  if (t === "tool-output-available") {
    if (id && perCall.has(id)) {
      const entry = perCall.get(id)!;
      const detail = summarizeOutput(entry.key, chunk.output);

      const isForward =
        entry.key === "applyPosPrice" ||
        entry.key === "pushAppCatalog" ||
        entry.key === "notifyPartnerIntegrations";
      const isSentinel = entry.key === "watchConversionSentinel";
      const isComp =
        entry.key === "revertPosPrice" ||
        entry.key === "revertAppCatalog" ||
        entry.key === "revertPartnerIntegrations";

      // Sentinel output = regression signal arrived; record for card.
      if (isSentinel && chunk.output && typeof chunk.output === "object") {
        const o = chunk.output as Record<string, unknown>;
        if (typeof o.regressionPct === "number") {
          ctx.regressionPct = o.regressionPct;
        }
        if (typeof o.reason === "string") {
          ctx.reason = o.reason;
        }
        setSentinel({ ...ctx });
        setStatus("rolling-back");
      }

      setSlots((prev) => ({
        ...prev,
        [entry.key]: {
          ...prev[entry.key],
          state: isForward ? "live" : isComp ? "reverted" : "ok",
          detail,
        },
      }));

      // Once all three forwards are live and no rollback yet, show Live status.
      if (isForward) {
        setStatus((prev) => (prev === "running" ? "live" : prev));
      }
    }
    return;
  }

  if (t === "text-delta" && typeof chunk.delta === "string") {
    setSummary((prev) => prev + chunk.delta);
  }
}

function RowLabel({ text, accent = false }: { text: string; accent?: boolean }) {
  return (
    <span
      className={`text-xs font-semibold uppercase tracking-[0.2em] ${accent ? "text-fuchsia-400" : "text-zinc-500"}`}
    >
      {text}
    </span>
  );
}

function StatusPill({ status }: { status: Status }) {
  const cfg =
    status === "running"
      ? {
          label: "ROLLING OUT",
          cls: "border-sky-400/40 bg-sky-500/10 text-sky-300 animate-pulse",
        }
      : status === "live"
        ? {
            label: "LIVE",
            cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
          }
        : status === "armed"
          ? {
              label: "WATCHING",
              cls: "border-amber-400/40 bg-amber-500/10 text-amber-300 animate-pulse",
            }
          : status === "rolling-back"
            ? {
                label: "ROLLING BACK",
                cls: "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-300 animate-pulse",
              }
            : status === "done"
              ? {
                  label: "COMPLETE",
                  cls: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
                }
              : status === "error"
                ? {
                    label: "ERROR",
                    cls: "border-red-400/40 bg-red-500/10 text-red-300",
                  }
                : {
                    label: "IDLE",
                    cls: "border-white/10 bg-white/5 text-zinc-400",
                  };
  return (
    <span
      className={`rounded-full border px-4 py-1.5 font-mono text-xs font-semibold tracking-[0.2em] ${cfg.cls}`}
    >
      {cfg.label}
    </span>
  );
}

function ToolSlotCard({
  slot,
  tone,
}: {
  slot: SlotView;
  tone: "forward" | "rollback";
}) {
  const cfg = STATE_STYLE[slot.state];
  return (
    <div
      className={`relative flex min-h-[180px] flex-col overflow-hidden rounded-2xl border bg-zinc-950 p-5 transition-colors ${cfg.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {tone === "forward" ? "Forward tool" : "Compensation"}
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] ${cfg.pill} ${slot.state === "reverting" || slot.state === "waiting" ? "animate-pulse" : ""}`}
        >
          {cfg.label}
        </span>
      </div>
      <div className="mt-4 font-mono text-lg leading-tight text-white">
        {slot.label}
      </div>
      <div className="mt-1 font-mono text-xs text-zinc-500">{slot.sub}</div>
      <div className="mt-auto min-h-[24px] font-mono text-sm text-zinc-300">
        {slot.detail}
      </div>
    </div>
  );
}

const STATE_STYLE: Record<
  SlotState,
  { label: string; pill: string; border: string }
> = {
  idle: {
    label: "IDLE",
    pill: "border-white/10 bg-white/5 text-zinc-500",
    border: "border-white/10",
  },
  calling: {
    label: "CALLING",
    pill: "border-sky-400/40 bg-sky-500/10 text-sky-300",
    border: "border-sky-400/40",
  },
  live: {
    label: "LIVE",
    pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    border: "border-emerald-400/30",
  },
  waiting: {
    label: "WATCHING",
    pill: "border-amber-400/50 bg-amber-500/15 text-amber-200",
    border: "border-amber-400/60",
  },
  reverting: {
    label: "REVERTING",
    pill: "border-fuchsia-400/50 bg-fuchsia-500/15 text-fuchsia-200",
    border: "border-fuchsia-400/60",
  },
  reverted: {
    label: "REVERTED",
    pill: "border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-300",
    border: "border-fuchsia-400/40",
  },
  ok: {
    label: "OK",
    pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    border: "border-emerald-400/30",
  },
};

function SentinelCard({
  sentinel,
  slot,
  status,
  triggered,
  onTrigger,
}: {
  sentinel: SentinelContext | null;
  slot: SlotView;
  status: Status;
  triggered: boolean;
  onTrigger: () => void;
}) {
  const armed = status === "armed";
  const firing = status === "rolling-back" || slot.state === "ok";
  const color = firing
    ? "border-fuchsia-400/60"
    : armed
      ? "border-amber-400/60"
      : "border-white/10";
  const dotCls = firing
    ? "bg-fuchsia-400 animate-pulse"
    : armed
      ? "bg-amber-400 animate-pulse"
      : "bg-white/10";
  const headline = firing
    ? "Conversion sentinel fired"
    : armed
      ? "Conversion sentinel watching"
      : "Conversion sentinel idle";
  const regression = sentinel?.regressionPct;
  const reason = sentinel?.reason;

  return (
    <div
      className={`min-h-[180px] rounded-2xl border bg-zinc-950 p-6 transition-colors ${color}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${dotCls}`} />
          <span
            className={`text-xs font-semibold uppercase tracking-[0.2em] ${
              firing
                ? "text-fuchsia-300"
                : armed
                  ? "text-amber-300"
                  : "text-zinc-500"
            }`}
          >
            {headline}
          </span>
        </div>
        <span className="font-mono text-xs text-zinc-500">
          token {sentinel?.token ?? "menu-rollback:burger-classic"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-6">
        <div className="flex flex-col gap-2">
          <div className="font-mono text-2xl text-white">
            {regression != null
              ? `Classic Burger · zip 94110 · Δ ${regression > 0 ? "+" : ""}${regression.toFixed(1)}%`
              : "Classic Burger · zip 94110 · watching conversion rate"}
          </div>
          <div className="font-mono text-base text-zinc-400">
            {reason ??
              "Baseline: 14-day rolling conversion rate. Rollback if Δ ≤ -5%."}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onTrigger}
            disabled={!armed || triggered}
            className="rounded-xl bg-fuchsia-400 px-5 py-3 text-base font-semibold text-black transition hover:bg-fuchsia-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {triggered ? "Triggered" : "Trigger rollback"}
          </button>
        </div>
      </div>
    </div>
  );
}

function CodaCard({ slot }: { slot: SlotView }) {
  const logged = slot.state === "ok";
  return (
    <div
      className={`min-h-[96px] rounded-2xl border bg-zinc-950 p-5 transition-colors ${logged ? "border-fuchsia-400/40" : "border-white/10"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Rollback incident
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] ${logged ? "border-fuchsia-300/40 bg-fuchsia-500/10 text-fuchsia-300" : "border-white/10 bg-white/5 text-zinc-500"}`}
        >
          {logged ? "LOGGED" : "IDLE"}
        </span>
      </div>
      <div className="mt-2 flex items-baseline justify-between gap-6">
        <div className="font-mono text-lg text-white">{slot.label}</div>
        <div className="font-mono text-sm text-zinc-400">
          {slot.detail || slot.sub}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  summary,
  runId,
}: {
  summary: string;
  runId: string | null;
}) {
  return (
    <div className="min-h-[120px] rounded-2xl border border-white/10 bg-zinc-950 p-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Agent summary
        </span>
        {runId ? (
          <span className="font-mono text-xs text-zinc-600">
            run {runId.slice(0, 12)}…
          </span>
        ) : null}
      </div>
      <div className="mt-3 min-h-[48px] whitespace-pre-wrap text-xl leading-snug text-zinc-100">
        {summary || (
          <span className="text-zinc-600">
            Agent response streams here after the rollback resolves.
          </span>
        )}
      </div>
    </div>
  );
}
