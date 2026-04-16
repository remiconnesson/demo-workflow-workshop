"use client";

import { useCallback, useMemo, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Support · Suspend  —  Chapter 2 of Elena Ruiz's complaint story.
//
// The agent re-opens tkt-4417, drafts a $68.75 remedy, hits the $50 policy
// cap, and SUSPENDS on a durable hook. A supervisor approves (or rejects)
// from the phone-style panel on the right. The agent resumes, applies the
// resolution, and emails Elena.
// ---------------------------------------------------------------------------

const TICKET_ID = "tkt-4417";
const HOOK_TOKEN = `support-suspend:${TICKET_ID}`;

type ToolKey =
  | "reopenTicket"
  | "draftResolution"
  | "requestSupervisorApproval"
  | "applyResolution"
  | "sendResolutionEmail";

type ToolStatus = "idle" | "running" | "waiting" | "done" | "skipped";

type ToolState = {
  key: ToolKey;
  label: string;
  sub: string;
  status: ToolStatus;
  detail?: string;
};

const INITIAL_TOOLS: ToolState[] = [
  {
    key: "reopenTicket",
    label: "Reopen ticket",
    sub: "Escalation · tkt-4417",
    status: "idle",
  },
  {
    key: "draftResolution",
    label: "Draft resolution",
    sub: "Refund + comp meal",
    status: "idle",
  },
  {
    key: "requestSupervisorApproval",
    label: "Supervisor approval",
    sub: "Durable hook · over cap",
    status: "idle",
  },
  {
    key: "applyResolution",
    label: "Apply resolution",
    sub: "Stripe + Rewards",
    status: "idle",
  },
  {
    key: "sendResolutionEmail",
    label: "Email Elena",
    sub: "Resend · transactional",
    status: "idle",
  },
];

type ChunkLike = {
  type?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  delta?: string;
};

type SuspendPhase = "idle" | "running" | "suspended" | "resuming" | "done";

export default function SupportSuspendPage() {
  const [tools, setTools] = useState<ToolState[]>(INITIAL_TOOLS);
  const [phase, setPhase] = useState<SuspendPhase>("idle");
  const [summary, setSummary] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);
  const [approvalPending, setApprovalPending] = useState(false);
  const [approvalResult, setApprovalResult] = useState<{
    approved: boolean;
    at: number;
  } | null>(null);
  const [resolutionDraft, setResolutionDraft] = useState<{
    totalUsd: number;
    overCapBy: number;
    refundUsd: number;
    compMealUsd: number;
    policyCapUsd: number;
  } | null>(null);
  const summaryRef = useRef("");

  const updateTool = useCallback(
    (key: ToolKey, patch: Partial<ToolState>) => {
      setTools((prev) =>
        prev.map((t) => (t.key === key ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const run = useCallback(async () => {
    setTools(INITIAL_TOOLS);
    setSummary("");
    summaryRef.current = "";
    setApprovalResult(null);
    setResolutionDraft(null);
    setPhase("running");

    try {
      const res = await fetch("/api/experiments/support-suspend/start", {
        method: "POST",
      });
      setRunId(res.headers.get("X-Run-Id"));
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
      setPhase("done");
    } catch (err) {
      console.error("[support-suspend] stream error", err);
      setPhase("idle");
    }
  }, []);

  const handleChunk = useCallback((chunk: ChunkLike) => {
    const type = chunk.type ?? "";
    const toolName = chunk.toolName as ToolKey | undefined;

    if (type === "tool-input-available" && toolName) {
      if (toolName === "requestSupervisorApproval") {
        setPhase("suspended");
        setApprovalPending(true);
      }
      updateTool(toolName, {
        status: toolName === "requestSupervisorApproval" ? "waiting" : "running",
      });
      return;
    }

    if (type === "tool-output-available" && toolName) {
      const out = chunk.output as Record<string, unknown> | undefined;
      let detail = "";
      if (toolName === "reopenTicket" && out) {
        detail = `status=${String(out.status ?? "")} · risk=${String(out.riskScore ?? "")}`;
      } else if (toolName === "draftResolution" && out) {
        const total = Number(out.totalUsd ?? 0);
        const over = Number(out.overCapBy ?? 0);
        const refund = Number(out.refundUsd ?? 0);
        const comp = Number(out.compMealUsd ?? 0);
        const cap = Number(out.policyCapUsd ?? 50);
        setResolutionDraft({
          totalUsd: total,
          overCapBy: over,
          refundUsd: refund,
          compMealUsd: comp,
          policyCapUsd: cap,
        });
        detail = `$${total.toFixed(2)} · over cap by $${over.toFixed(2)}`;
      } else if (toolName === "requestSupervisorApproval" && out) {
        const approved = Boolean(out.approved);
        setApprovalPending(false);
        setApprovalResult({ approved, at: Date.now() });
        setPhase(approved ? "resuming" : "done");
        detail = approved ? "APPROVED by supervisor" : "REJECTED by supervisor";
      } else if (toolName === "applyResolution" && out) {
        detail = `refund=${String(out.refundId ?? "")} · voucher=${String(out.voucherCode ?? "")}`;
      } else if (toolName === "sendResolutionEmail" && out) {
        detail = `${String(out.to ?? "")}`;
      }
      updateTool(toolName, { status: "done", detail });
      return;
    }

    if (type === "text-delta" && typeof chunk.delta === "string") {
      summaryRef.current += chunk.delta;
      setSummary(summaryRef.current);
      return;
    }
  }, [updateTool]);

  const respond = useCallback(
    async (approved: boolean) => {
      if (!approvalPending) return;
      setApprovalPending(false);
      setPhase("resuming");
      try {
        await fetch("/api/experiments/support-suspend/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: HOOK_TOKEN,
            approved,
            reason: approved
              ? "Supervisor approved over-cap remedy"
              : "Over-cap remedy declined",
          }),
        });
      } catch (err) {
        console.error("[support-suspend] approve error", err);
      }
    },
    [approvalPending],
  );

  const phaseLabel = useMemo(() => {
    switch (phase) {
      case "idle":
        return "READY";
      case "running":
        return "AGENT WORKING";
      case "suspended":
        return "SUSPENDED · AWAITING SUPERVISOR";
      case "resuming":
        return "RESUMING";
      case "done":
        return "DONE";
    }
  }, [phase]);

  const phaseColor =
    phase === "suspended"
      ? "text-amber-300 border-amber-400/50 bg-amber-500/10"
      : phase === "resuming"
        ? "text-sky-300 border-sky-400/40 bg-sky-500/10"
        : phase === "done"
          ? "text-emerald-300 border-emerald-400/40 bg-emerald-500/10"
          : phase === "running"
            ? "text-sky-300 border-sky-400/40 bg-sky-500/10"
            : "text-zinc-400 border-white/10 bg-white/5";

  return (
    <div className="h-full overflow-y-auto bg-black px-12 py-10 text-zinc-100">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-10">
        <header>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
            Customer success · Suspend
          </p>
          <h1 className="mt-2 text-5xl font-semibold tracking-tight">
            Elena escalates. The agent pauses for a human.
          </h1>
          <p className="mt-4 max-w-3xl text-lg text-zinc-400">
            Ticket <span className="font-mono text-zinc-300">tkt-4417</span>{" "}
            re-opens. Elena wants a full refund{" "}
            <em>and</em> a comp meal — a{" "}
            <span className="font-mono text-amber-300">$68.75</span> remedy
            that blows past the agent&rsquo;s{" "}
            <span className="font-mono text-amber-300">$50</span> policy cap.
            The agent suspends on a durable hook. The process can die; when a
            supervisor answers, the agent resumes with its full message
            history intact.
          </p>
        </header>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={run}
            disabled={phase !== "idle" && phase !== "done"}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {phase === "idle" || phase === "done"
              ? "Run support agent"
              : "Running…"}
          </button>
          <span
            className={`inline-flex items-center gap-2 rounded-full border px-4 py-1.5 font-mono text-xs font-semibold uppercase tracking-[0.18em] transition-colors ${phaseColor}`}
          >
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                phase === "suspended"
                  ? "animate-pulse bg-amber-400"
                  : phase === "running" || phase === "resuming"
                    ? "animate-pulse bg-sky-400"
                    : phase === "done"
                      ? "bg-emerald-400"
                      : "bg-zinc-600"
              }`}
            />
            {phaseLabel}
          </span>
          {runId ? (
            <span className="font-mono text-xs text-zinc-500">
              runId: {runId}
            </span>
          ) : null}
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_420px]">
          <section className="flex flex-col gap-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
              {tools.map((tool) => (
                <ToolCard key={tool.key} tool={tool} />
              ))}
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

          <SupervisorPanel
            phase={phase}
            approvalPending={approvalPending}
            approvalResult={approvalResult}
            draft={resolutionDraft}
            onRespond={respond}
          />
        </div>
      </div>
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolState }) {
  const styles: Record<ToolStatus, string> = {
    idle: "border-white/10 bg-zinc-950",
    running: "border-sky-400/40 bg-sky-500/5",
    waiting: "border-amber-400/60 bg-amber-500/10",
    done: "border-emerald-400/40 bg-emerald-500/5",
    skipped: "border-white/5 bg-zinc-950 opacity-40",
  };
  const chip: Record<ToolStatus, string> = {
    idle: "border-white/10 bg-white/5 text-zinc-500",
    running: "border-sky-400/40 bg-sky-500/10 text-sky-200",
    waiting:
      "border-amber-400/60 bg-amber-500/20 text-amber-200 animate-pulse",
    done: "border-emerald-400/40 bg-emerald-500/10 text-emerald-200",
    skipped: "border-white/10 bg-white/5 text-zinc-600",
  };
  const label: Record<ToolStatus, string> = {
    idle: "IDLE",
    running: "RUNNING",
    waiting: "WAITING",
    done: "DONE",
    skipped: "SKIPPED",
  };

  return (
    <div
      className={`flex min-h-[220px] flex-col justify-between rounded-2xl border p-6 transition-colors duration-300 ${styles[tool.status]}`}
    >
      <div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Tool
          </span>
          <span
            className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${chip[tool.status]}`}
          >
            {label[tool.status]}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-semibold text-zinc-100">
          {tool.label}
        </h3>
        <p className="mt-1 font-mono text-xs text-zinc-500">{tool.sub}</p>
      </div>

      <p className="mt-6 min-h-[2.5rem] font-mono text-xs leading-relaxed text-zinc-400">
        {tool.detail ?? " "}
      </p>
    </div>
  );
}

function SupervisorPanel({
  phase,
  approvalPending,
  approvalResult,
  draft,
  onRespond,
}: {
  phase: SuspendPhase;
  approvalPending: boolean;
  approvalResult: { approved: boolean; at: number } | null;
  draft: {
    totalUsd: number;
    overCapBy: number;
    refundUsd: number;
    compMealUsd: number;
    policyCapUsd: number;
  } | null;
  onRespond: (approved: boolean) => void;
}) {
  const armed = phase === "suspended" && approvalPending;
  const borderClass = armed
    ? "border-amber-400/60 shadow-[0_0_60px_-20px_rgba(251,191,36,0.6)]"
    : "border-white/10";

  return (
    <aside
      className={`flex min-h-[640px] flex-col rounded-[36px] border-2 bg-zinc-950 p-8 transition-colors ${borderClass}`}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
          Supervisor phone
        </p>
        <span
          className={`h-3 w-3 rounded-full transition-colors ${
            armed ? "animate-pulse bg-amber-400" : "bg-zinc-700"
          }`}
        />
      </div>

      <h2 className="mt-4 text-3xl font-semibold tracking-tight">
        Over-cap approval
      </h2>
      <p className="mt-2 text-sm text-zinc-500 font-mono">
        ticket {TICKET_ID} · cus_elena_3310 · ord-8842
      </p>

      <div className="mt-6 rounded-2xl border border-white/10 bg-black p-6">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Proposed remedy
        </p>
        <div className="mt-4 space-y-3 font-mono text-sm text-zinc-300">
          <Row
            k="Refund"
            v={draft ? `$${draft.refundUsd.toFixed(2)}` : "—"}
          />
          <Row
            k="Comp meal"
            v={draft ? `$${draft.compMealUsd.toFixed(2)}` : "—"}
          />
          <div className="my-2 h-px bg-white/10" />
          <Row
            k="Total"
            v={draft ? `$${draft.totalUsd.toFixed(2)}` : "—"}
            strong
          />
          <Row
            k="Policy cap"
            v={draft ? `$${draft.policyCapUsd.toFixed(2)}` : "$50.00"}
          />
          <Row
            k="Over by"
            v={draft ? `$${draft.overCapBy.toFixed(2)}` : "—"}
            accent={draft && draft.overCapBy > 0 ? "amber" : undefined}
          />
        </div>
      </div>

      <div className="mt-6 min-h-[100px]">
        {armed ? (
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => onRespond(true)}
              className="flex-1 rounded-xl bg-emerald-500 px-5 py-4 text-lg font-semibold text-black transition hover:bg-emerald-400"
            >
              Approve $68.75
            </button>
            <button
              type="button"
              onClick={() => onRespond(false)}
              className="flex-1 rounded-xl border-2 border-red-500/60 px-5 py-4 text-lg font-semibold text-red-300 transition hover:bg-red-500/10"
            >
              Reject
            </button>
          </div>
        ) : approvalResult ? (
          <div
            className={`rounded-xl border px-5 py-4 text-center font-mono text-sm font-semibold uppercase tracking-[0.2em] ${
              approvalResult.approved
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-200"
                : "border-red-500/40 bg-red-500/10 text-red-300"
            }`}
          >
            {approvalResult.approved
              ? "Approved · agent resumed"
              : "Rejected · agent resumed"}
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 bg-white/5 px-5 py-4 text-center font-mono text-sm uppercase tracking-[0.2em] text-zinc-500">
            {phase === "running"
              ? "Agent working…"
              : phase === "done"
                ? "Case closed"
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

function Row({
  k,
  v,
  strong,
  accent,
}: {
  k: string;
  v: string;
  strong?: boolean;
  accent?: "amber";
}) {
  const vClass = accent === "amber" ? "text-amber-300" : "text-zinc-100";
  return (
    <div className="flex items-center justify-between">
      <span className="text-zinc-500">{k}</span>
      <span
        className={`${vClass} ${strong ? "text-lg font-semibold" : ""}`}
      >
        {v}
      </span>
    </div>
  );
}
