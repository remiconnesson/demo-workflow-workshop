"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// Types — the three tools the agent will call, in order.
// ---------------------------------------------------------------------------

type StepId = "validateDeliveryAddress" | "chargeCustomer" | "pingRestaurant";

type StepStatus = "idle" | "running" | "retrying" | "succeeded" | "failed";

type StepState = {
  id: StepId;
  label: string;
  sublabel: string;
  status: StepStatus;
  attempts: AttemptState[];
};

type AttemptState = {
  attempt: number;
  status: "running" | "failed" | "succeeded";
  note: string;
};

const INITIAL_STEPS: StepState[] = [
  {
    id: "validateDeliveryAddress",
    label: "Validate delivery address",
    sublabel: "smarty-geocoder · third-party",
    status: "idle",
    attempts: [],
  },
  {
    id: "chargeCustomer",
    label: "Charge customer",
    sublabel: "payments · captured",
    status: "idle",
    attempts: [],
  },
  {
    id: "pingRestaurant",
    label: "Notify Burger Barn",
    sublabel: "kitchen ticket dispatch",
    status: "idle",
    attempts: [],
  },
];

type ToolChunk =
  | { type: "tool-input-start"; toolName?: string; toolCallId?: string }
  | { type: "tool-input-available"; toolName?: string; toolCallId?: string }
  | { type: "tool-output-available"; toolCallId?: string; output?: unknown }
  | { type: string; [k: string]: unknown };

export default function OrderRetryPage() {
  const [steps, setSteps] = useState<StepState[]>(INITIAL_STEPS);
  const [runStatus, setRunStatus] = useState<
    "idle" | "running" | "done" | "error"
  >("idle");
  const [runId, setRunId] = useState<string | null>(null);
  const [finalMessage, setFinalMessage] = useState<string>("");
  const assistantBufRef = useRef<string>("");

  const patchStep = useCallback(
    (id: StepId, patch: Partial<StepState>) => {
      setSteps((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...patch } : s)),
      );
    },
    [],
  );

  const pushAttempt = useCallback(
    (id: StepId, attempt: AttemptState) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === id ? { ...s, attempts: [...s.attempts, attempt] } : s,
        ),
      );
    },
    [],
  );

  const updateAttempt = useCallback(
    (id: StepId, attemptNo: number, patch: Partial<AttemptState>) => {
      setSteps((prev) =>
        prev.map((s) =>
          s.id === id
            ? {
                ...s,
                attempts: s.attempts.map((a) =>
                  a.attempt === attemptNo ? { ...a, ...patch } : a,
                ),
              }
            : s,
        ),
      );
    },
    [],
  );

  /**
   * Scripted reveal of the retry moment. We kick this off the instant the
   * agent issues its first tool-input-start for `validateDeliveryAddress`.
   * The SDK hides the retry from the agent (it only sees the final success),
   * so we surface it on-stage with a two-beat animation: attempt 1 fails
   * with a 503, then attempt 2 succeeds — same stepId, different result.
   */
  const playValidateRetry = useCallback(async () => {
    patchStep("validateDeliveryAddress", { status: "running" });
    pushAttempt("validateDeliveryAddress", {
      attempt: 1,
      status: "running",
      note: "POST /geocode · 1455 Market St",
    });
    await wait(900);
    updateAttempt("validateDeliveryAddress", 1, {
      status: "failed",
      note: "503 Service Unavailable — RetryableError",
    });
    patchStep("validateDeliveryAddress", { status: "retrying" });
    await wait(700);
    pushAttempt("validateDeliveryAddress", {
      attempt: 2,
      status: "running",
      note: "runtime replayed step (same stepId)",
    });
    await wait(900);
    updateAttempt("validateDeliveryAddress", 2, {
      status: "succeeded",
      note: "200 OK · lat 37.7751 / lng -122.4194",
    });
    patchStep("validateDeliveryAddress", { status: "succeeded" });
  }, [patchStep, pushAttempt, updateAttempt]);

  const playOneShot = useCallback(
    async (id: StepId, note: string) => {
      patchStep(id, { status: "running" });
      pushAttempt(id, { attempt: 1, status: "running", note });
      await wait(700);
      updateAttempt(id, 1, { status: "succeeded", note: `${note} · ok` });
      patchStep(id, { status: "succeeded" });
    },
    [patchStep, pushAttempt, updateAttempt],
  );

  const handleRun = useCallback(async () => {
    if (runStatus === "running") return;
    setSteps(INITIAL_STEPS.map((s) => ({ ...s, attempts: [] })));
    setFinalMessage("");
    setRunId(null);
    assistantBufRef.current = "";
    setRunStatus("running");

    let res: Response;
    try {
      res = await fetch("/api/experiments/order-retry/start", {
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

    // Track which tool calls we've already triggered UI for.
    const seenTools = new Set<string>();
    // Serialize our scripted animations so beats don't overlap.
    const queue: Array<() => Promise<void>> = [];
    let draining = false;
    const drain = async () => {
      if (draining) return;
      draining = true;
      while (queue.length > 0) {
        const next = queue.shift()!;
        await next();
      }
      draining = false;
    };
    const enqueue = (fn: () => Promise<void>) => {
      queue.push(fn);
      void drain();
    };

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
          const key = `${name}:${chunk.toolCallId ?? ""}`;
          if (seenTools.has(key)) continue;
          seenTools.add(key);
          if (name === "validateDeliveryAddress") {
            enqueue(() => playValidateRetry());
          } else if (name === "chargeCustomer") {
            enqueue(() => playOneShot(name, "auth · $12.50 on card •••4242"));
          } else if (name === "pingRestaurant") {
            enqueue(() => playOneShot(name, "ticket sent to Burger Barn"));
          }
        } else if (chunk.type === "text-delta") {
          // Accumulate the agent's final assistant text.
          const delta = (chunk as { delta?: string }).delta;
          if (typeof delta === "string") {
            assistantBufRef.current += delta;
            setFinalMessage(assistantBufRef.current);
          }
        }
      }
    }

    // Let any final queued beat finish before flipping to done.
    while (draining || queue.length > 0) {
      await wait(100);
    }
    setRunStatus("done");
  }, [playOneShot, playValidateRetry, runStatus]);

  // Ensure the "initial" reset stays pristine across renders.
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
        <TimelineCard steps={steps} finalMessage={finalMessage} />
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
  runStatus: "idle" | "running" | "done" | "error";
  runId: string | null;
  onRun: () => void;
}) {
  const pill =
    runStatus === "running"
      ? "border-sky-400/40 bg-sky-500/10 text-sky-300 animate-pulse"
      : runStatus === "done"
        ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
        : runStatus === "error"
          ? "border-red-500/40 bg-red-500/10 text-red-300"
          : "border-white/10 bg-white/5 text-zinc-400";
  const pillLabel =
    runStatus === "running"
      ? "AGENT RUNNING"
      : runStatus === "done"
        ? "ORDER CONFIRMED"
        : runStatus === "error"
          ? "ERROR"
          : "IDLE";

  return (
    <header className="flex items-center justify-between border-b border-white/10 px-14 py-8">
      <div className="flex items-center gap-6">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-sky-400/30 bg-sky-500/10 font-mono text-xl text-sky-300">
          ↻
        </div>
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Experiment · order-retry
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">
            DurableAgent retries a flaky geocoder
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
          disabled={runStatus === "running"}
          className="rounded-xl bg-white px-6 py-2.5 font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
        >
          {runStatus === "running" ? "Running…" : "Run"}
        </button>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Order card (left pane, static context)
// ---------------------------------------------------------------------------

function OrderCard() {
  return (
    <section className="flex w-[420px] shrink-0 flex-col gap-6 rounded-2xl border border-white/10 bg-zinc-950 p-8">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Order
        </p>
        <p className="mt-1 font-mono text-xl text-white">ord-5621</p>
      </div>

      <div className="rounded-xl border border-white/5 bg-black/40 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Restaurant
        </p>
        <p className="mt-1 text-lg text-white">Burger Barn</p>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Deliver to
        </p>
        <p className="mt-1 text-lg text-white">1455 Market St</p>
        <p className="font-mono text-sm text-zinc-500">San Francisco, CA</p>
      </div>

      <div className="flex items-center justify-between rounded-xl border border-white/5 bg-black/40 p-5">
        <div>
          <p className="text-sm text-zinc-300">Classic Burger ×1</p>
          <p className="font-mono text-xs text-zinc-500">sku burger-classic</p>
        </div>
        <p className="font-mono text-xl text-white">$12.50</p>
      </div>

      <div className="mt-auto rounded-xl border border-sky-400/20 bg-sky-500/5 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-300">
          The retry story
        </p>
        <p className="mt-2 text-base leading-relaxed text-zinc-300">
          The agent calls <span className="font-mono text-sky-300">validateDeliveryAddress</span>{" "}
          once. The third-party geocoder returns 503 on attempt 1; the
          Workflow runtime replays the same step on attempt 2. The agent
          never sees the failure.
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Timeline card
// ---------------------------------------------------------------------------

function TimelineCard({
  steps,
  finalMessage,
}: {
  steps: StepState[];
  finalMessage: string;
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

      <div className="mt-6 flex min-h-0 flex-1 flex-col gap-4 overflow-hidden">
        {steps.map((step) => (
          <StepRow key={step.id} step={step} />
        ))}
      </div>

      <FinalMessage message={finalMessage} />
    </section>
  );
}

function StepRow({ step }: { step: StepState }) {
  const accent = STATUS_ACCENTS[step.status];

  return (
    <div
      className={`flex min-h-[140px] flex-col rounded-xl border p-5 transition-colors duration-300 ${accent.border} ${accent.bg}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <StatusDot status={step.status} />
          <div>
            <p className="font-mono text-lg text-white">{step.label}</p>
            <p className="font-mono text-xs text-zinc-500">{step.sublabel}</p>
          </div>
        </div>
        <div
          className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${accent.pill}`}
        >
          {accent.label}
        </div>
      </div>

      <div
        style={{ minHeight: 56 }}
        className="mt-3 flex flex-col justify-center gap-1.5"
      >
        {step.attempts.length === 0 ? (
          <p className="font-mono text-sm text-zinc-600">awaiting agent…</p>
        ) : (
          step.attempts.map((a) => <AttemptLine key={a.attempt} attempt={a} />)
        )}
      </div>
    </div>
  );
}

function AttemptLine({ attempt }: { attempt: AttemptState }) {
  const styles =
    attempt.status === "failed"
      ? "border-red-500/40 bg-red-500/10 text-red-300"
      : attempt.status === "succeeded"
        ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
        : "border-sky-400/40 bg-sky-500/10 text-sky-300";

  return (
    <div className="flex items-center gap-3 transition-opacity duration-500">
      <span
        className={`rounded-md border px-2 py-0.5 font-mono text-[11px] font-semibold tracking-[0.18em] ${styles}`}
      >
        ATTEMPT {attempt.attempt}
      </span>
      <span className="font-mono text-sm text-zinc-300">{attempt.note}</span>
    </div>
  );
}

function StatusDot({ status }: { status: StepStatus }) {
  const color =
    status === "succeeded"
      ? "bg-emerald-400"
      : status === "failed"
        ? "bg-red-500"
        : status === "retrying"
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
      <span className="ml-4 text-lg text-zinc-100">
        {message || "…"}
      </span>
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
  retrying: {
    border: "border-sky-400/50",
    bg: "bg-sky-500/10",
    pill: "border-sky-400/50 bg-sky-500/15 text-sky-200",
    label: "RETRYING",
  },
  succeeded: {
    border: "border-emerald-400/30",
    bg: "bg-emerald-500/5",
    pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    label: "SUCCEEDED",
  },
  failed: {
    border: "border-red-500/40",
    bg: "bg-red-500/10",
    pill: "border-red-500/40 bg-red-500/10 text-red-300",
    label: "FAILED",
  },
};

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
