"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Kitchen coordinator · Suspend demo  (Chapter 2)
//
// Ticket tkt-8821 is live. Morning Bun just got 86'd. The agent probes
// substitution options, then calls requestChefApproval — a workflow-level
// tool that creates a durable hook and awaits. The run pauses (amber
// "WAITING FOR CHEF"). The chef taps Approve or Reject on the KDS tablet
// strip, which POSTs to /api/experiments/kitchen-suspend/approve with a
// deterministic token. The agent loop resumes and either rewrites the line
// or notes the refund path.
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
const HOOK_TOKEN = `kitchen-suspend:${TICKET_ID}`;

const TOOL_ROLE: Record<string, string> = {
  checkSubstitutionOptions: "Pastry station probe",
  requestChefApproval: "Chef decision (suspend)",
  updateTicketItem: "Reprint to expeditor",
};

function formatValue(v: unknown): string {
  if (v === undefined) return "—";
  if (typeof v === "string") return v;
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  return `${s.slice(0, n)}…`;
}

export default function KitchenSuspendPage() {
  const [status, setStatus] = useState<
    "idle" | "running" | "suspended" | "done" | "error"
  >("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [finalText, setFinalText] = useState("");
  const [tools, setTools] = useState<ToolCall[]>([]);
  const [decision, setDecision] = useState<
    "none" | "approved" | "rejected"
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
    setDecision("none");
    setRunId(null);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/experiments/kitchen-suspend/start", {
        method: "POST",
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      setRunId(res.headers.get("X-Run-Id"));

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
      setStatus("done");
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      console.error("[kitchen-suspend] stream error", err);
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
          const suspended = c.toolName === "requestChefApproval";
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: c.toolName,
            status: suspended ? "suspended" : "running",
            input: prev?.input,
            output: prev?.output,
          }));
          if (suspended) setStatus("suspended");
          break;
        }
        case "tool-input-available": {
          const c = chunk as {
            toolCallId: string;
            toolName: string;
            input: unknown;
          };
          const suspended = c.toolName === "requestChefApproval";
          upsertTool(c.toolCallId, (prev) => ({
            toolCallId: c.toolCallId,
            toolName: c.toolName,
            status:
              prev?.status === "done"
                ? "done"
                : suspended
                  ? "suspended"
                  : "running",
            input: c.input,
            output: prev?.output,
          }));
          if (suspended) setStatus("suspended");
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
          // If chef approval resolved, move back to running until final text.
          const out = c.output as { approved?: boolean } | null;
          if (out && typeof out.approved === "boolean") {
            setStatus("running");
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

  const respond = useCallback(
    async (approved: boolean) => {
      setDecision(approved ? "approved" : "rejected");
      try {
        await fetch("/api/experiments/kitchen-suspend/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: HOOK_TOKEN,
            approved,
            reason: approved
              ? "Croissants are fresh — go ahead."
              : "Comp the line — guest prefers a refund.",
          }),
        });
      } catch (err) {
        console.error("[kitchen-suspend] approve failed", err);
      }
    },
    [],
  );

  const running = status === "running";
  const suspended = status === "suspended";
  const approvalCall = tools.find(
    (t) => t.toolName === "requestChefApproval",
  );
  const subCall = tools.find(
    (t) => t.toolName === "checkSubstitutionOptions",
  );
  const suggested =
    (subCall?.output as
      | { suggestedSubstitution?: { name?: string } }
      | undefined)?.suggestedSubstitution?.name ?? "Ham & Cheese Croissant";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black text-white">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-10 py-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Kitchen coordinator · Suspend
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            Tartine Bakery · ticket tkt-8821 · Morning Bun 86&apos;d
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-zinc-600">
            {runId ?? "run pending"}
          </span>
          <button
            type="button"
            onClick={run}
            disabled={running || suspended}
            className="rounded-xl bg-white px-5 py-2.5 text-base font-semibold text-black transition disabled:opacity-40"
          >
            {running
              ? "Running…"
              : suspended
                ? "Suspended"
                : status === "done"
                  ? "Run again"
                  : "Page the chef"}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex min-h-0 flex-1 gap-8 overflow-hidden px-10 py-8">
        {/* Left: tool ladder */}
        <div className="flex w-[640px] shrink-0 flex-col gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Tool calls
          </p>
          <div className="flex flex-col gap-4">
            {[
              "checkSubstitutionOptions",
              "requestChefApproval",
              "updateTicketItem",
            ].map((name) => {
              const call = tools.find((t) => t.toolName === name);
              return (
                <ToolCard
                  key={name}
                  name={name}
                  role={TOOL_ROLE[name] ?? name}
                  call={call}
                />
              );
            })}
          </div>
        </div>

        {/* Right: chef tablet + agent prose */}
        <div className="flex min-w-0 flex-1 flex-col gap-6">
          {/* Chef approval tablet — reserved slot, fades on/off */}
          <div
            className={`flex min-h-[220px] flex-col justify-between rounded-2xl border p-6 transition-colors duration-500 ${
              suspended
                ? "border-amber-400/50 bg-amber-500/10"
                : decision !== "none"
                  ? decision === "approved"
                    ? "border-emerald-400/40 bg-emerald-500/5"
                    : "border-red-400/40 bg-red-500/5"
                  : "border-white/10 bg-zinc-950"
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className={`h-3 w-3 rounded-full ${
                    suspended
                      ? "animate-pulse bg-amber-400"
                      : decision === "approved"
                        ? "bg-emerald-400"
                        : decision === "rejected"
                          ? "bg-red-400"
                          : "bg-zinc-600"
                  }`}
                />
                <span
                  className={`font-mono text-sm uppercase tracking-[0.2em] ${
                    suspended
                      ? "text-amber-300"
                      : decision === "approved"
                        ? "text-emerald-300"
                        : decision === "rejected"
                          ? "text-red-300"
                          : "text-zinc-500"
                  }`}
                >
                  {suspended
                    ? "Waiting for chef"
                    : decision === "approved"
                      ? "Chef approved"
                      : decision === "rejected"
                        ? "Chef rejected"
                        : "KDS tablet · idle"}
                </span>
              </div>
              <span className="font-mono text-xs text-zinc-600">
                hook {HOOK_TOKEN}
              </span>
            </div>

            <p className="text-2xl leading-snug text-zinc-100">
              Sub{" "}
              <span className="font-mono text-amber-200">Morning Bun</span> →{" "}
              <span className="font-mono text-amber-200">{suggested}</span>?
            </p>

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => respond(true)}
                disabled={!suspended}
                className="flex-1 rounded-xl bg-white px-5 py-3 text-base font-semibold text-black transition disabled:opacity-30"
              >
                Approve substitution
              </button>
              <button
                type="button"
                onClick={() => respond(false)}
                disabled={!suspended}
                className="flex-1 rounded-xl border border-red-500/40 bg-transparent px-5 py-3 text-base font-semibold text-red-300 transition disabled:opacity-30"
              >
                Reject · refund line
              </button>
            </div>
          </div>

          {/* Agent prose */}
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl border border-white/10 bg-zinc-950 p-8">
            <div className="flex items-center gap-3">
              <span
                className={`h-3 w-3 rounded-full ${
                  status === "done"
                    ? "bg-emerald-400"
                    : status === "error"
                      ? "bg-red-400"
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
                    ? "Agent thinking"
                    : status === "suspended"
                      ? "Suspended on hook"
                      : status === "done"
                        ? "Complete"
                        : "Error"}
              </span>
            </div>
            <div className="mt-6 whitespace-pre-wrap text-2xl leading-snug text-zinc-100">
              {finalText || (
                <span className="text-zinc-600">
                  Click “Page the chef” — the agent will probe the pastry
                  station and suspend on the chef&apos;s decision.
                </span>
              )}
            </div>

            <div className="mt-auto border-t border-white/5 pt-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Durability note
              </p>
              <p className="mt-2 text-lg leading-relaxed text-zinc-400">
                {suspended ? (
                  <>
                    The agent called{" "}
                    <span className="font-mono text-amber-300">
                      requestChefApproval
                    </span>
                    . A durable hook was created under token{" "}
                    <span className="font-mono text-amber-300">
                      {HOOK_TOKEN}
                    </span>
                    . The run is paused — the process can restart and the
                    agent will resume from this line when the chef taps.
                  </>
                ) : approvalCall?.output ? (
                  <>
                    Hook{" "}
                    <span className="font-mono text-amber-300">
                      {HOOK_TOKEN}
                    </span>{" "}
                    resumed. The agent continued mid-thought with the chef&apos;s
                    decision in scope — same loop, nothing rebuilt.
                  </>
                ) : (
                  <>
                    When the agent needs human judgement, it creates a
                    durable hook and awaits. The run parks; the SDK wakes it
                    up when <span className="font-mono">/approve</span> is
                    POSTed.
                  </>
                )}
              </p>
            </div>
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
}: {
  name: string;
  role: string;
  call: ToolCall | undefined;
}) {
  const status: ToolStatus = call?.status ?? "pending";

  const border =
    status === "done"
      ? "border-emerald-400/40"
      : status === "suspended"
        ? "border-amber-400/60"
        : status === "running"
          ? "border-sky-400/40"
          : status === "error"
            ? "border-red-400/40"
            : "border-white/10";

  const pill =
    status === "done"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
      : status === "suspended"
        ? "border-amber-400/60 bg-amber-500/15 text-amber-200 animate-pulse"
        : status === "running"
          ? "border-sky-400/40 bg-sky-500/10 text-sky-300"
          : status === "error"
            ? "border-red-400/40 bg-red-500/10 text-red-300"
            : "border-white/10 bg-white/5 text-zinc-500";

  const pillLabel =
    status === "done"
      ? "DONE"
      : status === "suspended"
        ? "WAITING"
        : status === "running"
          ? "RUNNING"
          : status === "error"
            ? "ERROR"
            : "WAITING";

  const highlight = name === "requestChefApproval";

  return (
    <div
      className={`flex min-h-[168px] flex-col gap-2 overflow-hidden rounded-xl border bg-zinc-950 p-5 transition-colors duration-300 ${border} ${
        highlight && status === "suspended" ? "ring-2 ring-amber-400/50" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="font-mono text-lg text-zinc-100">{name}</span>
          {highlight ? (
            <span className="rounded-md border border-amber-400/30 bg-amber-500/5 px-2 py-0.5 font-mono text-[11px] uppercase tracking-[0.18em] text-amber-300">
              hook
            </span>
          ) : null}
        </div>
        <span
          className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${pill}`}
        >
          {pillLabel}
        </span>
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
        {role}
      </p>

      <div className="mt-1 min-h-[54px] font-mono text-xs leading-relaxed text-zinc-400">
        {call?.output ? (
          <span className="text-zinc-300">
            {truncate(formatValue(call.output), 180)}
          </span>
        ) : call?.input ? (
          <span>{truncate(formatValue(call.input), 180)}</span>
        ) : (
          <span className="text-zinc-600">—</span>
        )}
      </div>
    </div>
  );
}
