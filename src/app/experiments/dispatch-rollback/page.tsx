"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Dispatch · Rollback — Chapter 3 of the dispatch story.
//
// Priya has been reassigned to ord-9421 after Chapter 2's dispatcher
// approval. The agent finishes the hand-off: commitReassignment →
// notifyCustomerOfEta → pushRouteToDriverApp. Then it awaits the kitchen's
// final check. A UI button fires a dispute — Tartine packed the wrong bag.
// The agent unwinds in REVERSE: recallRouteFromDriverApp →
// notifyCustomerOfCancellation → releaseDriverFromOrder.
//
// Visual grammar: a horizontal strip of three forward cards fills with
// emerald as each step completes. The "kitchen check" panel glows amber
// while suspended. On trigger, the panel flashes fuchsia and each forward
// card flips, last-in-first-out, to a fuchsia "undone" state with an arrow
// pointing backwards. One status line narrates.
// ---------------------------------------------------------------------------

type ForwardKey =
  | "commitReassignment"
  | "notifyCustomerOfEta"
  | "pushRouteToDriverApp";

type CompKey =
  | "recallRouteFromDriverApp"
  | "notifyCustomerOfCancellation"
  | "releaseDriverFromOrder";

type ToolKey = ForwardKey | CompKey | "awaitKitchenDispute";

type ForwardState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; summary: string }
  | { phase: "undone"; summary: string };

type CompState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "done"; summary: string };

type Status =
  | { kind: "idle" }
  | { kind: "running"; message: string }
  | { kind: "suspended"; message: string }
  | { kind: "rollback"; message: string }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

// Display metadata for the 3 forward actions + their compensation undo.
const FORWARD_ORDER: ForwardKey[] = [
  "commitReassignment",
  "notifyCustomerOfEta",
  "pushRouteToDriverApp",
];

const FORWARD_LABELS: Record<
  ForwardKey,
  { title: string; subtitle: string; compensatedBy: CompKey }
> = {
  commitReassignment: {
    title: "commitReassignment",
    subtitle: "Lock Priya to ord-9421",
    compensatedBy: "releaseDriverFromOrder",
  },
  notifyCustomerOfEta: {
    title: "notifyCustomerOfEta",
    subtitle: "SMS the customer the new ETA",
    compensatedBy: "notifyCustomerOfCancellation",
  },
  pushRouteToDriverApp: {
    title: "pushRouteToDriverApp",
    subtitle: "Push route to Priya's phone",
    compensatedBy: "recallRouteFromDriverApp",
  },
};

const COMP_LABELS: Record<CompKey, { title: string; undoOf: ForwardKey }> = {
  recallRouteFromDriverApp: {
    title: "recallRouteFromDriverApp",
    undoOf: "pushRouteToDriverApp",
  },
  notifyCustomerOfCancellation: {
    title: "notifyCustomerOfCancellation",
    undoOf: "notifyCustomerOfEta",
  },
  releaseDriverFromOrder: {
    title: "releaseDriverFromOrder",
    undoOf: "commitReassignment",
  },
};

const INITIAL_FORWARD: Record<ForwardKey, ForwardState> = {
  commitReassignment: { phase: "idle" },
  notifyCustomerOfEta: { phase: "idle" },
  pushRouteToDriverApp: { phase: "idle" },
};

const INITIAL_COMP: Record<CompKey, CompState> = {
  recallRouteFromDriverApp: { phase: "idle" },
  notifyCustomerOfCancellation: { phase: "idle" },
  releaseDriverFromOrder: { phase: "idle" },
};

type Chunk = {
  type?: string;
  toolName?: string;
  toolCallId?: string;
  output?: unknown;
  errorText?: string;
  input?: unknown;
};

const ORDER_ID = "ord-9421";
const TOKEN = `dispatch-rollback:${ORDER_ID}`;

export default function DispatchRollbackPage() {
  const [forward, setForward] =
    useState<Record<ForwardKey, ForwardState>>(INITIAL_FORWARD);
  const [comp, setComp] = useState<Record<CompKey, CompState>>(INITIAL_COMP);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [awaiting, setAwaiting] = useState(false);
  const [triggered, setTriggered] = useState(false);
  const activeToolByCallId = useRef<Map<string, ToolKey>>(new Map());

  const setF = useCallback((key: ForwardKey, next: ForwardState) => {
    setForward((prev) => ({ ...prev, [key]: next }));
  }, []);
  const setC = useCallback((key: CompKey, next: CompState) => {
    setComp((prev) => ({ ...prev, [key]: next }));
  }, []);

  const run = useCallback(async () => {
    setForward(INITIAL_FORWARD);
    setComp(INITIAL_COMP);
    setAwaiting(false);
    setTriggered(false);
    setStatus({ kind: "running", message: "Agent committing hand-off…" });
    activeToolByCallId.current.clear();

    let res: Response;
    try {
      res = await fetch("/api/experiments/dispatch-rollback/start", {
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

    setStatus((s) =>
      s.kind === "error"
        ? s
        : { kind: "done", message: "Rollback complete — dispatch unwound." },
    );

    function handleChunk(chunk: Chunk) {
      const t = chunk.type ?? "";
      const callId = chunk.toolCallId ?? "";
      const name = (chunk.toolName ?? "") as ToolKey;

      if (t === "tool-input-start" || t === "tool-input-available") {
        if (!isToolKey(name)) return;
        activeToolByCallId.current.set(callId, name);

        if (name === "awaitKitchenDispute") {
          setAwaiting(true);
          setStatus({
            kind: "suspended",
            message:
              "Suspended · kitchen running final bag check on ord-9421",
          });
          return;
        }

        if (isForwardKey(name)) {
          setF(name, { phase: "running" });
          setStatus({
            kind: "running",
            message: runningLabel(name),
          });
          return;
        }

        if (isCompKey(name)) {
          setC(name, { phase: "running" });
          // Also mark the forward action it undoes as "undone" as soon as
          // the compensation starts, so the reverse-unwind visually
          // "eats" the forward strip right-to-left.
          const undone = COMP_LABELS[name].undoOf;
          setForward((prev) => {
            const cur = prev[undone];
            if (cur.phase === "done") {
              return { ...prev, [undone]: { phase: "undone", summary: cur.summary } };
            }
            return prev;
          });
          setStatus({
            kind: "rollback",
            message: rollbackLabel(name),
          });
        }
        return;
      }

      if (t === "tool-output-available") {
        const key =
          (isToolKey(name) && name) || activeToolByCallId.current.get(callId);
        if (!key) return;
        const output = (chunk.output ?? {}) as Record<string, unknown>;

        if (key === "awaitKitchenDispute") {
          setAwaiting(false);
          const disputed = Boolean(output.disputed);
          if (disputed) {
            setStatus({
              kind: "rollback",
              message: `Kitchen dispute: ${String(output.reason ?? "wrong_bag_packed")} — unwinding in reverse`,
            });
          } else {
            setStatus({
              kind: "done",
              message: "Kitchen confirmed — no rollback needed.",
            });
          }
          return;
        }

        if (isForwardKey(key)) {
          setF(key, { phase: "done", summary: forwardSummary(key, output) });
          return;
        }

        if (isCompKey(key)) {
          setC(key, { phase: "done", summary: compSummary(key, output) });
        }
      }
    }
  }, [setC, setF]);

  const trigger = useCallback(async () => {
    if (triggered) return;
    setTriggered(true);
    try {
      await fetch("/api/experiments/dispatch-rollback/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: TOKEN,
          disputed: true,
          reason: "Tartine packed the wrong bag for ord-9421",
        }),
      });
    } catch {
      // swallow — workflow stays suspended; user can click again on reload
    }
  }, [triggered]);

  const running =
    status.kind === "running" ||
    status.kind === "suspended" ||
    status.kind === "rollback";

  return (
    <div className="flex h-full w-full flex-col bg-black text-white">
      <header className="flex items-baseline justify-between border-b border-white/10 px-12 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Dispatch · Rollback · Chapter 3
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Kitchen disputes the order — agent unwinds the dispatch in reverse
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            Priya is locked, the customer has her ETA, her phone has the
            route. Then Tartine reports the wrong bag was packed. The
            DurableAgent invokes three{" "}
            <span className="font-mono text-fuchsia-300">compensations</span>{" "}
            in exact reverse order of the forward tools — one saga, one
            loop, no manual cleanup.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {running ? "Running…" : "Hand-off ord-9421"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-8 px-12 py-10">
        <StatusLine status={status} />

        <ForwardStrip forward={forward} />

        <DisputePanel
          awaiting={awaiting}
          triggered={triggered}
          status={status}
          onTrigger={trigger}
        />

        <CompensationStrip comp={comp} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Type guards
// ---------------------------------------------------------------------------

function isToolKey(x: string): x is ToolKey {
  return (
    isForwardKey(x) ||
    isCompKey(x) ||
    x === "awaitKitchenDispute"
  );
}
function isForwardKey(x: string): x is ForwardKey {
  return (
    x === "commitReassignment" ||
    x === "notifyCustomerOfEta" ||
    x === "pushRouteToDriverApp"
  );
}
function isCompKey(x: string): x is CompKey {
  return (
    x === "recallRouteFromDriverApp" ||
    x === "notifyCustomerOfCancellation" ||
    x === "releaseDriverFromOrder"
  );
}

// ---------------------------------------------------------------------------
// Status text
// ---------------------------------------------------------------------------

function runningLabel(k: ForwardKey): string {
  if (k === "commitReassignment") return "Locking Priya to ord-9421…";
  if (k === "notifyCustomerOfEta") return "Texting customer the new ETA…";
  return "Pushing route to Priya's phone…";
}
function rollbackLabel(k: CompKey): string {
  if (k === "recallRouteFromDriverApp") return "Revoking route from Priya's phone…";
  if (k === "notifyCustomerOfCancellation") return "Texting customer the cancellation…";
  return "Releasing Priya back to the pool…";
}

function forwardSummary(k: ForwardKey, out: Record<string, unknown>): string {
  if (k === "commitReassignment") {
    const name = (out.driverName as string) ?? "driver";
    const eta = (out.etaMin as number) ?? 0;
    return `${name} · ETA ${eta}m`;
  }
  if (k === "notifyCustomerOfEta") {
    return `SMS → ${(out.to as string) ?? "customer"}`;
  }
  return `Route pushed · ${(out.legs as number) ?? 2} legs`;
}
function compSummary(k: CompKey, out: Record<string, unknown>): string {
  if (k === "recallRouteFromDriverApp") return "Route revoked";
  if (k === "notifyCustomerOfCancellation")
    return `Cancellation SMS → ${(out.to as string) ?? "customer"}`;
  return `${(out.driverName as string) ?? "driver"} released`;
}

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------

function StatusLine({ status }: { status: Status }) {
  const color =
    status.kind === "suspended"
      ? "text-amber-300"
      : status.kind === "rollback"
        ? "text-fuchsia-300"
        : status.kind === "done"
          ? "text-emerald-300"
          : status.kind === "error"
            ? "text-red-400"
            : status.kind === "running"
              ? "text-sky-300"
              : "text-zinc-400";
  const dot =
    status.kind === "suspended"
      ? "bg-amber-400 animate-pulse"
      : status.kind === "rollback"
        ? "bg-fuchsia-400 animate-pulse"
        : status.kind === "done"
          ? "bg-emerald-400"
          : status.kind === "error"
            ? "bg-red-500"
            : status.kind === "running"
              ? "bg-sky-400 animate-pulse"
              : "bg-zinc-700";
  const label =
    status.kind === "idle"
      ? "Idle · press Hand-off to begin"
      : status.kind === "error"
        ? `Error: ${status.message}`
        : status.message;

  return (
    <div className="flex h-10 items-center gap-4">
      <span className={`h-3 w-3 rounded-full ${dot}`} />
      <span className={`font-mono text-2xl ${color}`}>{label}</span>
    </div>
  );
}

function ForwardStrip({
  forward,
}: {
  forward: Record<ForwardKey, ForwardState>;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Forward · agent mutates state
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">
          left → right
        </span>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {FORWARD_ORDER.map((k, i) => (
          <ForwardCard key={k} index={i + 1} toolKey={k} state={forward[k]} />
        ))}
      </div>
    </div>
  );
}

function ForwardCard({
  index,
  toolKey,
  state,
}: {
  index: number;
  toolKey: ForwardKey;
  state: ForwardState;
}) {
  const labels = FORWARD_LABELS[toolKey];

  const borderClass =
    state.phase === "undone"
      ? "border-fuchsia-400/60"
      : state.phase === "done"
        ? "border-emerald-400/40"
        : state.phase === "running"
          ? "border-sky-400/40"
          : "border-white/10";

  const glowClass =
    state.phase === "undone"
      ? "shadow-[0_0_60px_-10px_rgba(232,121,249,0.55)]"
      : "";

  const dot =
    state.phase === "undone"
      ? "bg-fuchsia-400"
      : state.phase === "done"
        ? "bg-emerald-400"
        : state.phase === "running"
          ? "bg-sky-400 animate-pulse"
          : "bg-zinc-700";

  return (
    <div
      className={`relative flex min-h-[200px] flex-col rounded-2xl border bg-zinc-950 p-6 transition ${borderClass} ${glowClass} ${
        state.phase === "undone" ? "opacity-70" : "opacity-100"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${dot}`} />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            step {index}
          </span>
        </div>
        {state.phase === "undone" && (
          <span className="rounded-full border border-fuchsia-400/40 bg-fuchsia-500/10 px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-fuchsia-300">
            undone
          </span>
        )}
      </div>
      <div className="mt-3 font-mono text-xl text-white">{labels.title}</div>
      <div className="mt-1 text-sm text-zinc-500">{labels.subtitle}</div>

      <div className="mt-auto flex min-h-[56px] flex-col justify-end">
        {state.phase === "idle" && (
          <div className="font-mono text-sm text-zinc-600">queued</div>
        )}
        {state.phase === "running" && (
          <div className="font-mono text-sm text-sky-300">running…</div>
        )}
        {state.phase === "done" && (
          <div className="font-mono text-base text-emerald-200">
            {state.summary}
          </div>
        )}
        {state.phase === "undone" && (
          <div className="flex items-center gap-2">
            <span className="font-mono text-base text-fuchsia-200 line-through decoration-fuchsia-400/60">
              {state.summary}
            </span>
          </div>
        )}
      </div>

      {state.phase === "undone" && (
        <div className="pointer-events-none absolute inset-x-0 bottom-2 flex items-center justify-center">
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-fuchsia-400">
            ↑ undone by {FORWARD_LABELS[toolKey].compensatedBy}
          </span>
        </div>
      )}
    </div>
  );
}

function DisputePanel({
  awaiting,
  triggered,
  status,
  onTrigger,
}: {
  awaiting: boolean;
  triggered: boolean;
  status: Status;
  onTrigger: () => void;
}) {
  const isRollback = status.kind === "rollback";
  const isDone = status.kind === "done" && triggered;

  const borderClass = awaiting
    ? "border-amber-400/60"
    : isRollback
      ? "border-fuchsia-400/60"
      : isDone
        ? "border-fuchsia-400/30"
        : "border-white/10";

  const glowClass = awaiting
    ? "shadow-[0_0_80px_-10px_rgba(251,191,36,0.5)]"
    : isRollback
      ? "shadow-[0_0_80px_-10px_rgba(232,121,249,0.6)]"
      : "";

  const dot = awaiting
    ? "bg-amber-400 animate-pulse"
    : isRollback
      ? "bg-fuchsia-400 animate-pulse"
      : isDone
        ? "bg-fuchsia-300"
        : "bg-zinc-700";

  const label = awaiting
    ? "Awaiting kitchen check"
    : isRollback
      ? "Dispute fired — rolling back"
      : isDone
        ? "Rollback complete"
        : "Kitchen check slot";

  const labelColor = awaiting
    ? "text-amber-300"
    : isRollback
      ? "text-fuchsia-300"
      : isDone
        ? "text-fuchsia-300"
        : "text-zinc-500";

  return (
    <div
      className={`flex min-h-[160px] items-stretch gap-8 rounded-2xl border bg-zinc-950 p-8 transition ${borderClass} ${glowClass}`}
    >
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${dot}`} />
          <span
            className={`text-sm font-semibold uppercase tracking-[0.2em] ${labelColor}`}
          >
            {label}
          </span>
        </div>
        <div className="mt-3 font-mono text-2xl text-white">
          {awaiting
            ? "Tartine kitchen running final bag check for ord-9421"
            : isRollback || isDone
              ? "Tartine reported the wrong bag was packed for ord-9421"
              : "Agent will suspend here once the hand-off is committed"}
        </div>
        <div className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">
          token: <span className="text-zinc-500">{TOKEN}</span>
        </div>
      </div>

      <div className="flex w-[320px] flex-col justify-center gap-3">
        <button
          type="button"
          disabled={!awaiting || triggered}
          onClick={onTrigger}
          className="w-full rounded-xl border border-fuchsia-500/50 bg-fuchsia-500/10 px-4 py-3 text-lg font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Kitchen: wrong bag!
        </button>
        <div className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">
          fires rollback hook
        </div>
      </div>
    </div>
  );
}

function CompensationStrip({
  comp,
}: {
  comp: Record<CompKey, CompState>;
}) {
  // Compensations run LIFO — render right-to-left so the visual unwind
  // reads backward relative to the forward strip above.
  const compOrder: CompKey[] = [
    "recallRouteFromDriverApp",
    "notifyCustomerOfCancellation",
    "releaseDriverFromOrder",
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Compensation · reverse order
        </span>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-fuchsia-400">
          ← unwind last-in-first-out
        </span>
      </div>
      <div className="grid grid-cols-3 gap-6">
        {compOrder.map((k, i) => (
          <CompCard
            key={k}
            step={compOrder.length - i}
            toolKey={k}
            state={comp[k]}
          />
        ))}
      </div>
    </div>
  );
}

function CompCard({
  step,
  toolKey,
  state,
}: {
  step: number;
  toolKey: CompKey;
  state: CompState;
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
      ? "shadow-[0_0_60px_-10px_rgba(232,121,249,0.7)]"
      : state.phase === "done"
        ? "shadow-[0_0_30px_-10px_rgba(232,121,249,0.35)]"
        : "";

  const dot =
    state.phase === "running"
      ? "bg-fuchsia-400 animate-pulse"
      : state.phase === "done"
        ? "bg-fuchsia-300"
        : "bg-zinc-700";

  return (
    <div
      className={`flex min-h-[180px] flex-col rounded-2xl border bg-zinc-950 p-6 transition ${borderClass} ${glowClass}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className={`h-3 w-3 rounded-full ${dot}`} />
          <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            undo {step}
          </span>
        </div>
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-fuchsia-400/70">
          undoes {labels.undoOf}
        </span>
      </div>
      <div className="mt-3 font-mono text-xl text-white">{labels.title}</div>

      <div className="mt-auto flex min-h-[56px] flex-col justify-end">
        {state.phase === "idle" && (
          <div className="font-mono text-sm text-zinc-600">queued</div>
        )}
        {state.phase === "running" && (
          <div className="font-mono text-sm text-fuchsia-300">unwinding…</div>
        )}
        {state.phase === "done" && (
          <div className="font-mono text-base text-fuchsia-200">
            {state.summary}
          </div>
        )}
      </div>
    </div>
  );
}
