"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Chapter 3: ROLLBACK.
//
// The approved catering tray (ord-5627) is mid-flight. The agent captures
// the payment, dispatches a driver, and sends the customer an ETA — three
// real side effects. Then it suspends on an in-flight kitchen inspection.
//
// When the operator fires the "Allergen alert" button, the hook resumes
// with allergenAlert=true and the agent itself calls the compensations in
// REVERSE order. The UI mirrors that unwind: the same three forward rows
// flash fuchsia and flip to ROLLED BACK, last-first.
// ---------------------------------------------------------------------------

type ForwardId =
  | "capturePayment"
  | "dispatchDriver"
  | "sendCustomerETA";

type CompensationId =
  | "retractCustomerETA"
  | "releaseDriver"
  | "refundCustomer"
  | "voidRestaurantTicket";

type StepId =
  | ForwardId
  | "awaitInFlightCheck"
  | CompensationId;

type StepStatus =
  | "idle"
  | "running"
  | "succeeded"
  | "waiting"
  | "rollingBack"
  | "rolledBack"
  | "cleared";

type Lane = "forward" | "check" | "compensation";

type StepState = {
  id: StepId;
  lane: Lane;
  label: string;
  sublabel: string;
  status: StepStatus;
  note: string;
  undoes?: ForwardId; // for compensation rows
};

const ORDER_ID = "ord-5627";
const ROLLBACK_TOKEN = `order-rollback:${ORDER_ID}`;

const INITIAL_STEPS: StepState[] = [
  {
    id: "capturePayment",
    lane: "forward",
    label: "Capture payment",
    sublabel: "stripe · $188.40",
    status: "idle",
    note: "",
  },
  {
    id: "dispatchDriver",
    lane: "forward",
    label: "Dispatch driver",
    sublabel: "driver · Priya K. · Burger Barn",
    status: "idle",
    note: "",
  },
  {
    id: "sendCustomerETA",
    lane: "forward",
    label: "Send customer ETA",
    sublabel: "push + sms · cust-8821",
    status: "idle",
    note: "",
  },
  {
    id: "awaitInFlightCheck",
    lane: "check",
    label: "In-flight allergen check",
    sublabel: "workflow.hook · kitchen inspection",
    status: "idle",
    note: "",
  },
  {
    id: "retractCustomerETA",
    lane: "compensation",
    label: "Retract customer ETA",
    sublabel: "compensates sendCustomerETA",
    status: "idle",
    note: "",
    undoes: "sendCustomerETA",
  },
  {
    id: "releaseDriver",
    lane: "compensation",
    label: "Release driver",
    sublabel: "compensates dispatchDriver",
    status: "idle",
    note: "",
    undoes: "dispatchDriver",
  },
  {
    id: "refundCustomer",
    lane: "compensation",
    label: "Refund customer",
    sublabel: "compensates capturePayment",
    status: "idle",
    note: "",
    undoes: "capturePayment",
  },
  {
    id: "voidRestaurantTicket",
    lane: "compensation",
    label: "Void Burger Barn ticket",
    sublabel: "kitchen close-out",
    status: "idle",
    note: "",
  },
];

type ToolChunk =
  | { type: "tool-input-start"; toolName?: string; toolCallId?: string }
  | { type: "tool-output-available"; toolCallId?: string; output?: unknown }
  | { type: "text-delta"; delta?: string }
  | { type: string; [k: string]: unknown };

type RunStatus =
  | "idle"
  | "running"
  | "monitoring"
  | "rollingBack"
  | "done"
  | "error";

type FlightOutcome = "pending" | "cleared" | "alert";

export default function OrderRollbackPage() {
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [runStatus, setRunStatus] = useState<RunStatus>("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [finalMessage, setFinalMessage] = useState<string>("");
  const [outcome, setOutcome] = useState<FlightOutcome>("pending");
  const assistantBufRef = useRef<string>("");

  const patchStep = useCallback((id: StepId, patch: Partial<StepState>) => {
    setSteps((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    );
  }, []);

  // Mark the matching forward row as rolled back when its compensation fires.
  const markForwardRolledBack = useCallback(
    (forwardId: ForwardId) => {
      patchStep(forwardId, {
        status: "rolledBack",
        note: "rolled back by agent",
      });
    },
    [patchStep],
  );

  const handleRun = useCallback(async () => {
    if (runStatus === "running" || runStatus === "monitoring" || runStatus === "rollingBack") return;
    setSteps(INITIAL_STEPS.map((s) => ({ ...s })));
    setFinalMessage("");
    setRunId(null);
    setOutcome("pending");
    assistantBufRef.current = "";
    setRunStatus("running");

    let res: Response;
    try {
      res = await fetch("/api/experiments/order-rollback/start", {
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
    setRunId(res.headers.get("x-workflow-run-id"));

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    const seenTools = new Set<string>();
    let checkCallId: string | null = null;

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

          if (name === "capturePayment") {
            patchStep("capturePayment", {
              status: "running",
              note: "capture · $188.40 on card •••4242",
            });
          } else if (name === "dispatchDriver") {
            patchStep("dispatchDriver", {
              status: "running",
              note: "assigning driver near Burger Barn…",
            });
          } else if (name === "sendCustomerETA") {
            patchStep("sendCustomerETA", {
              status: "running",
              note: "push + sms to cust-8821…",
            });
          } else if (name === "awaitInFlightCheck") {
            checkCallId = callId;
            patchStep("awaitInFlightCheck", {
              status: "waiting",
              note: "tray en route — kitchen running allergen inspection",
            });
            setRunStatus("monitoring");
          } else if (name === "retractCustomerETA") {
            setRunStatus("rollingBack");
            patchStep("retractCustomerETA", {
              status: "rollingBack",
              note: "pushing retraction to cust-8821…",
            });
          } else if (name === "releaseDriver") {
            setRunStatus("rollingBack");
            patchStep("releaseDriver", {
              status: "rollingBack",
              note: "recalling Priya K. · freeing dispatch…",
            });
          } else if (name === "refundCustomer") {
            setRunStatus("rollingBack");
            patchStep("refundCustomer", {
              status: "rollingBack",
              note: "issuing full refund · $188.40…",
            });
          } else if (name === "voidRestaurantTicket") {
            setRunStatus("rollingBack");
            patchStep("voidRestaurantTicket", {
              status: "rollingBack",
              note: "closing out Burger Barn ticket…",
            });
          }
        } else if (chunk.type === "tool-output-available") {
          const callId = String(chunk.toolCallId ?? "");
          const output = chunk.output as
            | Record<string, unknown>
            | undefined;
          if (!output || typeof output !== "object") continue;

          if (checkCallId && callId === checkCallId) {
            const alert = Boolean(output.allergenAlert);
            setOutcome(alert ? "alert" : "cleared");
            patchStep("awaitInFlightCheck", {
              status: alert ? "rollingBack" : "cleared",
              note: alert
                ? "PEANUT CONTAMINATION · rollback armed"
                : "all clear · delivery continues",
            });
            if (!alert) {
              setRunStatus("done");
            }
          } else {
            const status = output.status;
            if (status === "captured") {
              patchStep("capturePayment", {
                status: "succeeded",
                note: `captured · ${String(output.paymentId ?? "")}`,
              });
            } else if (status === "en_route") {
              patchStep("dispatchDriver", {
                status: "succeeded",
                note: `en route · driver ${String(output.driverName ?? "")} · ETA ${String(
                  output.etaMinutes ?? "",
                )}m`,
              });
            } else if (status === "delivered") {
              patchStep("sendCustomerETA", {
                status: "succeeded",
                note: "customer notified",
              });
            } else if (status === "retracted") {
              patchStep("retractCustomerETA", {
                status: "rolledBack",
                note: "retraction delivered",
              });
              markForwardRolledBack("sendCustomerETA");
            } else if (status === "recalled") {
              patchStep("releaseDriver", {
                status: "rolledBack",
                note: "driver released",
              });
              markForwardRolledBack("dispatchDriver");
            } else if (status === "refunded") {
              patchStep("refundCustomer", {
                status: "rolledBack",
                note: `refunded · ${String(output.refundId ?? "")}`,
              });
              markForwardRolledBack("capturePayment");
            } else if (status === "voided") {
              patchStep("voidRestaurantTicket", {
                status: "rolledBack",
                note: "ticket voided · Burger Barn acknowledged",
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
  }, [markForwardRolledBack, patchStep, runStatus]);

  const handleSignal = useCallback(
    async (allergenAlert: boolean, reason?: string) => {
      if (runStatus !== "monitoring") return;
      try {
        await fetch("/api/experiments/order-rollback/alert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: ROLLBACK_TOKEN,
            allergenAlert,
            reason,
          }),
        });
      } catch {
        // Stream will still reflect state; nothing to surface on stage.
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
        <OrderCard outcome={outcome} />
        <TimelineCard
          steps={steps}
          finalMessage={finalMessage}
          runStatus={runStatus}
          outcome={outcome}
          onSignal={handleSignal}
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
      : runStatus === "monitoring"
        ? "border-amber-400/50 bg-amber-500/10 text-amber-300 animate-pulse"
        : runStatus === "rollingBack"
          ? "border-fuchsia-400/50 bg-fuchsia-500/10 text-fuchsia-300 animate-pulse"
          : runStatus === "done"
            ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
            : runStatus === "error"
              ? "border-red-500/40 bg-red-500/10 text-red-300"
              : "border-white/10 bg-white/5 text-zinc-400";
  const pillLabel =
    runStatus === "running"
      ? "AGENT RUNNING"
      : runStatus === "monitoring"
        ? "AWAITING SAFETY CHECK"
        : runStatus === "rollingBack"
          ? "UNWINDING"
          : runStatus === "done"
            ? "FLOW COMPLETE"
            : runStatus === "error"
              ? "ERROR"
              : "IDLE";

  const disabled =
    runStatus === "running" ||
    runStatus === "monitoring" ||
    runStatus === "rollingBack";

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-14 py-8">
      <div className="flex items-center gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-fuchsia-400/40 bg-fuchsia-500/10 font-mono text-xl text-fuchsia-300">
          ↶
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Experiment · order-rollback
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            DurableAgent unwinds its own side effects in reverse
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
            : runStatus === "monitoring"
              ? "Monitoring…"
              : runStatus === "rollingBack"
                ? "Unwinding…"
                : "Run"}
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Order card (left pane)
// ---------------------------------------------------------------------------

function OrderCard({ outcome }: { outcome: FlightOutcome }) {
  return (
    <section className="flex w-[420px] shrink-0 flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-950 p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Approved order · in flight
        </p>
        <p className="mt-1 font-mono text-xl text-white">{ORDER_ID}</p>
        <p className="mt-1 font-mono text-xs text-zinc-500">
          continuation of ord-5627 · cust-8821
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
        <p className="font-mono text-sm text-zinc-500">San Francisco, CA</p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-5">
        <div>
          <p className="text-sm text-zinc-300">Catering tray ×12 + sides</p>
          <p className="font-mono text-xs text-zinc-500">sku burger-tray-12</p>
        </div>
        <p className="font-mono text-xl text-white">$188.40</p>
      </div>

      <div
        className={`mt-auto rounded-xl border p-5 transition-colors duration-500 ${
          outcome === "alert"
            ? "border-fuchsia-400/40 bg-fuchsia-500/10"
            : outcome === "cleared"
              ? "border-emerald-400/30 bg-emerald-500/5"
              : "border-fuchsia-400/20 bg-fuchsia-500/5"
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-[0.2em] ${
            outcome === "cleared" ? "text-emerald-300" : "text-fuchsia-300"
          }`}
        >
          The rollback story
        </p>
        <p className="mt-2 text-base leading-relaxed text-zinc-300">
          The agent captures payment, dispatches a driver, and pings the
          customer — three real side effects. A kitchen allergen check flips
          the story: the agent itself calls{" "}
          <span className="font-mono text-fuchsia-300">
            retract → release → refund → void
          </span>{" "}
          in the exact reverse order of what it did.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Timeline + alert controls
// ---------------------------------------------------------------------------

function TimelineCard({
  steps,
  finalMessage,
  runStatus,
  outcome,
  onSignal,
}: {
  steps: StepState[];
  finalMessage: string;
  runStatus: RunStatus;
  outcome: FlightOutcome;
  onSignal: (allergenAlert: boolean, reason?: string) => void;
}) {
  const forward = steps.filter((s) => s.lane === "forward");
  const check = steps.find((s) => s.lane === "check")!;
  const compensations = steps.filter((s) => s.lane === "compensation");

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
        <LaneLabel text="Forward · side effects" tone="neutral" />
        {forward.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}

        <LaneLabel text="In-flight inspection" tone="amber" />
        <StepRow step={check} />

        <LaneLabel
          text="Reverse · compensations (agent-invoked)"
          tone="fuchsia"
        />
        {compensations.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </div>

      <AlertPanel
        runStatus={runStatus}
        outcome={outcome}
        onSignal={onSignal}
      />

      <FinalMessage message={finalMessage} />
    </section>
  );
}

function LaneLabel({
  text,
  tone,
}: {
  text: string;
  tone: "neutral" | "amber" | "fuchsia";
}) {
  const color =
    tone === "amber"
      ? "text-amber-300"
      : tone === "fuchsia"
        ? "text-fuchsia-300"
        : "text-zinc-500";
  return (
    <p
      className={`mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] ${color}`}
    >
      {text}
    </p>
  );
}

function StepRow({ step }: { step: StepState }) {
  const accent = STATUS_ACCENTS[step.status];
  const glow =
    step.status === "waiting"
      ? "shadow-[0_0_40px_-10px_rgba(251,191,36,0.55)]"
      : step.status === "rollingBack"
        ? "shadow-[0_0_40px_-10px_rgba(232,121,249,0.65)]"
        : step.status === "rolledBack"
          ? "shadow-[0_0_40px_-14px_rgba(232,121,249,0.4)]"
          : "";

  return (
    <div
      className={`flex min-h-[64px] items-center justify-between rounded-xl border px-5 py-3 transition-colors duration-300 ${accent.border} ${accent.bg} ${glow}`}
    >
      <div className="flex items-center gap-4">
        <StatusDot status={step.status} />
        <div>
          <p className="font-mono text-base text-white">{step.label}</p>
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

function AlertPanel({
  runStatus,
  outcome,
  onSignal,
}: {
  runStatus: RunStatus;
  outcome: FlightOutcome;
  onSignal: (allergenAlert: boolean, reason?: string) => void;
}) {
  const visible = runStatus === "monitoring";

  return (
    <div
      style={{ minHeight: 140 }}
      className={`mt-6 overflow-hidden rounded-xl border p-5 transition-[opacity,border-color,background-color] duration-500 ${
        visible
          ? "border-amber-400/50 bg-amber-500/10 opacity-100"
          : outcome === "alert"
            ? "border-fuchsia-400/50 bg-fuchsia-500/10 opacity-100"
            : outcome === "cleared"
              ? "border-emerald-400/30 bg-emerald-500/5 opacity-100"
              : "border-white/5 bg-black/40 opacity-60"
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span
            className={`h-3 w-3 rounded-full ${
              visible
                ? "animate-pulse bg-amber-400"
                : outcome === "alert"
                  ? "bg-fuchsia-400 animate-pulse"
                  : outcome === "cleared"
                    ? "bg-emerald-400"
                    : "bg-zinc-700"
            }`}
          />
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-400">
            {visible
              ? "Kitchen inspection in progress"
              : outcome === "alert"
                ? "Allergen alert — agent unwinding"
                : outcome === "cleared"
                  ? "All clear — delivery on track"
                  : "In-flight inspection"}
          </p>
        </div>
        <p className="font-mono text-xs text-zinc-500">
          token · {ROLLBACK_TOKEN}
        </p>
      </div>

      <div className="mt-3 flex items-center justify-between gap-6">
        <p className="text-base leading-relaxed text-zinc-300">
          Fire the safety signal. An allergen alert forces the agent to undo
          every prior step — retract the ETA, recall the driver, refund the
          customer, void the ticket — in reverse order.
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onSignal(false)}
            disabled={!visible}
            className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-5 py-2 font-semibold text-emerald-300 transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            All clear
          </button>
          <button
            type="button"
            onClick={() =>
              onSignal(true, "severe peanut contamination detected")
            }
            disabled={!visible}
            className="rounded-xl bg-fuchsia-400 px-5 py-2 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-40"
          >
            Allergen alert
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
      : status === "rolledBack"
        ? "bg-fuchsia-400"
        : status === "rollingBack"
          ? "bg-fuchsia-400 animate-pulse"
          : status === "waiting"
            ? "bg-amber-400 animate-pulse"
            : status === "cleared"
              ? "bg-emerald-400"
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
  succeeded: {
    border: "border-emerald-400/30",
    bg: "bg-emerald-500/5",
    pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    label: "SUCCEEDED",
  },
  waiting: {
    border: "border-amber-400/50",
    bg: "bg-amber-500/10",
    pill: "border-amber-400/50 bg-amber-500/15 text-amber-200",
    label: "SUSPENDED",
  },
  rollingBack: {
    border: "border-fuchsia-400/60",
    bg: "bg-fuchsia-500/10",
    pill: "border-fuchsia-400/60 bg-fuchsia-500/15 text-fuchsia-200",
    label: "UNWINDING",
  },
  rolledBack: {
    border: "border-fuchsia-400/40",
    bg: "bg-fuchsia-500/5",
    pill: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300",
    label: "ROLLED BACK",
  },
  cleared: {
    border: "border-emerald-400/30",
    bg: "bg-emerald-500/5",
    pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    label: "CLEARED",
  },
};
