"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Kitchen coordinator · Rollback demo  (Chapter 3)
//
// Ticket tkt-8821 is on the line. The chef approved the Ham & Cheese
// Croissant swap in ch.2. Now the DurableAgent fires prep in three forward
// tools (fireKitchenStation → reserveSubstitutionStock → alertExpeditor),
// then suspends on a durable cancel hook. If the presenter taps "Guest
// cancels in the app", the /cancel route resumes the hook with
// { cancel: true }, the agent throws, and the four compensation tools run
// in REVERSE order: standDownExpeditor → releaseSubstitutionStock →
// killKitchenStation → voidTicket. The reverse unwind is the demo beat.
// ---------------------------------------------------------------------------

type ToolStatus = "pending" | "running" | "suspended" | "done" | "error";

type ToolCall = {
  toolCallId: string;
  toolName: string;
  status: ToolStatus;
  input?: unknown;
  output?: unknown;
};

type WireChunk =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | {
      type: "tool-input-available";
      toolCallId: string;
      toolName: string;
      input: unknown;
    }
  | { type: "tool-output-available"; toolCallId: string; output: unknown }
  | { type: "tool-output-error"; toolCallId: string; errorText: string }
  | { type: string; [k: string]: unknown };

const TICKET_ID = "tkt-8821";
const HOOK_TOKEN = `kitchen-rollback:${TICKET_ID}`;

const FORWARD_TOOLS = [
  "fireKitchenStation",
  "reserveSubstitutionStock",
  "alertExpeditor",
] as const;

// Compensation tools listed in the REVERSE order the agent should call them.
// This order drives the top-to-bottom fill of the right-hand column, so the
// audience reads the unwind top-down even though it's logically bottom-up.
const COMPENSATION_TOOLS = [
  "standDownExpeditor",
  "releaseSubstitutionStock",
  "killKitchenStation",
  "voidTicket",
] as const;

const COMPENSATION_SET = new Set<string>(COMPENSATION_TOOLS);

const TOOL_ROLE: Record<string, string> = {
  fireKitchenStation: "Line fire",
  reserveSubstitutionStock: "Walk-in reservation",
  alertExpeditor: "Expo KDS light",
  watchForCustomerCancel: "Cancel hook (suspend)",
  standDownExpeditor: "Undo: clear KDS row",
  releaseSubstitutionStock: "Undo: return to walk-in",
  killKitchenStation: "Undo: burner off",
  voidTicket: "Undo: void printer ticket",
};

function formatValue(v: unknown): string {
  if (v === undefined) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

export default function KitchenRollbackPage() {
  const [status, setStatus] = useState<
    "idle" | "running" | "suspended" | "rolling-back" | "done" | "error"
  >("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [finalText, setFinalText] = useState("");
  const [tools, setTools] = useState<ToolCall[]>([]);
  const [cancelSignal, setCancelSignal] = useState<
    "none" | "sent" | "failed"
  >("none");
  const abortRef = useRef<AbortController | null>(null);

  const upsertTool = useCallback(
    (id: string, updater: (prev: ToolCall | undefined) => ToolCall) => {
      setTools((prev) => {
        const idx = prev.findIndex((t) => t.toolCallId === id);
        if (idx === -1) return [...prev, updater(undefined)];
        const next = [...prev];
        next[idx] = updater(prev[idx]);
        return next;
      });
    },
    [],
  );

  const run = useCallback(async () => {
    setStatus("running");
    setFinalText("");
    setTools([]);
    setCancelSignal("none");
    setRunId(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/experiments/kitchen-rollback/start", {
        method: "POST",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      setRunId(res.headers.get("x-workflow-run-id"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        let nl = buf.indexOf("\n");
        while (nl !== -1) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line) {
            try {
              const chunk = JSON.parse(line) as WireChunk;
              handleChunk(chunk);
            } catch {
              // skip malformed
            }
          }
          nl = buf.indexOf("\n");
        }
      }
      setStatus((prev) => (prev === "error" ? prev : "done"));
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[kitchen-rollback] stream error", err);
      setStatus("error");
    }

    function handleChunk(chunk: WireChunk) {
      switch (chunk.type) {
        case "text-delta": {
          const delta = (chunk as { delta?: string }).delta ?? "";
          setFinalText((prev) => prev + delta);
          break;
        }
        case "tool-input-start": {
          const c = chunk as { toolCallId: string; toolName: string };
          const isSuspend = c.toolName === "watchForCustomerCancel";
          const isComp = COMPENSATION_SET.has(c.toolName);
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: c.toolName,
            status: isSuspend ? "suspended" : "running",
            input: prev?.input,
            output: prev?.output,
          }));
          if (isSuspend) setStatus("suspended");
          if (isComp) setStatus("rolling-back");
          break;
        }
        case "tool-input-available": {
          const c = chunk as {
            toolCallId: string;
            toolName: string;
            input: unknown;
          };
          const isSuspend = c.toolName === "watchForCustomerCancel";
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: c.toolName,
            status:
              prev?.status === "done"
                ? "done"
                : isSuspend
                  ? "suspended"
                  : "running",
            input: c.input,
            output: prev?.output,
          }));
          break;
        }
        case "tool-output-available": {
          const c = chunk as { toolCallId: string; output: unknown };
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: prev?.toolName ?? "(tool)",
            status: "done",
            input: prev?.input,
            output: c.output,
          }));
          // If the cancel hook resolved, branch on the payload.
          const out = c.output as
            | { cancel?: boolean; reason?: string | null }
            | null;
          if (out && typeof out.cancel === "boolean") {
            setStatus(out.cancel ? "rolling-back" : "running");
          }
          break;
        }
        case "tool-output-error": {
          const c = chunk as { toolCallId: string; errorText: string };
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: prev?.toolName ?? "(tool)",
            status: "error",
            input: prev?.input,
            output: { error: c.errorText },
          }));
          break;
        }
        default:
          break;
      }
    }
  }, [upsertTool]);

  const cancelTicket = useCallback(async () => {
    try {
      const res = await fetch("/api/experiments/kitchen-rollback/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticketId: TICKET_ID,
          reason: "Guest reported allergy concern via the Tartine app",
        }),
      });
      if (!res.ok) {
        setCancelSignal("failed");
        return;
      }
      setCancelSignal("sent");
    } catch (err) {
      console.error("[kitchen-rollback] cancel failed", err);
      setCancelSignal("failed");
    }
  }, []);

  const running = status === "running";
  const suspended = status === "suspended";
  const rolling = status === "rolling-back";
  const completedCompensations = tools.filter(
    (t) => COMPENSATION_SET.has(t.toolName) && t.status === "done",
  ).length;

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-10 py-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Kitchen coordinator · Rollback
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Tartine Bakery · ticket tkt-8821 · guest cancel mid-prep
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-600">
            {runId ?? "run pending"}
          </span>
          <button
            type="button"
            onClick={run}
            disabled={running || suspended || rolling}
            className="rounded-xl bg-white px-5 py-2.5 text-base font-semibold text-black transition disabled:opacity-40"
          >
            {running
              ? "Firing…"
              : suspended
                ? "Watching"
                : rolling
                  ? "Unwinding…"
                  : status === "done"
                    ? "Run again"
                    : "Fire prep"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-6 overflow-hidden px-10 py-8">
        {/* Forward column */}
        <div className="flex w-[460px] shrink-0 flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Forward · fire
            </p>
            <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-emerald-400">
              happy path
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {FORWARD_TOOLS.map((name) => {
              const call = tools.find((t) => t.toolName === name);
              return (
                <ToolCard
                  key={name}
                  name={name}
                  role={TOOL_ROLE[name] ?? name}
                  call={call}
                  variant="forward"
                  dimmed={rolling}
                />
              );
            })}
          </div>
        </div>

        {/* Middle column: cancel control + agent prose */}
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          {/* Guest cancel tablet — reserved slot, fades on/off */}
          <div
            className={`flex min-h-[180px] flex-col justify-between rounded-2xl border p-6 transition-colors duration-500 ${
              suspended
                ? "border-amber-400/50 bg-amber-500/10"
                : cancelSignal === "sent" || rolling
                  ? "border-fuchsia-400/50 bg-fuchsia-500/10"
                  : "border-white/10 bg-zinc-950"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full ${
                    suspended
                      ? "animate-pulse bg-amber-400"
                      : rolling
                        ? "animate-pulse bg-fuchsia-400"
                        : cancelSignal === "sent"
                          ? "bg-fuchsia-400"
                          : "bg-zinc-600"
                  }`}
                />
                <span
                  className={`font-mono text-sm uppercase tracking-[0.2em] ${
                    suspended
                      ? "text-amber-300"
                      : rolling
                        ? "text-fuchsia-300"
                        : cancelSignal === "sent"
                          ? "text-fuchsia-300"
                          : "text-zinc-500"
                  }`}
                >
                  {suspended
                    ? "Watching for guest signal"
                    : rolling
                      ? "Unwinding in reverse"
                      : cancelSignal === "sent"
                        ? "Cancel signal dispatched"
                        : "Tartine app · idle"}
                </span>
              </div>
              <span className="font-mono text-xs text-zinc-600">
                hook {HOOK_TOKEN}
              </span>
            </div>

            <p className="text-xl leading-snug text-zinc-100">
              Guest message:{" "}
              <span className="font-mono text-fuchsia-200">
                “Cancel the ticket — allergy concern.”
              </span>
            </p>

            <button
              type="button"
              onClick={cancelTicket}
              disabled={!suspended}
              className="w-full rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 px-5 py-3 text-base font-semibold text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:opacity-30"
            >
              Guest cancels in the app
            </button>
          </div>

          {/* Agent prose */}
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-zinc-950 p-7">
            <div className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  status === "done"
                    ? "bg-emerald-400"
                    : status === "error"
                      ? "bg-red-400"
                      : status === "rolling-back"
                        ? "animate-pulse bg-fuchsia-400"
                        : status === "suspended"
                          ? "animate-pulse bg-amber-400"
                          : status === "running"
                            ? "animate-pulse bg-sky-400"
                            : "bg-zinc-600"
                }`}
              />
              <span className="font-mono text-sm uppercase tracking-[0.2em] text-zinc-500">
                {status === "idle"
                  ? "Idle"
                  : status === "running"
                    ? "Agent firing ticket"
                    : status === "suspended"
                      ? "Suspended on cancel hook"
                      : status === "rolling-back"
                        ? "Rolling back in reverse"
                        : status === "done"
                          ? "Complete"
                          : "Error"}
              </span>
            </div>
            <div className="mt-5 whitespace-pre-wrap text-xl leading-snug text-zinc-100">
              {finalText || (
                <span className="text-zinc-600">
                  Click “Fire prep” — the agent will fire the station, reserve
                  stock, alert expo, and then watch for a cancel.
                </span>
              )}
            </div>

            <div className="mt-auto border-t border-white/5 pt-5">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Durability note
              </p>
              <p className="mt-2 text-base leading-relaxed text-zinc-400">
                {rolling || completedCompensations > 0 ? (
                  <>
                    Cancel hook{" "}
                    <span className="font-mono text-fuchsia-300">
                      {HOOK_TOKEN}
                    </span>{" "}
                    resumed with{" "}
                    <span className="font-mono text-fuchsia-300">
                      cancel:true
                    </span>
                    . The agent is unwinding its tool calls in reverse — same
                    loop, no fresh plan needed.
                  </>
                ) : suspended ? (
                  <>
                    The three forward tools ran as steps. The agent is parked
                    on{" "}
                    <span className="font-mono text-amber-300">
                      watchForCustomerCancel
                    </span>
                    . The run is durable — the process can restart and the
                    cancel will still resume it.
                  </>
                ) : (
                  <>
                    Forward tools push compensations onto the agent&apos;s
                    stack. When the cancel hook fires, the stack unwinds in
                    reverse — the canonical saga pattern, driven by a
                    DurableAgent.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Reverse column */}
        <div className="flex w-[460px] shrink-0 flex-col gap-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Reverse · unwind
            </p>
            <span
              className={`font-mono text-[11px] uppercase tracking-[0.2em] ${
                rolling || completedCompensations > 0
                  ? "text-fuchsia-300"
                  : "text-zinc-600"
              }`}
            >
              saga rollback
            </span>
          </div>
          <div className="flex flex-col gap-3">
            {COMPENSATION_TOOLS.map((name) => {
              const call = tools.find((t) => t.toolName === name);
              return (
                <ToolCard
                  key={name}
                  name={name}
                  role={TOOL_ROLE[name] ?? name}
                  call={call}
                  variant="compensation"
                />
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ToolCard — fixed-size, state via color + pill (CLS-safe)
// ---------------------------------------------------------------------------

function ToolCard({
  name,
  role,
  call,
  variant,
  dimmed = false,
}: {
  name: string;
  role: string;
  call: ToolCall | undefined;
  variant: "forward" | "compensation";
  dimmed?: boolean;
}) {
  const status: ToolStatus = call?.status ?? "pending";
  const isComp = variant === "compensation";

  const border =
    status === "done"
      ? isComp
        ? "border-fuchsia-400/50"
        : "border-emerald-400/40"
      : status === "suspended"
        ? "border-amber-400/60"
        : status === "running"
          ? isComp
            ? "border-fuchsia-400/60"
            : "border-sky-400/40"
          : status === "error"
            ? "border-red-400/40"
            : "border-white/10";

  const pill =
    status === "done"
      ? isComp
        ? "border-fuchsia-400/40 bg-fuchsia-500/15 text-fuchsia-200"
        : "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
      : status === "suspended"
        ? "border-amber-400/60 bg-amber-500/15 text-amber-200 animate-pulse"
        : status === "running"
          ? isComp
            ? "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200 animate-pulse"
            : "border-sky-400/40 bg-sky-500/10 text-sky-300"
          : status === "error"
            ? "border-red-400/40 bg-red-500/10 text-red-300"
            : "border-white/10 bg-white/5 text-zinc-500";

  const pillLabel =
    status === "done"
      ? isComp
        ? "COMPENSATED"
        : "DONE"
      : status === "suspended"
        ? "WAITING"
        : status === "running"
          ? isComp
            ? "UNWINDING"
            : "RUNNING"
          : status === "error"
            ? "ERROR"
            : "WAITING";

  // Forward cards dim when rolling back, to emphasise the reverse column.
  const dimClass = dimmed && !isComp && status === "done" ? "opacity-50" : "";

  return (
    <div
      className={`flex min-h-[140px] flex-col gap-2 overflow-hidden rounded-xl border bg-zinc-950 p-5 transition-all duration-300 ${border} ${dimClass}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span className="truncate font-mono text-base text-zinc-100">
          {name}
        </span>
        <span
          className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${pill}`}
        >
          {pillLabel}
        </span>
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
        {role}
      </p>

      <div className="mt-1 min-h-[48px] font-mono text-xs leading-relaxed text-zinc-400">
        {call?.output ? (
          <span className="text-zinc-300">
            {truncate(formatValue(call.output), 160)}
          </span>
        ) : call?.input ? (
          <span>{truncate(formatValue(call.input), 160)}</span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </div>
    </div>
  );
}
