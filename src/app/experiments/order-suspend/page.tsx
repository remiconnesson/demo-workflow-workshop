"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Chapter 2: SUSPEND.
//
// Same agent, same customer, same restaurant as order-retry. This time the
// follow-up order is flagged for manual review. The agent reaches
// requestOperatorReview and the workflow SUSPENDS — the page surfaces an
// amber "WAITING ON HUMAN" banner and an approve/reject card. When the
// operator clicks, we POST to /approve and the SAME agent loop resumes
// from the exact line it paused on.
// ---------------------------------------------------------------------------

type StepId =
  | "validateDeliveryAddress"
  | "screenForFraud"
  | "stageCharge"
  | "requestOperatorReview"
  | "notifyRestaurant";

type StepStatus =
  | "idle"
  | "running"
  | "waiting"
  | "resumed"
  | "succeeded"
  | "rejected"
  | "skipped";

type StepState = {
  id: StepId;
  label: string;
  sublabel: string;
  status: StepStatus;
  note: string;
};

const ORDER_ID = "ord-5627";
const SUSPEND_TOKEN = `order-suspend:${ORDER_ID}`;

const INITIAL_STEPS: StepState[] = [
  {
    id: "validateDeliveryAddress",
    label: "Validate delivery address",
    sublabel: "smarty-geocoder · third-party",
    status: "idle",
    note: "",
  },
  {
    id: "screenForFraud",
    label: "Screen for fraud",
    sublabel: "sift-shield · risk score",
    status: "idle",
    note: "",
  },
  {
    id: "stageCharge",
    label: "Authorize charge",
    sublabel: "payments · hold, not capture",
    status: "idle",
    note: "",
  },
  {
    id: "requestOperatorReview",
    label: "Operator review",
    sublabel: "workflow.hook · durable suspend",
    status: "idle",
    note: "",
  },
  {
    id: "notifyRestaurant",
    label: "Notify Burger Barn",
    sublabel: "kitchen ticket dispatch",
    status: "idle",
    note: "",
  },
];

type ToolChunk =
  | {
      type: "tool-input-start";
      toolName?: string;
      toolCallId?: string;
    }
  | {
      type: "tool-output-available";
      toolCallId?: string;
      output?: unknown;
    }
  | { type: "text-delta"; delta?: string }
  | { type: string; [k: string]: unknown };

type RunStatus = "idle" | "running" | "suspended" | "resuming" | "done" | "error";

type Decision = "approved" | "rejected" | null;

export default function OrderSuspendPage() {
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [finalMessage, setFinalMessage] = useState<string>("");
  const [decision, setDecision] = useState<Decision>(null);
  const assistantBufRef = useRef<string>("");

  const patchStep = useCallback((id: StepId, patch: Partial<StepState>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

  const handleRun = useCallback(async () => {
    if (runStatus === "running" || runStatus === "suspended") return;
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setFinalMessage("");
    setRunId(null);
    setDecision(null);
    assistantBufRef.current = "";
    setRunStatus("running");

    let res: Response;
    try {
      res = await fetch("/api/experiments/order-suspend/start", {
        method: "POST",
      });
    } catch {
      setRunStatus("error");
      return;
    }
    if (!res.ok || !res.body) {
      setRunStatus("error");
      return;
    }
    setRunId(res.headers.get("X-Run-Id"));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    const seenTools = new Set<string>();
    // Track the tool call id for the suspend tool so we can flip to "resumed"
    // when its output arrives (= hook resolved).
    let suspendCallId: string | null = null;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        let chunk: ToolChunk;
        try {
          chunk = JSON.parse(trimmed);
        } catch {
          continue;
        }

        if (chunk.type === "tool-input-start") {
          const name = String(chunk.toolName ?? "");
          const callId = String(chunk.toolCallId ?? "");
          const key = `${name}:${callId}`;
          if (seenTools.has(key)) continue;
          seenTools.add(key);

          if (name === "validateDeliveryAddress") {
            patchStep("validateDeliveryAddress", {
              status: "running",
              note: "POST /geocode · 600 Embarcadero",
            });
          } else if (name === "screenForFraud") {
            patchStep("screenForFraud", {
              status: "running",
              note: "risk-score in flight…",
            });
          } else if (name === "stageCharge") {
            patchStep("stageCharge", {
              status: "running",
              note: "auth hold · $188.40 on card •••4242",
            });
          } else if (name === "requestOperatorReview") {
            suspendCallId = callId;
            patchStep("requestOperatorReview", {
              status: "waiting",
              note: "workflow suspended — awaiting operator",
            });
            setRunStatus("suspended");
          } else if (name === "notifyRestaurant") {
            patchStep("notifyRestaurant", {
              status: "running",
              note: "ticket dispatch to Burger Barn",
            });
          }
        } else if (chunk.type === "tool-output-available") {
          const callId = String(chunk.toolCallId ?? "");
          const output = chunk.output as
            | {
                approved?: boolean;
                flagged?: boolean;
                reasons?: string[];
                score?: number;
                status?: string;
              }
            | undefined;

          // Figure out which tool this output belongs to by the ids we tracked.
          // We flip state based on the payload shape.
          if (suspendCallId && callId === suspendCallId) {
            const approved = Boolean(output?.approved);
            setDecision(approved ? "approved" : "rejected");
            patchStep("requestOperatorReview", {
              status: approved ? "resumed" : "rejected",
              note: approved
                ? "operator approved · agent resumed"
                : "operator rejected · agent resumed",
            });
            setRunStatus("resuming");
            if (!approved) {
              patchStep("notifyRestaurant", {
                status: "skipped",
                note: "skipped — order was rejected",
              });
            }
          } else if (output && typeof output === "object") {
            if ("flagged" in output) {
              const reasons = (output.reasons ?? []).join(" · ");
              patchStep("screenForFraud", {
                status: "succeeded",
                note: `flagged · score ${(output.score ?? 0).toFixed(2)} · ${reasons}`,
              });
            } else if ("status" in output && output.status === "authorized_pending_review") {
              patchStep("stageCharge", {
                status: "succeeded",
                note: "authorized — awaiting review",
              });
            } else if ("normalized" in (output as Record<string, unknown>)) {
              patchStep("validateDeliveryAddress", {
                status: "succeeded",
                note: "200 OK · lat 37.7935 / lng -122.3964",
              });
            } else if ("ticketId" in (output as Record<string, unknown>)) {
              patchStep("notifyRestaurant", {
                status: "succeeded",
                note: "ticket sent · Burger Barn accepted",
              });
            }
          }
        } else if (chunk.type === "text-delta") {
          const delta = (chunk as { delta?: string }).delta;
          if (typeof delta === "string") {
            assistantBufRef.current += delta;
            setFinalMessage(assistantBufRef.current);
          }
        }
      }
    }

    setRunStatus("done");
  }, [patchStep, runStatus]);

  const handleDecision = useCallback(
    async (approved: boolean, reason?: string) => {
      if (runStatus !== "suspended") return;
      try {
        await fetch("/api/experiments/order-suspend/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: SUSPEND_TOKEN,
            approved,
            reason,
          }),
        });
      } catch {
        // Stream will still reflect the final state if the server was already
        // notified. Surface nothing on the stage.
      }
    },
    [runStatus],
  );

  useEffect(() => {
    return () => {
      assistantBufRef.current = "";
    };
  }, []);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-black text-white">
      <Header runStatus={runStatus} runId={runId} onRun={handleRun} />

      <div className="flex min-h-0 flex-1 gap-10 px-14 py-10">
        <OrderCard />
        <TimelineCard
          steps={steps}
          finalMessage={finalMessage}
          runStatus={runStatus}
          decision={decision}
          onDecision={handleDecision}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header
// ---------------------------------------------------------------------------

function Header({
  runStatus,
  runId,
  onRun,
}: {
  runStatus: RunStatus;
  runId: string | null;
  onRun: () => void;
}) {
  const pill =
    runStatus === "running"
      ? "border-sky-400/40 bg-sky-500/10 text-sky-300 animate-pulse"
      : runStatus === "suspended"
        ? "border-amber-400/50 bg-amber-500/10 text-amber-300 animate-pulse"
        : runStatus === "resuming"
          ? "border-sky-400/50 bg-sky-500/15 text-sky-200 animate-pulse"
          : runStatus === "done"
            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
            : runStatus === "error"
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-white/10 bg-white/5 text-zinc-400";
  const pillLabel =
    runStatus === "running"
      ? "AGENT RUNNING"
      : runStatus === "suspended"
        ? "WAITING ON HUMAN"
        : runStatus === "resuming"
          ? "AGENT RESUMED"
          : runStatus === "done"
            ? "FLOW COMPLETE"
            : runStatus === "error"
              ? "ERROR"
              : "IDLE";

  const disabled = runStatus === "running" || runStatus === "suspended" || runStatus === "resuming";

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-14 py-8">
      <div className="flex items-center gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/40 bg-amber-500/10 font-mono text-xl text-amber-300">
          ⏸
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Experiment · order-suspend
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            DurableAgent pauses for a human, then resumes
          </h1>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div
          className={`rounded-full border px-4 py-1.5 font-mono text-xs font-semibold tracking-[0.2em] ${pill}`}
        >
          {pillLabel}
        </div>
        <div className="min-w-[260px] truncate rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-right font-mono text-xs text-zinc-500">
          {runId ?? "—"}
        </div>
        <button
          type="button"
          onClick={onRun}
          disabled={disabled}
          className="rounded-xl bg-white px-6 py-2.5 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {runStatus === "running"
            ? "Running…"
            : runStatus === "suspended"
              ? "Suspended…"
              : runStatus === "resuming"
                ? "Resuming…"
                : "Run"}
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Order card (left pane)
// ---------------------------------------------------------------------------

function OrderCard() {
  return (
    <section className="flex w-[420px] shrink-0 flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-950 p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Follow-up order
        </p>
        <p className="mt-1 font-mono text-xl text-white">{ORDER_ID}</p>
        <p className="mt-1 font-mono text-xs text-zinc-500">
          same customer as ord-5621
        </p>
      </div>

      <div className="rounded-xl border border-white/5 bg-black/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Restaurant
        </p>
        <p className="mt-1 text-lg text-white">Burger Barn</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Deliver to
        </p>
        <p className="mt-1 text-lg text-white">600 Embarcadero</p>
        <p className="font-mono text-sm text-zinc-500">
          San Francisco, CA · address changed 7m ago
        </p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-5">
        <div>
          <p className="text-sm text-zinc-300">Catering tray ×12 + sides</p>
          <p className="font-mono text-xs text-zinc-500">sku burger-tray-12</p>
        </div>
        <p className="font-mono text-xl text-white">$188.40</p>
      </div>

      <div className="mt-auto rounded-xl border border-amber-400/30 bg-amber-500/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
          The suspend story
        </p>
        <p className="mt-2 text-base leading-relaxed text-zinc-300">
          The agent stages the charge, then calls{" "}
          <span className="font-mono text-amber-300">requestOperatorReview</span>.
          The workflow SUSPENDS on a durable hook. When the operator decides,
          the SAME agent loop resumes — no replay, same messages in context.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Timeline + approval card
// ---------------------------------------------------------------------------

function TimelineCard({
  steps,
  finalMessage,
  runStatus,
  decision,
  onDecision,
}: {
  steps: StepState[];
  finalMessage: string;
  runStatus: RunStatus;
  decision: Decision;
  onDecision: (approved: boolean, reason?: string) => void;
}) {
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950 p-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Tool calls
        </p>
        <p className="font-mono text-xs text-zinc-600">
          claude-haiku-4.5 · DurableAgent
        </p>
      </div>

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </div>

      <ApprovalPanel
        runStatus={runStatus}
        decision={decision}
        onDecision={onDecision}
      />

      <FinalMessage message={finalMessage} />
    </section>
  );
}

function StepRow({ step }: { step: StepState }) {
  const accent = STATUS_ACCENTS[step.status];
  const suspending = step.status === "waiting";
  const resumed = step.status === "resumed";

  return (
    <div
      className={`flex min-h-[74px] items-center justify-between rounded-xl border px-5 py-3 transition-colors duration-300 ${accent.border} ${accent.bg} ${
        suspending ? "shadow-[0_0_40px_-10px_rgba(251,191,36,0.55)]" : ""
      } ${resumed ? "shadow-[0_0_40px_-10px_rgba(56,189,248,0.55)]" : ""}`}
    >
      <div className="flex items-center gap-4">
        <StatusDot status={step.status} />
        <div>
          <p className="font-mono text-lg text-white">{step.label}</p>
          <p className="font-mono text-xs text-zinc-500">{step.sublabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <p
          style={{ minWidth: 320 }}
          className="text-right font-mono text-sm text-zinc-400"
        >
          {step.note || "—"}
        </p>
        <div
          className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${accent.pill}`}
        >
          {accent.label}
        </div>
      </div>
    </div>
  );
}

function ApprovalPanel({
  runStatus,
  decision,
  onDecision,
}: {
  runStatus: RunStatus;
  decision: Decision;
  onDecision: (approved: boolean, reason?: string) => void;
}) {
  const visible = runStatus === "suspended";

  return (
    <div
      style={{ minHeight: 140 }}
      className={`mt-6 overflow-hidden rounded-xl border p-5 transition-[opacity,border-color,background-color] duration-500 ${
        visible
          ? "border-amber-400/50 bg-amber-500/10 opacity-100"
          : decision === "approved"
            ? "border-emerald-400/30 bg-emerald-500/5 opacity-100"
            : decision === "rejected"
              ? "border-red-500/40 bg-red-500/10 opacity-100"
              : "border-white/5 bg-black/40 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${
              visible
                ? "animate-pulse bg-amber-400"
                : decision === "approved"
                  ? "bg-emerald-400"
                  : decision === "rejected"
                    ? "bg-red-500"
                    : "bg-zinc-700"
            }`}
          />
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {visible
              ? "Operator review required"
              : decision === "approved"
                ? "Approved — agent resumed"
                : decision === "rejected"
                  ? "Rejected — agent resumed"
                  : "Operator review"}
          </p>
        </div>
        <p className="font-mono text-xs text-zinc-500">
          token · {SUSPEND_TOKEN}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-6">
        <p className="text-base leading-relaxed text-zinc-300">
          Catering tray at a new address, $188.40. Approve to notify Burger
          Barn, or reject to cancel the notify step. The agent resumes from
          the exact line either way.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onDecision(false, "operator rejected")}
            disabled={!visible}
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-5 py-2 font-semibold text-red-300 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reject
          </button>
          <button
            type="button"
            onClick={() => onDecision(true)}
            disabled={!visible}
            className="rounded-xl bg-amber-400 px-5 py-2 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Approve
          </button>
        </div>
      </div>
    </div>
  );
}

function StatusDot({ status }: { status: StepStatus }) {
  const color =
    status === "succeeded"
      ? "bg-emerald-400"
      : status === "rejected"
        ? "bg-red-500"
        : status === "skipped"
          ? "bg-zinc-600"
          : status === "waiting"
            ? "bg-amber-400 animate-pulse"
            : status === "resumed"
              ? "bg-sky-400 animate-pulse"
              : status === "running"
                ? "bg-sky-400 animate-pulse"
                : "bg-zinc-700";
  return <span className={`h-3 w-3 rounded-full ${color}`} />;
}

function FinalMessage({ message }: { message: string }) {
  return (
    <div
      style={{ minHeight: 64 }}
      className={`mt-6 flex items-center rounded-xl border border-white/5 bg-black/40 px-5 transition-opacity duration-500 ${
        message ? "opacity-100" : "opacity-25"
      }`}
    >
      <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Agent
      </span>
      <span className="ml-4 text-lg text-zinc-100">{message || "…"}</span>
    </div>
  );
}

const STATUS_ACCENTS: Record<
  StepStatus,
  { border: string; bg: string; pill: string; label: string }
> = {
  idle: {
    border: "border-white/10",
    bg: "bg-black/30",
    pill: "border-white/10 bg-white/5 text-zinc-500",
    label: "IDLE",
  },
  running: {
    border: "border-sky-400/30",
    bg: "bg-sky-500/5",
    pill: "border-sky-400/40 bg-sky-500/10 text-sky-300",
    label: "RUNNING",
  },
  waiting: {
    border: "border-amber-400/50",
    bg: "bg-amber-500/10",
    pill: "border-amber-400/50 bg-amber-500/15 text-amber-200",
    label: "SUSPENDED",
  },
  resumed: {
    border: "border-sky-400/50",
    bg: "bg-sky-500/10",
    pill: "border-sky-400/50 bg-sky-500/15 text-sky-200",
    label: "RESUMED",
  },
  succeeded: {
    border: "border-emerald-400/30",
    bg: "bg-emerald-500/5",
    pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    label: "SUCCEEDED",
  },
  rejected: {
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    pill: "border-red-500/40 bg-red-500/10 text-red-300",
    label: "REJECTED",
  },
  skipped: {
    border: "border-white/10",
    bg: "bg-black/30",
    pill: "border-white/10 bg-white/5 text-zinc-500",
    label: "SKIPPED",
  },
};
