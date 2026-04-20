"use client";

import { useCallback, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Support · Rollback  —  Chapter 3 of Elena Ruiz's complaint story.
//
// The agent runs six defensive steps forward (void voucher → reverse refund
// → retract apology → flag fraud → post risk note → await verdict). Then
// the Risk team clears Elena, and the saga compensation stack pops in
// REVERSE order: scrub note → clear flag → resend apology → re-issue
// refund → re-mint voucher. Fuchsia glow marks the unwind.
// ---------------------------------------------------------------------------

const TICKET_ID = "tkt-4417";
const HOOK_TOKEN = `support-rollback:${TICKET_ID}`;

type ForwardKey =
  | "classifyFraudSignals"
  | "voidCompVoucher"
  | "reverseRefund"
  | "retractApologyEmail"
  | "flagAccountForFraud"
  | "postRiskNote"
  | "awaitRiskVerdict";

type CompKey =
  | "scrubRiskNote"
  | "clearFraudFlag"
  | "resendApologyEmail"
  | "reissueRefund"
  | "remintCompVoucher";

type ForwardStatus = "idle" | "running" | "waiting" | "done" | "undone";

type ForwardState = {
  key: ForwardKey;
  label: string;
  sub: string;
  inverse?: CompKey;
  status: ForwardStatus;
  detail?: string;
};

type CompState = {
  key: CompKey;
  label: string;
  sub: string;
  status: "pending" | "running" | "done";
  detail?: string;
};

const INITIAL_FORWARD: ForwardState[] = [
  {
    key: "classifyFraudSignals",
    label: "Classify fraud signals",
    sub: "Repeat · new card · ZIP mismatch",
    status: "idle",
  },
  {
    key: "voidCompVoucher",
    label: "Void comp voucher",
    sub: "Rewards · COMP-TKT417",
    inverse: "remintCompVoucher",
    status: "idle",
  },
  {
    key: "reverseRefund",
    label: "Reverse refund",
    sub: "Stripe clawback · $18.75",
    inverse: "reissueRefund",
    status: "idle",
  },
  {
    key: "retractApologyEmail",
    label: "Retract apology email",
    sub: "Resend · 'under review'",
    inverse: "resendApologyEmail",
    status: "idle",
  },
  {
    key: "flagAccountForFraud",
    label: "Flag account for fraud",
    sub: "Risk queue",
    inverse: "clearFraudFlag",
    status: "idle",
  },
  {
    key: "postRiskNote",
    label: "Post risk note",
    sub: "Risk queue · one-liner",
    inverse: "scrubRiskNote",
    status: "idle",
  },
  {
    key: "awaitRiskVerdict",
    label: "Await risk verdict",
    sub: "Durable hook · Risk team",
    status: "idle",
  },
];

const INITIAL_COMPENSATIONS: Record<CompKey, CompState> = {
  scrubRiskNote: {
    key: "scrubRiskNote",
    label: "Scrub risk note",
    sub: "undoes postRiskNote",
    status: "pending",
  },
  clearFraudFlag: {
    key: "clearFraudFlag",
    label: "Clear fraud flag",
    sub: "undoes flagAccountForFraud",
    status: "pending",
  },
  resendApologyEmail: {
    key: "resendApologyEmail",
    label: "Resend apology email",
    sub: "undoes retractApologyEmail",
    status: "pending",
  },
  reissueRefund: {
    key: "reissueRefund",
    label: "Re-issue refund",
    sub: "undoes reverseRefund",
    status: "pending",
  },
  remintCompVoucher: {
    key: "remintCompVoucher",
    label: "Re-mint comp voucher",
    sub: "undoes voidCompVoucher",
    status: "pending",
  },
};

type ChunkLike = {
  type?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  delta?: string;
  data?: {
    type?: "compensating" | "compensated" | "terminal";
    action?: CompKey;
    label?: string;
    outcome?: "fraud-confirmed" | "false-positive";
  };
};

type Phase =
  | "idle"
  | "reversing"
  | "suspended"
  | "unwinding"
  | "restored"
  | "locked";

export default function SupportRollbackPage() {
  const [forward, setForward] = useState<ForwardState[]>(INITIAL_FORWARD);
  const [compStack, setCompStack] = useState<CompKey[]>([]);
  const [comps, setComps] = useState<Record<CompKey, CompState>>(
    INITIAL_COMPENSATIONS,
  );
  const [phase, setPhase] = useState<Phase>("idle");
  const [summary, setSummary] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);
  const [verdictPending, setVerdictPending] = useState(false);
  const summaryRef = useRef("");

  const updateForward = useCallback(
    (key: ForwardKey, patch: Partial<ForwardState>) => {
      setForward((prev) =>
        prev.map((t) => (t.key === key ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const run = useCallback(async () => {
    setForward(INITIAL_FORWARD);
    setComps(INITIAL_COMPENSATIONS);
    setCompStack([]);
    setSummary("");
    summaryRef.current = "";
    setPhase("reversing");
    setVerdictPending(false);

    try {
      const res = await fetch("/api/experiments/support-rollback/start", {
        method: "POST",
      });
      setRunId(res.headers.get("x-workflow-run-id"));
      if (!res.body) throw new Error("no stream");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: ChunkLike;
          try {
            chunk = JSON.parse(line) as ChunkLike;
          } catch {
            continue;
          }
          handleChunk(chunk);
        }
      }
    } catch (err) {
      console.error("[support-rollback] stream error", err);
      setPhase("idle");
    }
  }, []);

  const handleChunk = useCallback(
    (chunk: ChunkLike) => {
      const type = chunk.type ?? "";
      const toolName = chunk.toolName as ForwardKey | undefined;

      // Agent tool lifecycle.
      if (type === "tool-input-available" && toolName) {
        if (toolName === "awaitRiskVerdict") {
          updateForward(toolName, { status: "waiting" });
          setPhase("suspended");
          setVerdictPending(true);
          return;
        }
        updateForward(toolName, { status: "running" });
        return;
      }
      if (type === "tool-output-available" && toolName) {
        const out = chunk.output as Record<string, unknown> | undefined;
        let detail = "";
        if (toolName === "classifyFraudSignals" && out) {
          detail = `risk=${String(out.riskScore ?? "")} · 3 signals`;
        } else if (toolName === "voidCompVoucher" && out) {
          detail = `void=${String(out.voidId ?? "")}`;
          setCompStack((s) => [...s, "remintCompVoucher"]);
        } else if (toolName === "reverseRefund" && out) {
          detail = `clawback=${String(out.clawbackId ?? "")} · $${String(out.amountUsd ?? "")}`;
          setCompStack((s) => [...s, "reissueRefund"]);
        } else if (toolName === "retractApologyEmail" && out) {
          detail = `${String(out.to ?? "")}`;
          setCompStack((s) => [...s, "resendApologyEmail"]);
        } else if (toolName === "flagAccountForFraud" && out) {
          detail = `flag=${String(out.flagId ?? "")}`;
          setCompStack((s) => [...s, "clearFraudFlag"]);
        } else if (toolName === "postRiskNote" && out) {
          detail = `note=${String(out.noteId ?? "")}`;
          setCompStack((s) => [...s, "scrubRiskNote"]);
        } else if (toolName === "awaitRiskVerdict" && out) {
          setVerdictPending(false);
          const verdict = String(out.verdict ?? "");
          detail = `verdict=${verdict}`;
          if (verdict === "false-positive") {
            setPhase("unwinding");
          } else {
            setPhase("locked");
          }
          updateForward(toolName, { status: "done", detail });
          return;
        }
        updateForward(toolName, { status: "done", detail });
        return;
      }

      // Text reply from the agent (after the hook resolves).
      if (type === "text-delta" && typeof chunk.delta === "string") {
        summaryRef.current += chunk.delta;
        setSummary(summaryRef.current);
        return;
      }

      // Custom rollback events from the workflow's compensation path.
      if (type === "data-rollback" && chunk.data) {
        const data = chunk.data;
        if (data.type === "compensating" && data.action) {
          const action = data.action;
          setComps((prev) => ({
            ...prev,
            [action]: { ...prev[action], status: "running" },
          }));
          // Flip the forward step this comp undoes into "undone".
          setForward((prev) =>
            prev.map((f) => (f.inverse === action ? { ...f, status: "undone" } : f)),
          );
          return;
        }
        if (data.type === "compensated" && data.action) {
          const action = data.action;
          setComps((prev) => ({
            ...prev,
            [action]: {
              ...prev[action],
              status: "done",
              detail: "applied",
            },
          }));
          setCompStack((s) => s.filter((a) => a !== action));
          return;
        }
        if (data.type === "terminal") {
          if (data.outcome === "false-positive") {
            setPhase("restored");
          } else if (data.outcome === "fraud-confirmed") {
            setPhase("locked");
          }
          return;
        }
      }
    },
    [updateForward],
  );

  const respond = useCallback(
    async (verdict: "fraud-confirmed" | "false-positive") => {
      if (!verdictPending) return;
      setVerdictPending(false);
      if (verdict === "false-positive") setPhase("unwinding");
      else setPhase("locked");
      try {
        await fetch("/api/experiments/support-rollback/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: HOOK_TOKEN,
            verdict,
            reason:
              verdict === "false-positive"
                ? "Risk team cleared Elena — false positive"
                : "Risk team confirmed fraud",
          }),
        });
      } catch (err) {
        console.error("[support-rollback] trigger error", err);
      }
    },
    [verdictPending],
  );

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "idle":
        return "READY";
      case "reversing":
        return "REVERSING REMEDY";
      case "suspended":
        return "AWAITING RISK VERDICT";
      case "unwinding":
        return "ROLLING BACK · REVERSE UNWIND";
      case "restored":
        return "RESTORED · ELENA MADE WHOLE";
      case "locked":
        return "FRAUD CONFIRMED · ACCOUNT LOCKED";
    }
  }, [phase]);

  const phaseStyles =
    phase === "unwinding"
      ? "text-fuchsia-300 border-fuchsia-400/60 bg-fuchsia-500/10"
      : phase === "restored"
        ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
        : phase === "suspended"
          ? "text-amber-300 border-amber-400/50 bg-amber-500/10"
          : phase === "reversing"
            ? "text-fuchsia-300 border-fuchsia-400/40 bg-fuchsia-500/5"
            : phase === "locked"
              ? "text-red-300 border-red-400/40 bg-red-500/10"
              : "text-zinc-400 border-white/10 bg-white/5";

  const phaseDot =
    phase === "unwinding"
      ? "animate-pulse bg-fuchsia-400"
      : phase === "restored"
        ? "bg-emerald-400"
        : phase === "suspended"
          ? "animate-pulse bg-amber-400"
          : phase === "reversing"
            ? "animate-pulse bg-fuchsia-400"
            : phase === "locked"
              ? "bg-red-400"
              : "bg-zinc-600";

  return (
    <div className="h-full overflow-y-auto bg-black px-12 py-10 text-zinc-100">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-10">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
            Customer success · Rollback
          </p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight">
            Fraud flare. Reverse the reversal.
          </h1>
          <p className="mt-4 max-w-4xl text-lg text-zinc-400">
            Twelve minutes after Chapter 2&rsquo;s supervisor-approved{" "}
            <span className="font-mono text-fuchsia-300">$68.75</span> remedy,
            the fraud pipeline lights up on{" "}
            <span className="font-mono text-zinc-300">cus_elena_3310</span>.
            The agent reverses the remedy step by step, pushing each inverse
            onto a saga stack. The Risk team answers the hook, and the stack
            pops in <em>reverse</em> — Elena ends the chapter whole.
          </p>
        </header>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={run}
            disabled={phase !== "idle" && phase !== "restored" && phase !== "locked"}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "idle" || phase === "restored" || phase === "locked"
              ? "Run support agent"
              : "Running…"}
          </button>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${phaseStyles}`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${phaseDot}`} />
            {phaseLabel}
          </span>
          {runId ? (
            <span className="font-mono text-xs text-zinc-500">
              runId: {runId}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_460px]">
          <section className="flex flex-col gap-6">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Defensive forward path
              </p>
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {forward.map((tool) => (
                  <ForwardCard key={tool.key} tool={tool} />
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Agent reply
              </p>
              <p className="mt-4 min-h-[4rem] text-2xl leading-snug text-zinc-100">
                {summary || (
                  <span className="text-zinc-600">
                    Waiting for the agent to wrap up…
                  </span>
                )}
              </p>
            </div>
          </section>

          <SagaPanel
            phase={phase}
            verdictPending={verdictPending}
            stack={compStack}
            comps={comps}
            onRespond={respond}
          />
        </div>
      </div>
    </div>
  );
}

function ForwardCard({ tool }: { tool: ForwardState }) {
  const styles: Record<ForwardStatus, string> = {
    idle: "border-white/10 bg-zinc-950",
    running: "border-fuchsia-400/40 bg-fuchsia-500/5",
    waiting: "border-amber-400/60 bg-amber-500/10",
    done: "border-fuchsia-400/40 bg-fuchsia-500/10",
    undone:
      "border-emerald-400/30 bg-emerald-500/5 opacity-60",
  };
  const chip: Record<ForwardStatus, string> = {
    idle: "border-white/10 bg-white/5 text-zinc-500",
    running: "border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-200",
    waiting:
      "border-amber-400/60 bg-amber-500/20 text-amber-200 animate-pulse",
    done: "border-fuchsia-400/40 bg-fuchsia-500/20 text-fuchsia-200",
    undone: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
  };
  const label: Record<ForwardStatus, string> = {
    idle: "IDLE",
    running: "REVERSING",
    waiting: "WAITING",
    done: "REVERSED",
    undone: "UNDONE",
  };

  return (
    <div
      className={`flex min-h-[150px] flex-col justify-between rounded-2xl border p-5 transition-colors duration-300 ${styles[tool.status]}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Tool
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] ${chip[tool.status]}`}
          >
            {label[tool.status]}
          </span>
        </div>
        <h3 className="mt-3 text-lg font-semibold text-zinc-100">
          {tool.label}
        </h3>
        <p className="mt-1 font-mono text-[11px] text-zinc-500">{tool.sub}</p>
      </div>
      <p className="mt-3 min-h-[1.5rem] font-mono text-[11px] leading-relaxed text-zinc-400">
        {tool.detail ?? " "}
      </p>
    </div>
  );
}

function SagaPanel({
  phase,
  verdictPending,
  stack,
  comps,
  onRespond,
}: {
  phase: Phase;
  verdictPending: boolean;
  stack: CompKey[];
  comps: Record<CompKey, CompState>;
  onRespond: (v: "fraud-confirmed" | "false-positive") => void;
}) {
  const armed = phase === "suspended" && verdictPending;
  const unwinding = phase === "unwinding";

  const borderClass = armed
    ? "border-amber-400/60 shadow-[0_0_60px_-20px_rgba(251,191,36,0.6)]"
    : unwinding
      ? "border-fuchsia-400/60 shadow-[0_0_80px_-20px_rgba(232,121,249,0.6)]"
      : phase === "restored"
        ? "border-emerald-400/40"
        : "border-white/10";

  // Stack is shown top-to-bottom with the top of the stack (next to pop)
  // at the TOP so the audience sees things "fall" off.
  const stackTopFirst = [...stack].reverse();

  const order: CompKey[] = [
    "scrubRiskNote",
    "clearFraudFlag",
    "resendApologyEmail",
    "reissueRefund",
    "remintCompVoucher",
  ];

  return (
    <aside
      className={`flex min-h-[720px] flex-col rounded-[36px] border-2 bg-zinc-950 p-8 transition-colors ${borderClass}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
          Saga compensation stack
        </p>
        <span
          className={`h-3 w-3 rounded-full transition-colors ${
            unwinding
              ? "animate-pulse bg-fuchsia-400"
              : armed
                ? "animate-pulse bg-amber-400"
                : phase === "restored"
                  ? "bg-emerald-400"
                  : "bg-zinc-700"
          }`}
        />
      </div>

      <h2 className="mt-4 text-3xl font-semibold tracking-tight">
        {unwinding
          ? "Popping in reverse…"
          : phase === "restored"
            ? "Elena restored"
            : armed
              ? "Risk team, your call"
              : "Stack building"}
      </h2>
      <p className="mt-2 font-mono text-xs text-zinc-500">
        ticket {TICKET_ID} · cus_elena_3310 · ord-8842
      </p>

      <div className="mt-6 space-y-2">
        {order.map((key) => {
          const c = comps[key];
          const onStack = stack.includes(key);
          const isTop = stackTopFirst[0] === key && onStack;
          const statusStyles =
            c.status === "running"
              ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-100"
              : c.status === "done"
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                : onStack
                  ? isTop
                    ? "border-fuchsia-400/60 bg-fuchsia-500/10 text-fuchsia-200"
                    : "border-fuchsia-400/30 bg-fuchsia-500/5 text-fuchsia-300"
                  : "border-white/5 bg-zinc-950 text-zinc-600";

          const badge =
            c.status === "running"
              ? "RUNNING"
              : c.status === "done"
                ? "DONE"
                : onStack
                  ? isTop
                    ? "NEXT"
                    : "PENDING"
                  : "—";

          return (
            <div
              key={key}
              className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors duration-300 ${statusStyles}`}
            >
              <div>
                <p className="text-base font-semibold">{c.label}</p>
                <p className="font-mono text-[11px] opacity-70">{c.sub}</p>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] ${
                  c.status === "running"
                    ? "border-fuchsia-400/60 bg-fuchsia-500/30 text-fuchsia-100 animate-pulse"
                    : c.status === "done"
                      ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-200"
                      : isTop
                        ? "border-fuchsia-400/60 bg-fuchsia-500/20 text-fuchsia-200"
                        : "border-white/10 bg-white/5 text-zinc-500"
                }`}
              >
                {badge}
              </span>
            </div>
          );
        })}
      </div>

      <div className="mt-6 min-h-[100px]">
        {armed ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onRespond("false-positive")}
              className="flex-1 rounded-xl bg-fuchsia-500 px-4 py-4 text-base font-semibold text-black transition hover:bg-fuchsia-400"
            >
              Clear Elena · rollback
            </button>
            <button
              type="button"
              onClick={() => onRespond("fraud-confirmed")}
              className="flex-1 rounded-xl border-2 border-red-500/60 px-4 py-4 text-base font-semibold text-red-300 transition hover:bg-red-500/10"
            >
              Confirm fraud · lock
            </button>
          </div>
        ) : phase === "restored" ? (
          <div className="rounded-xl border border-emerald-400/40 bg-emerald-500/10 px-5 py-4 text-center font-mono text-xs font-semibold uppercase tracking-[0.2em] text-emerald-200">
            Refund re-issued · voucher re-minted · apology sent
          </div>
        ) : phase === "locked" ? (
          <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-4 text-center font-mono text-xs font-semibold uppercase tracking-[0.2em] text-red-300">
            Account locked · reversal stands
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-center font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">
            {phase === "reversing"
              ? "Agent reversing remedy…"
              : phase === "unwinding"
                ? "Saga unwinding…"
                : "Waiting for escalation"}
          </div>
        )}
      </div>

      <div className="mt-auto pt-6">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-zinc-600">
          Durable hook
        </p>
        <p className="mt-1 font-mono text-xs text-zinc-500 break-all">
          {HOOK_TOKEN}
        </p>
      </div>
    </aside>
  );
}
