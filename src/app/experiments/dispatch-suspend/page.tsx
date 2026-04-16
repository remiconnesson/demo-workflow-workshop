"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Dispatch · Suspend — Chapter 2 of the dispatch story.
//
// Chapter 1 (dispatch-retry) assigned Mika Tanaka to ord-9421 and absorbed
// a GPS flake. Here, Mika's phone disputes the run ("stuck behind a Bay
// Bridge on-ramp closure"). The DurableAgent triages, picks Priya Shah as
// the reroute candidate, then SUSPENDS awaiting a human dispatcher.
//
// The suspend lands via a single amber glow panel and a "Waiting on human"
// pill. The resume lands as that panel flipping to emerald and the
// downstream tool (refindDriver or holdAssignment) lighting up. No
// scrolling log — one status line, one hero state.
// ---------------------------------------------------------------------------

type ToolKey =
  | "getCurrentAssignment"
  | "readDriverDispute"
  | "listAvailableDriversExcluding"
  | "requestReassignApproval"
  | "refindDriver"
  | "holdAssignment";

type ToolState =
  | { phase: "idle" }
  | { phase: "running" }
  | { phase: "suspended"; token: string; from: string; to: string; rationale: string }
  | { phase: "done"; summary: string; approved?: boolean };

type AllTools = Record<ToolKey, ToolState>;

const INITIAL: AllTools = {
  getCurrentAssignment: { phase: "idle" },
  readDriverDispute: { phase: "idle" },
  listAvailableDriversExcluding: { phase: "idle" },
  requestReassignApproval: { phase: "idle" },
  refindDriver: { phase: "idle" },
  holdAssignment: { phase: "idle" },
};

const TOOL_LABELS: Record<ToolKey, { title: string; subtitle: string }> = {
  getCurrentAssignment: {
    title: "getCurrentAssignment",
    subtitle: "Who owns ord-9421?",
  },
  readDriverDispute: {
    title: "readDriverDispute",
    subtitle: "Read Mika's reroute request",
  },
  listAvailableDriversExcluding: {
    title: "listAvailableDriversExcluding",
    subtitle: "Find a reroute candidate",
  },
  requestReassignApproval: {
    title: "requestReassignApproval",
    subtitle: "Suspend — await dispatcher",
  },
  refindDriver: {
    title: "refindDriver",
    subtitle: "Hand-off to new driver",
  },
  holdAssignment: {
    title: "holdAssignment",
    subtitle: "Stick with original driver",
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

type Status =
  | { kind: "idle" }
  | { kind: "running"; message: string }
  | { kind: "suspended"; message: string }
  | { kind: "resumed"; message: string }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

export default function DispatchSuspendPage() {
  const [tools, setTools] = useState<AllTools>(INITIAL);
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, setPending] = useState<
    null | { token: string; from: string; to: string; rationale: string }
  >(null);
  const [decided, setDecided] = useState<null | {
    approved: boolean;
    token: string;
  }>(null);
  const activeToolByCallId = useRef<Map<string, ToolKey>>(new Map());

  const setTool = useCallback((key: ToolKey, next: ToolState) => {
    setTools((prev) => ({ ...prev, [key]: next }));
  }, []);

  const run = useCallback(async () => {
    setTools(INITIAL);
    setPending(null);
    setDecided(null);
    setStatus({ kind: "running", message: "Agent thinking…" });
    activeToolByCallId.current.clear();

    let res: Response;
    try {
      res = await fetch("/api/experiments/dispatch-suspend/start", {
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
      s.kind === "error" ? s : { kind: "done", message: "Order triaged." },
    );

    function handleChunk(chunk: Chunk) {
      const t = chunk.type ?? "";
      const callId = chunk.toolCallId ?? "";
      const name = (chunk.toolName ?? "") as ToolKey;

      if (t === "tool-input-start" || t === "tool-input-available") {
        if (isToolKey(name)) {
          activeToolByCallId.current.set(callId, name);
          if (name === "requestReassignApproval") {
            const input = (chunk.input ?? {}) as Record<string, unknown>;
            const from = (input.fromDriverId as string) ?? "drv-mika";
            const to = (input.toDriverId as string) ?? "drv-priya";
            const rationale =
              (input.rationale as string) ??
              "Reroute to closer available SOMA driver.";
            const orderId = (input.orderId as string) ?? "ord-9421";
            const token = `dispatch-suspend:${orderId}`;
            setTool(name, {
              phase: "suspended",
              token,
              from,
              to,
              rationale,
            });
            // tool-input-start fires before input is available; only surface
            // the pending card once we've got field values.
            if (t === "tool-input-available") {
              setPending({ token, from, to, rationale });
              setStatus({
                kind: "suspended",
                message: "Suspended · waiting on human dispatcher",
              });
            }
          } else {
            setTool(name, { phase: "running" });
            setStatus({
              kind: "running",
              message: statusFor(name, "running"),
            });
          }
        }
        return;
      }

      if (t === "tool-output-available") {
        const key =
          (isToolKey(name) && name) ||
          activeToolByCallId.current.get(callId);
        if (!key) return;
        const output = chunk.output as Record<string, unknown> | undefined;

        if (key === "requestReassignApproval") {
          const approved = Boolean(output?.approved);
          setTool(key, {
            phase: "done",
            summary: approved
              ? "Dispatcher approved reroute"
              : "Dispatcher rejected reroute",
            approved,
          });
          setPending(null);
          setStatus({
            kind: "resumed",
            message: approved
              ? "Resumed · dispatcher approved — rerouting"
              : "Resumed · dispatcher rejected — holding",
          });
          return;
        }

        const summary = summarize(key, output);
        setTool(key, { phase: "done", summary });
        setStatus((s) =>
          s.kind === "suspended"
            ? s
            : { kind: "running", message: statusFor(key, "done") },
        );
        return;
      }
    }
  }, [setTool]);

  const decide = useCallback(
    async (approved: boolean) => {
      if (!pending) return;
      setDecided({ approved, token: pending.token });
      try {
        await fetch("/api/experiments/dispatch-suspend/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: pending.token,
            approved,
            reason: approved
              ? "Dispatcher approved on stage"
              : "Dispatcher rejected on stage",
          }),
        });
      } catch {
        // network error — the workflow will stay suspended; ignore here.
      }
    },
    [pending],
  );

  const running =
    status.kind === "running" ||
    status.kind === "suspended" ||
    status.kind === "resumed";

  return (
    <div className="flex h-full w-full flex-col bg-black text-white">
      <header className="flex items-baseline justify-between border-b border-white/10 px-12 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Dispatch · Suspend · Chapter 2
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Driver disputes the run — agent suspends for a human call
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            Mika Tanaka is stuck behind a bridge closure. The DurableAgent
            picks a reroute candidate (Priya Shah), then calls{" "}
            <span className="font-mono text-amber-300">
              requestReassignApproval
            </span>{" "}
            — a workflow-level tool that creates a hook and awaits it. The
            run is durably suspended until the dispatcher decides. Same
            context, same loop, resumes mid-stream.
          </p>
        </div>
        <button
          type="button"
          onClick={run}
          disabled={running}
          className="rounded-xl bg-white px-6 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {running ? "Running…" : "Triage ord-9421 dispute"}
        </button>
      </header>

      <div className="flex flex-1 flex-col gap-8 px-12 py-10">
        <StatusLine status={status} />

        <SuspendPanel
          status={status}
          pending={pending}
          decided={decided}
          onDecide={decide}
        />

        <div className="grid grid-cols-3 gap-6">
          <ToolCard toolKey="getCurrentAssignment" state={tools.getCurrentAssignment} />
          <ToolCard toolKey="readDriverDispute" state={tools.readDriverDispute} />
          <ToolCard
            toolKey="listAvailableDriversExcluding"
            state={tools.listAvailableDriversExcluding}
          />
          <ToolCard
            toolKey="requestReassignApproval"
            state={tools.requestReassignApproval}
            accent="amber"
          />
          <ToolCard toolKey="refindDriver" state={tools.refindDriver} />
          <ToolCard toolKey="holdAssignment" state={tools.holdAssignment} />
        </div>
      </div>
    </div>
  );
}

function isToolKey(x: string): x is ToolKey {
  return (
    x === "getCurrentAssignment" ||
    x === "readDriverDispute" ||
    x === "listAvailableDriversExcluding" ||
    x === "requestReassignApproval" ||
    x === "refindDriver" ||
    x === "holdAssignment"
  );
}

function statusFor(key: ToolKey, phase: "running" | "done"): string {
  if (phase === "running") {
    if (key === "getCurrentAssignment") return "Reading current assignment…";
    if (key === "readDriverDispute") return "Reading driver dispute…";
    if (key === "listAvailableDriversExcluding")
      return "Scanning SOMA for reroute candidates…";
    if (key === "refindDriver") return "Reassigning driver…";
    if (key === "holdAssignment") return "Holding original assignment…";
    return "…";
  }
  if (key === "getCurrentAssignment") return "Assignment located.";
  if (key === "readDriverDispute") return "Dispute read.";
  if (key === "listAvailableDriversExcluding") return "Candidate found.";
  if (key === "refindDriver") return "Reassigned.";
  if (key === "holdAssignment") return "Held.";
  return "ok";
}

function summarize(key: ToolKey, output?: Record<string, unknown>): string {
  if (!output) return "ok";
  if (key === "getCurrentAssignment") {
    const name = (output.driverName as string) ?? "driver";
    return `${name} · ${(output.vehicle as string) ?? ""}`;
  }
  if (key === "readDriverDispute") {
    const delay = output.reportedEtaDelayMin ?? "?";
    return `Delay +${delay}m`;
  }
  if (key === "listAvailableDriversExcluding") {
    const list = Array.isArray(output) ? output : [];
    const first = (list[0] ?? {}) as Record<string, unknown>;
    return `${list.length} candidate${list.length === 1 ? "" : "s"} · top: ${
      (first.name as string) ?? "—"
    }`;
  }
  if (key === "refindDriver") {
    const name = (output.toDriverName as string) ?? "driver";
    const eta = (output.etaMin as number) ?? 0;
    return `${name} · ETA ${eta}m`;
  }
  if (key === "holdAssignment") {
    const extra = (output.extraEtaMin as number) ?? 0;
    return `Held · +${extra}m ETA`;
  }
  return "ok";
}

// ---------------------------------------------------------------------------
// UI pieces
// ---------------------------------------------------------------------------

function StatusLine({ status }: { status: Status }) {
  const color =
    status.kind === "suspended"
      ? "text-amber-300"
      : status.kind === "resumed"
        ? "text-emerald-300"
        : status.kind === "done"
          ? "text-emerald-300"
          : status.kind === "error"
            ? "text-red-400"
            : "text-zinc-400";
  const label =
    status.kind === "idle"
      ? "Idle · press Triage to begin"
      : status.kind === "running"
        ? status.message
        : status.kind === "suspended"
          ? status.message
          : status.kind === "resumed"
            ? status.message
            : status.kind === "done"
              ? status.message
              : `Error: ${status.message}`;

  return (
    <div className="flex h-10 items-center gap-4">
      <span
        className={`h-3 w-3 rounded-full ${
          status.kind === "suspended"
            ? "bg-amber-400 animate-pulse"
            : status.kind === "resumed"
              ? "bg-emerald-400 animate-pulse"
              : status.kind === "done"
                ? "bg-emerald-400"
                : status.kind === "running"
                  ? "bg-sky-400 animate-pulse"
                  : status.kind === "error"
                    ? "bg-red-500"
                    : "bg-zinc-700"
        }`}
      />
      <span className={`font-mono text-2xl ${color}`}>{label}</span>
    </div>
  );
}

function SuspendPanel({
  status,
  pending,
  decided,
  onDecide,
}: {
  status: Status;
  pending: null | { token: string; from: string; to: string; rationale: string };
  decided: null | { approved: boolean; token: string };
  onDecide: (approved: boolean) => void;
}) {
  const isSuspended = status.kind === "suspended" && !!pending;
  const isResumed =
    status.kind === "resumed" || (status.kind === "done" && decided !== null);

  // Always reserve space (CLS).
  const borderClass = isSuspended
    ? "border-amber-400/60"
    : isResumed
      ? decided?.approved
        ? "border-emerald-400/50"
        : "border-red-400/40"
      : "border-white/10";

  const glowClass = isSuspended
    ? "shadow-[0_0_80px_-10px_rgba(251,191,36,0.5)]"
    : isResumed && decided?.approved
      ? "shadow-[0_0_60px_-10px_rgba(52,211,153,0.4)]"
      : "";

  const fromName = nameFor(pending?.from ?? decided ? "drv-mika" : "");
  const toName = nameFor(pending?.to ?? "drv-priya");

  return (
    <div
      className={`flex min-h-[200px] items-stretch gap-8 rounded-2xl border bg-zinc-950 p-8 transition ${borderClass} ${glowClass}`}
    >
      <div className="flex flex-1 flex-col justify-center">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${
              isSuspended
                ? "bg-amber-400 animate-pulse"
                : isResumed
                  ? decided?.approved
                    ? "bg-emerald-400"
                    : "bg-red-400"
                  : "bg-zinc-700"
            }`}
          />
          <span
            className={`text-sm font-semibold uppercase tracking-[0.2em] ${
              isSuspended
                ? "text-amber-300"
                : isResumed
                  ? decided?.approved
                    ? "text-emerald-300"
                    : "text-red-300"
                  : "text-zinc-500"
            }`}
          >
            {isSuspended
              ? "Waiting on human"
              : isResumed
                ? decided?.approved
                  ? "Resumed — reroute approved"
                  : "Resumed — reroute rejected"
                : "Hook slot"}
          </span>
        </div>

        <div className="mt-4 font-mono text-3xl text-white">
          {isSuspended || isResumed
            ? `Reassign ${fromName} → ${toName}?`
            : "No pending approval"}
        </div>

        <div className="mt-3 max-w-xl text-base text-zinc-400">
          {pending?.rationale ??
            (isResumed
              ? decided?.approved
                ? "Dispatcher approved. Workflow resumed mid-loop with the decision in hand."
                : "Dispatcher rejected. Agent will hold the original driver."
              : "When the agent calls requestReassignApproval, the run suspends here.")}
        </div>

        {(isSuspended || isResumed) && pending ? null : null}
      </div>

      <div className="flex w-[300px] flex-col justify-center gap-3">
        <button
          type="button"
          disabled={!isSuspended || decided !== null}
          onClick={() => onDecide(true)}
          className="w-full rounded-xl bg-white px-4 py-3 text-lg font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
        >
          Approve reroute
        </button>
        <button
          type="button"
          disabled={!isSuspended || decided !== null}
          onClick={() => onDecide(false)}
          className="w-full rounded-xl border border-red-500/40 px-4 py-3 text-lg font-semibold text-red-400 transition hover:bg-red-500/5 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Reject · hold driver
        </button>
        <div className="mt-2 font-mono text-xs uppercase tracking-[0.2em] text-zinc-600">
          token:{" "}
          <span className="text-zinc-500">
            {pending?.token ?? "dispatch-suspend:ord-9421"}
          </span>
        </div>
      </div>
    </div>
  );
}

function nameFor(id: string): string {
  if (id === "drv-mika") return "Mika";
  if (id === "drv-priya") return "Priya";
  if (id === "drv-rafa") return "Rafa";
  return id || "—";
}

function ToolCard({
  toolKey,
  state,
  accent,
}: {
  toolKey: ToolKey;
  state: ToolState;
  accent?: "amber";
}) {
  const labels = TOOL_LABELS[toolKey];

  const borderClass =
    state.phase === "suspended"
      ? "border-amber-400/60"
      : state.phase === "running"
        ? "border-sky-400/40"
        : state.phase === "done"
          ? state.approved === false
            ? "border-red-400/40"
            : accent === "amber" && state.approved
              ? "border-emerald-400/40"
              : "border-emerald-400/40"
          : accent === "amber"
            ? "border-amber-400/20"
            : "border-white/10";

  const glowClass =
    state.phase === "suspended"
      ? "shadow-[0_0_60px_-10px_rgba(251,191,36,0.55)]"
      : "";

  const dot =
    state.phase === "suspended"
      ? "bg-amber-400 animate-pulse"
      : state.phase === "running"
        ? "bg-sky-400 animate-pulse"
        : state.phase === "done"
          ? state.approved === false
            ? "bg-red-400"
            : "bg-emerald-400"
          : "bg-zinc-700";

  return (
    <div
      className={`flex min-h-[180px] flex-col rounded-2xl border bg-zinc-950 p-6 transition ${borderClass} ${glowClass}`}
    >
      <div className="flex items-center gap-3">
        <span className={`h-3 w-3 rounded-full ${dot}`} />
        <span className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
          tool
        </span>
      </div>
      <div className="mt-3 font-mono text-xl text-white">{labels.title}</div>
      <div className="mt-1 text-sm text-zinc-500">{labels.subtitle}</div>

      <div className="mt-auto flex min-h-[48px] flex-col justify-end">
        {state.phase === "idle" && (
          <div className="font-mono text-sm text-zinc-600">queued</div>
        )}
        {state.phase === "running" && (
          <div className="font-mono text-sm text-sky-300">running…</div>
        )}
        {state.phase === "suspended" && (
          <div className="flex flex-col gap-1">
            <span className="font-mono text-sm uppercase tracking-[0.2em] text-amber-300">
              awaiting hook
            </span>
            <span className="font-mono text-xs text-zinc-500">
              {state.token}
            </span>
          </div>
        )}
        {state.phase === "done" && (
          <div
            className={`font-mono text-base ${
              state.approved === false ? "text-red-200" : "text-emerald-200"
            }`}
          >
            {state.summary}
          </div>
        )}
      </div>
    </div>
  );
}
