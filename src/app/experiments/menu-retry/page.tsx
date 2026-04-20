"use client";

import { useCallback, useRef, useState } from "react";

// ---------------------------------------------------------------------------
// menu-retry demo page
//
// Three tool-call slots (readMenuItem, fetchCompetitorPrice,
// proposePriceTweak) render as fixed-height cards so the layout never
// shifts. The middle slot (price-oracle) is the star: it visibly ticks to
// "retrying" when the first attempt throws RetryableError, then settles
// to "ok" on attempt 2. Sky-400 retry accent per the verb palette.
//
// We parse the NDJSON stream of UIMessageChunk events and watch for
// `tool-*` chunks to drive slot state. The agent's own reasoning text
// streams into the summary card at the bottom.
// ---------------------------------------------------------------------------

type SlotState = "idle" | "calling" | "retrying" | "ok";

type ToolKey = "readMenuItem" | "fetchCompetitorPrice" | "proposePriceTweak";

type SlotView = {
  key: ToolKey;
  label: string;
  sub: string;
  state: SlotState;
  attempts: number;
  detail: string;
};

const INITIAL_SLOTS: Record<ToolKey, SlotView> = {
  readMenuItem: {
    key: "readMenuItem",
    label: "Read menu item",
    sub: "sku=burger-classic",
    state: "idle",
    attempts: 0,
    detail: "",
  },
  fetchCompetitorPrice: {
    key: "fetchCompetitorPrice",
    label: "Fetch competitor price",
    sub: "price-oracle · zip=94110",
    state: "idle",
    attempts: 0,
    detail: "",
  },
  proposePriceTweak: {
    key: "proposePriceTweak",
    label: "Propose price tweak",
    sub: "queued menu draft",
    state: "idle",
    attempts: 0,
    detail: "",
  },
};

const SLOT_ORDER: ToolKey[] = [
  "readMenuItem",
  "fetchCompetitorPrice",
  "proposePriceTweak",
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
    name === "readMenuItem" ||
    name === "fetchCompetitorPrice" ||
    name === "proposePriceTweak"
  );
}

function summarizeOutput(
  key: ToolKey,
  output: unknown,
): string {
  if (!output || typeof output !== "object") return "";
  const o = output as Record<string, unknown>;
  if (key === "readMenuItem") {
    const price = typeof o.price === "number" ? o.price : null;
    const name = typeof o.name === "string" ? o.name : "";
    return price != null ? `${name} · $${price.toFixed(2)}` : name;
  }
  if (key === "fetchCompetitorPrice") {
    const med =
      typeof o.competitorMedian === "number" ? o.competitorMedian : null;
    const n = typeof o.sampleSize === "number" ? o.sampleSize : null;
    return med != null
      ? `median $${med.toFixed(2)}${n != null ? ` · n=${n}` : ""}`
      : "";
  }
  if (key === "proposePriceTweak") {
    const np = typeof o.newPrice === "number" ? o.newPrice : null;
    return np != null ? `newPrice $${np.toFixed(2)}` : "";
  }
  return "";
}

export default function MenuRetryExperimentPage() {
  const [slots, setSlots] =
    useState<Record<ToolKey, SlotView>>(INITIAL_SLOTS);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [summary, setSummary] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);
  const runningRef = useRef(false);

  const reset = useCallback(() => {
    setSlots(INITIAL_SLOTS);
    setSummary("");
    setRunId(null);
    setStatus("idle");
  }, []);

  const handleRun = useCallback(async () => {
    if (runningRef.current) return;
    runningRef.current = true;
    reset();
    setStatus("running");

    try {
      const res = await fetch("/api/experiments/menu-retry/start", {
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

      // Per-toolCallId local state so we can distinguish "calling" vs
      // "retrying" for the same call when we see an error-text chunk.
      const perCall = new Map<
        string,
        { key: ToolKey; attempt: number; errored: boolean }
      >();

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
          handleChunk(chunk, perCall, setSlots, setSummary);
        }
      }
      setStatus("done");
    } catch {
      setStatus("error");
    } finally {
      runningRef.current = false;
    }
  }, [reset]);

  return (
    <div className="flex h-full w-full flex-col items-center justify-center px-10 py-10">
      <div className="flex w-full max-w-5xl flex-col gap-8">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-400">
              Menu curator · Retry
            </p>
            <h1 className="mt-2 text-5xl font-semibold tracking-tight">
              Price-oracle flakes. Agent never notices.
            </h1>
            <p className="mt-3 max-w-2xl text-lg text-zinc-400">
              The competitor-pricing aggregator 503s on the first attempt.
              The Workflow SDK retries the exact same stepId. The agent sees
              only the successful result.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <StatusPill status={status} />
            <button
              onClick={handleRun}
              disabled={status === "running"}
              className="rounded-xl bg-white px-6 py-3 text-base font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "running" ? "Running…" : "Run agent"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-3 gap-6">
          {SLOT_ORDER.map((key) => (
            <ToolSlotCard key={key} slot={slots[key]} />
          ))}
        </div>

        <SummaryCard summary={summary} runId={runId} />
      </div>
    </div>
  );
}

function handleChunk(
  chunk: ChunkLike,
  perCall: Map<string, { key: ToolKey; attempt: number; errored: boolean }>,
  setSlots: React.Dispatch<React.SetStateAction<Record<ToolKey, SlotView>>>,
  setSummary: React.Dispatch<React.SetStateAction<string>>,
) {
  const t = chunk.type ?? "";
  const id = chunk.toolCallId;
  const name = chunk.toolName;

  // UIMessageChunk tool lifecycle types: tool-input-start, tool-input-available,
  // tool-output-available, tool-output-error. Different ai-sdk versions emit
  // slightly different names; we handle the main three defensively.
  if (t.startsWith("tool-") && id && isToolKey(name)) {
    if (!perCall.has(id)) {
      perCall.set(id, { key: name, attempt: 1, errored: false });
    }
  }

  if (t === "tool-input-start" || t === "tool-input-available") {
    if (id && perCall.has(id)) {
      const entry = perCall.get(id)!;
      setSlots((prev) => ({
        ...prev,
        [entry.key]: {
          ...prev[entry.key],
          state: entry.errored ? "retrying" : "calling",
          attempts: Math.max(prev[entry.key].attempts, entry.attempt),
        },
      }));
    }
    return;
  }

  if (t === "tool-output-error") {
    if (id && perCall.has(id)) {
      const entry = perCall.get(id)!;
      entry.errored = true;
      entry.attempt += 1;
      setSlots((prev) => ({
        ...prev,
        [entry.key]: {
          ...prev[entry.key],
          state: "retrying",
          attempts: entry.attempt,
          detail: "503 · retry scheduled",
        },
      }));
    }
    return;
  }

  if (t === "tool-output-available") {
    if (id && perCall.has(id)) {
      const entry = perCall.get(id)!;
      const detail = summarizeOutput(entry.key, chunk.output);
      setSlots((prev) => ({
        ...prev,
        [entry.key]: {
          ...prev[entry.key],
          state: "ok",
          attempts: Math.max(prev[entry.key].attempts, entry.attempt),
          detail,
        },
      }));
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
  status: "idle" | "running" | "done" | "error";
}) {
  const cfg =
    status === "running"
      ? {
          label: "STREAMING",
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
  return (
    <div
      className={`relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl border bg-zinc-950 p-6 transition-colors ${cfg.border}`}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Tool call
        </span>
        <span
          className={`rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${cfg.pill} ${slot.state === "retrying" ? "animate-pulse" : ""}`}
        >
          {cfg.label}
        </span>
      </div>
      <div className="mt-4 font-mono text-2xl leading-tight text-white">
        {slot.label}
      </div>
      <div className="mt-1 font-mono text-sm text-zinc-500">{slot.sub}</div>

      <div className="mt-auto flex flex-col gap-2 pt-4">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Attempts
          </span>
          <div className="flex gap-1">
            {[1, 2].map((n) => (
              <span
                key={n}
                className={`h-2.5 w-2.5 rounded-full transition-colors ${
                  n <= slot.attempts
                    ? n === 2 && slot.key === "fetchCompetitorPrice"
                      ? "bg-sky-400"
                      : "bg-emerald-400"
                    : "bg-white/10"
                }`}
              />
            ))}
          </div>
        </div>
        <div className="min-h-[24px] font-mono text-sm text-zinc-300">
          {slot.detail}
        </div>
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
  retrying: {
    label: "RETRYING",
    pill: "border-sky-300/50 bg-sky-400/15 text-sky-200",
    border: "border-sky-300/60",
  },
  ok: {
    label: "OK",
    pill: "border-emerald-400/40 bg-emerald-500/10 text-emerald-300",
    border: "border-emerald-400/30",
  },
};

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
            Agent response streams here after tool calls resolve.
          </span>
        )}
      </div>
    </div>
  );
}
