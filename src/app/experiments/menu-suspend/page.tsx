"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// menu-suspend demo page — chapter 2 of menu-retry.
//
// Five tool-call slots laid out as a pipeline. The third slot
// (requestRegionalApproval) visibly pauses on WAITING when the hook is
// created — the whole row glows amber, a phone-style approval card appears,
// and the downstream publish/shelve slot only fills after the operator
// resumes the hook. Amber-400 is the verb accent.
// ---------------------------------------------------------------------------

type SlotState = "idle" | "calling" | "waiting" | "ok" | "skipped";

type ToolKey =
  | "loadProposedTweak"
  | "computeMarginImpact"
  | "requestRegionalApproval"
  | "publishToLiveMenu"
  | "shelveProposal";

type SlotView = {
  key: ToolKey;
  label: string;
  sub: string;
  state: SlotState;
  detail: string;
};

const INITIAL_SLOTS: Record<ToolKey, SlotView> = {
  loadProposedTweak: {
    key: "loadProposedTweak",
    label: "Load proposed tweak",
    sub: "sku=burger-classic",
    state: "idle",
    detail: "",
  },
  computeMarginImpact: {
    key: "computeMarginImpact",
    label: "Compute margin impact",
    sub: "margin-guardrail-v2",
    state: "idle",
    detail: "",
  },
  requestRegionalApproval: {
    key: "requestRegionalApproval",
    label: "Regional manager approval",
    sub: "hook · menu-suspend:burger-classic",
    state: "idle",
    detail: "",
  },
  publishToLiveMenu: {
    key: "publishToLiveMenu",
    label: "Publish to live menu",
    sub: "only if approved",
    state: "idle",
    detail: "",
  },
  shelveProposal: {
    key: "shelveProposal",
    label: "Shelve proposal",
    sub: "only if rejected",
    state: "idle",
    detail: "",
  },
};

const SLOT_ORDER: ToolKey[] = [
  "loadProposedTweak",
  "computeMarginImpact",
  "requestRegionalApproval",
  "publishToLiveMenu",
  "shelveProposal",
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
    name === "loadProposedTweak" ||
    name === "computeMarginImpact" ||
    name === "requestRegionalApproval" ||
    name === "publishToLiveMenu" ||
    name === "shelveProposal"
  );
}

type ApprovalContext = {
  proposedPrice: number | null;
  currentPrice: number | null;
  deltaPct: number | null;
  projectedWeeklyLift: number | null;
  token: string;
};

function summarizeOutput(key: ToolKey, output: unknown): string {
  if (!output || typeof output !== "object") return "";
  const o = output as Record<string, unknown>;
  if (key === "loadProposedTweak") {
    const cur = typeof o.currentPrice === "number" ? o.currentPrice : null;
    const prop = typeof o.proposedPrice === "number" ? o.proposedPrice : null;
    return cur != null && prop != null
      ? `$${cur.toFixed(2)} → $${prop.toFixed(2)}`
      : "";
  }
  if (key === "computeMarginImpact") {
    const d = typeof o.deltaPct === "number" ? o.deltaPct : null;
    const g = typeof o.guardrailPct === "number" ? o.guardrailPct : null;
    return d != null && g != null
      ? `Δ ${d > 0 ? "+" : ""}${d.toFixed(2)}% · guardrail ±${g}%`
      : "";
  }
  if (key === "requestRegionalApproval") {
    const approved = typeof o.approved === "boolean" ? o.approved : null;
    if (approved === true) return "approved";
    if (approved === false) return "rejected";
    return "";
  }
  if (key === "publishToLiveMenu") {
    const lp = typeof o.livePrice === "number" ? o.livePrice : null;
    return lp != null ? `live · $${lp.toFixed(2)}` : "";
  }
  if (key === "shelveProposal") {
    return "shelved";
  }
  return "";
}

export default function MenuSuspendExperimentPage() {
  const [slots, setSlots] =
    useState<Record<ToolKey, SlotView>>(INITIAL_SLOTS);
  const [status, setStatus] = useState<
    "idle" | "running" | "waiting" | "resuming" | "done" | "error"
  >("idle");
  const [summary, setSummary] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);
  const [approval, setApproval] = useState<ApprovalContext | null>(null);
  const [decisionLocked, setDecisionLocked] = useState(false);
  const runningRef = useRef(false);

  const reset = useCallback(() => {
    setSlots(INITIAL_SLOTS);
    setSummary("");
    setRunId(null);
    setApproval(null);
    setDecisionLocked(false);
    setStatus("idle");
  }, []);

  const handleRun = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    reset();
    setStatus("running");

    // Mutable context tracked across chunks so the approval card can render
    // before the hook resolves.
    const ctx: ApprovalContext = {
      proposedPrice: null,
      currentPrice: null,
      deltaPct: null,
      projectedWeeklyLift: null,
      token: "menu-suspend:burger-classic",
    };

    try {
      const res = await fetch("/api/experiments/menu-suspend/start", {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        setStatus("error");
        runningRef.current = false;
        return;
      }
      const xRunId = res.headers.get("x-workflow-run-id");
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
            setApproval,
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

  const handleDecision = useCallback(
    async (approved: boolean) => {
      if (!approval || decisionLocked) return;
      setDecisionLocked(true);
      setStatus("resuming");
      try {
        await fetch("/api/experiments/menu-suspend/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: approval.token,
            approved,
            reason: approved
              ? "Within regional pricing guidance — ship it."
              : "Holding at current price — revisit after weekend.",
          }),
        });
      } catch {
        setDecisionLocked(false);
        setStatus("waiting");
      }
    },
    [approval, decisionLocked],
  );

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-10 py-10">
      <div className="flex w-full max-w-6xl flex-col gap-8">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-400">
              Menu curator · Suspend
            </p>
            <h1 className="mt-2 text-5xl font-semibold tracking-tight">
              Price tweak pauses for a human. Run survives the wait.
            </h1>
            <p className="mt-3 max-w-3xl text-lg text-zinc-400">
              Chapter 2 of the menu-retry demo. The queued Classic Burger tweak
              crosses the +5% regional guardrail, so the agent suspends on a
              hook. The durable run waits — memory, message history, tool
              results — until the regional manager answers.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={status} />
            <button
              onClick={handleRun}
              disabled={status === "running" || status === "waiting" || status === "resuming"}
              className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "running"
                ? "Running…"
                : status === "waiting"
                  ? "Suspended"
                  : status === "resuming"
                    ? "Resuming…"
                    : "Run agent"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-5 gap-4">
          {SLOT_ORDER.map((key) => (
            <ToolSlotCard key={key} slot={slots[key]} />
          ))}
        </div>

        <ApprovalCard
          approval={approval}
          status={status}
          decisionLocked={decisionLocked}
          onDecision={handleDecision}
        />

        <SummaryCard summary={summary} runId={runId} />
      </div>
    </div>
  );
}

function handleChunk(
  chunk: ChunkLike,
  perCall: Map<string, { key: ToolKey }>,
  ctx: ApprovalContext,
  setSlots: React.Dispatch<React.SetStateAction<Record<ToolKey, SlotView>>>,
  setSummary: React.Dispatch<React.SetStateAction<string>>,
  setApproval: React.Dispatch<React.SetStateAction<ApprovalContext | null>>,
  setStatus: React.Dispatch<
    React.SetStateAction<
      "idle" | "running" | "waiting" | "resuming" | "done" | "error"
    >
  >,
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
      const isApprovalStep = entry.key === "requestRegionalApproval";

      // Capture margin-impact inputs/outputs to hydrate the approval card.
      if (
        entry.key === "requestRegionalApproval" &&
        t === "tool-input-available" &&
        chunk.input &&
        typeof chunk.input === "object"
      ) {
        const i = chunk.input as Record<string, unknown>;
        if (typeof i.proposedPrice === "number")
          ctx.proposedPrice = i.proposedPrice;
        if (typeof i.deltaPct === "number") ctx.deltaPct = i.deltaPct;
        if (typeof i.projectedWeeklyLift === "number")
          ctx.projectedWeeklyLift = i.projectedWeeklyLift;
      }

      setSlots((prev) => ({
        ...prev,
        [entry.key]: {
          ...prev[entry.key],
          state: isApprovalStep ? "waiting" : "calling",
        },
      }));

      if (isApprovalStep && t === "tool-input-available") {
        setApproval({ ...ctx });
        setStatus("waiting");
      }
    }
    return;
  }

  if (t === "tool-output-available") {
    if (id && perCall.has(id)) {
      const entry = perCall.get(id)!;
      const detail = summarizeOutput(entry.key, chunk.output);

      // Capture loadProposedTweak output so approval card shows current price.
      if (
        entry.key === "loadProposedTweak" &&
        chunk.output &&
        typeof chunk.output === "object"
      ) {
        const o = chunk.output as Record<string, unknown>;
        if (typeof o.currentPrice === "number")
          ctx.currentPrice = o.currentPrice;
        if (typeof o.proposedPrice === "number")
          ctx.proposedPrice = o.proposedPrice;
      }

      // requestRegionalApproval returning means the hook resumed.
      if (entry.key === "requestRegionalApproval") {
        setStatus("running");
      }

      setSlots((prev) => {
        const next = { ...prev };
        next[entry.key] = {
          ...prev[entry.key],
          state: "ok",
          detail,
        };
        // After the approval resolves, dim the branch we did NOT take.
        if (entry.key === "publishToLiveMenu") {
          next.shelveProposal = {
            ...prev.shelveProposal,
            state: prev.shelveProposal.state === "idle" ? "skipped" : prev.shelveProposal.state,
          };
        }
        if (entry.key === "shelveProposal") {
          next.publishToLiveMenu = {
            ...prev.publishToLiveMenu,
            state: prev.publishToLiveMenu.state === "idle" ? "skipped" : prev.publishToLiveMenu.state,
          };
        }
        return next;
      });
    }
    return;
  }

  if (t === "text-delta" && typeof chunk.delta === "string") {
    setSummary((prev) => prev + chunk.delta);
  }
}

function StatusPill({
  status,
}: {
  status: "idle" | "running" | "waiting" | "resuming" | "done" | "error";
}) {
  const cfg =
    status === "running"
      ? {
          label: "STREAMING",
          cls: "border-sky-400/40 bg-sky-500/10 text-sky-300 animate-pulse",
        }
      : status === "waiting"
        ? {
            label: "SUSPENDED",
            cls: "border-amber-400/50 bg-amber-500/10 text-amber-300 animate-pulse",
          }
        : status === "resuming"
          ? {
              label: "RESUMING",
              cls: "border-sky-400/40 bg-sky-500/10 text-sky-300 animate-pulse",
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

function ToolSlotCard({ slot }: { slot: SlotView }) {
  const cfg = STATE_STYLE[slot.state];
  const dim = slot.state === "skipped";
  return (
    <div
      className={`relative flex min-h-[220px] flex-col overflow-hidden rounded-2xl border bg-zinc-950 p-5 transition-colors ${cfg.border} ${dim ? "opacity-25" : "opacity-100"}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Tool call
        </span>
        <span
          className={`rounded-full border px-2.5 py-1 font-mono text-[10px] font-semibold tracking-[0.18em] ${cfg.pill} ${slot.state === "waiting" ? "animate-pulse" : ""}`}
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
  waiting: {
    label: "WAITING",
    pill: "border-amber-400/50 bg-amber-500/15 text-amber-200",
    border: "border-amber-400/60",
  },
  ok: {
    label: "OK",
    pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    border: "border-emerald-400/30",
  },
  skipped: {
    label: "SKIPPED",
    pill: "border-white/10 bg-white/5 text-zinc-500",
    border: "border-white/10",
  },
};

function ApprovalCard({
  approval,
  status,
  decisionLocked,
  onDecision,
}: {
  approval: ApprovalContext | null;
  status: "idle" | "running" | "waiting" | "resuming" | "done" | "error";
  decisionLocked: boolean;
  onDecision: (approved: boolean) => void;
}) {
  const visible = status === "waiting" || status === "resuming";
  const proposed = approval?.proposedPrice;
  const current = approval?.currentPrice;
  const delta = approval?.deltaPct;
  const lift = approval?.projectedWeeklyLift;
  return (
    <div
      className={`min-h-[180px] rounded-2xl border bg-zinc-950 p-6 transition-all ${visible ? "border-amber-400/60 opacity-100" : "border-white/10 opacity-40"}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${visible ? "bg-amber-400 animate-pulse" : "bg-white/10"}`}
          />
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
            Regional manager approval
          </span>
        </div>
        <span className="font-mono text-xs text-zinc-500">
          token {approval?.token ?? "—"}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_auto] items-end gap-6">
        <div className="flex flex-col gap-2">
          <div className="font-mono text-2xl text-white">
            {current != null && proposed != null
              ? `Classic Burger · $${current.toFixed(2)} → $${proposed.toFixed(2)}`
              : "Classic Burger · price change pending"}
          </div>
          <div className="font-mono text-base text-zinc-400">
            {delta != null ? `Δ ${delta > 0 ? "+" : ""}${delta.toFixed(2)}%` : "Δ —"}
            {" · "}
            guardrail ±5%
            {lift != null
              ? ` · projected weekly lift $${lift.toFixed(2)}`
              : ""}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => onDecision(false)}
            disabled={!visible || decisionLocked || status === "resuming"}
            className="rounded-xl border border-red-500/40 bg-red-500/5 px-5 py-3 text-base font-semibold text-red-300 transition hover:bg-red-500/15 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reject
          </button>
          <button
            onClick={() => onDecision(true)}
            disabled={!visible || decisionLocked || status === "resuming"}
            className="rounded-xl bg-amber-400 px-5 py-3 text-base font-semibold text-black transition hover:bg-amber-300 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve
          </button>
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
            Agent response streams here after the run resolves.
          </span>
        )}
      </div>
    </div>
  );
}
