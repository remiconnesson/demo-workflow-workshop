"use client";

import { useCallback, useRef, useState } from "react";

type ToolState = "idle" | "running" | "retrying" | "done" | "error";

type ToolCard = {
  key: string;
  name: string;
  label: string;
  description: string;
  state: ToolState;
  attempt: number;
  detail: string | null;
};

const INITIAL_TOOLS: ToolCard[] = [
  {
    key: "fetchMenuItem",
    name: "fetchMenuItem",
    label: "Fetch menu item",
    description: "Pull declared allergens and ingredient list for sku-shrimp-pad-thai.",
    state: "idle",
    attempt: 0,
    detail: null,
  },
  {
    key: "checkFdaRecallFeed",
    name: "checkFdaRecallFeed",
    label: "Check FDA recall feed",
    description: "Cross-reference ingredient batch against FDA RES. Known to flake.",
    state: "idle",
    attempt: 0,
    detail: null,
  },
  {
    key: "fileComplianceFinding",
    name: "fileComplianceFinding",
    label: "File compliance finding",
    description: "Durably record an undeclared-allergen violation.",
    state: "idle",
    attempt: 0,
    detail: null,
  },
];

type StreamChunk = {
  type?: string;
  toolCallId?: string;
  toolName?: string;
  input?: unknown;
  output?: unknown;
  errorText?: string;
  text?: string;
};

function stateBorder(state: ToolState): string {
  switch (state) {
    case "running":
      return "border-sky-400/60 bg-sky-500/5";
    case "retrying":
      return "border-sky-400 bg-sky-500/10 ring-2 ring-sky-400/50";
    case "done":
      return "border-emerald-400/50 bg-emerald-500/5";
    case "error":
      return "border-red-500/50 bg-red-500/5";
    default:
      return "border-white/10 bg-zinc-950";
  }
}

function stateDot(state: ToolState): string {
  switch (state) {
    case "running":
      return "bg-sky-400 animate-pulse";
    case "retrying":
      return "bg-sky-400 animate-ping";
    case "done":
      return "bg-emerald-400";
    case "error":
      return "bg-red-500";
    default:
      return "bg-zinc-700";
  }
}

function stateLabel(state: ToolState, attempt: number): string {
  switch (state) {
    case "running":
      return attempt > 1 ? `ATTEMPT ${attempt}` : "RUNNING";
    case "retrying":
      return `RETRY · ATTEMPT ${attempt}`;
    case "done":
      return attempt > 1 ? `DONE · RETRIED ${attempt - 1}×` : "DONE";
    case "error":
      return "ERROR";
    default:
      return "IDLE";
  }
}

export default function ComplianceRetryPage() {
  const [tools, setTools] = useState<ToolCard[]>(INITIAL_TOOLS);
  const [status, setStatus] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [finalText, setFinalText] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);
  const callIdToName = useRef<Map<string, string>>(new Map());

  const updateTool = useCallback(
    (name: string, patch: Partial<ToolCard>) => {
      setTools((prev) =>
        prev.map((t) => (t.name === name ? { ...t, ...patch } : t)),
      );
    },
    [],
  );

  const handleRun = useCallback(async () => {
    setTools(INITIAL_TOOLS.map((t) => ({ ...t })));
    setFinalText("");
    setStatus("running");
    callIdToName.current.clear();

    try {
      const res = await fetch("/api/experiments/compliance-retry/start", {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      setRunId(res.headers.get("X-Run-Id"));

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          let chunk: StreamChunk;
          try {
            chunk = JSON.parse(line);
          } catch {
            continue;
          }

          // Track tool lifecycle events from the AI SDK UIMessageChunk stream.
          if (chunk.type === "tool-input-start" && chunk.toolCallId && chunk.toolName) {
            callIdToName.current.set(chunk.toolCallId, chunk.toolName);
            updateTool(chunk.toolName, {
              state: "running",
              attempt: 1,
              detail: null,
            });
          } else if (
            chunk.type === "tool-input-available" &&
            chunk.toolCallId &&
            chunk.toolName
          ) {
            callIdToName.current.set(chunk.toolCallId, chunk.toolName);
            updateTool(chunk.toolName, { state: "running", attempt: 1 });
          } else if (
            chunk.type === "tool-output-error" &&
            chunk.toolCallId
          ) {
            const name = callIdToName.current.get(chunk.toolCallId);
            if (name) {
              const errMsg = chunk.errorText ?? "Retryable error";
              // RetryableError shows up as an error followed by another
              // tool-input-start for the same logical tool — flag retry state
              // so the UI visibly transitions to a retry accent.
              const isRetryable =
                errMsg.toLowerCase().includes("retry") ||
                errMsg.toLowerCase().includes("503") ||
                errMsg.toLowerCase().includes("gateway");
              updateTool(name, {
                state: isRetryable ? "retrying" : "error",
                attempt: 2,
                detail: errMsg,
              });
            }
          } else if (
            chunk.type === "tool-output-available" &&
            chunk.toolCallId
          ) {
            const name = callIdToName.current.get(chunk.toolCallId);
            if (name) {
              const out = chunk.output as
                | Record<string, unknown>
                | undefined;
              const attempt =
                typeof out?.attempt === "number" ? (out.attempt as number) : 1;
              let detail: string | null = null;
              if (name === "fetchMenuItem" && out?.found) {
                detail = `${String(out.name ?? "")} · ${
                  Array.isArray(out.declaredAllergens)
                    ? (out.declaredAllergens as string[]).join(", ")
                    : ""
                }`;
              } else if (name === "checkFdaRecallFeed") {
                if (out?.recalled) {
                  detail = `Class ${String(out.class ?? "?")} · ${String(
                    out.recallId ?? "",
                  )} · undeclared ${String(out.undeclaredAllergen ?? "")}`;
                } else {
                  detail = "no active recall";
                }
              } else if (name === "fileComplianceFinding") {
                detail = `${String(out?.findingId ?? "")} · ${String(
                  out?.violationCode ?? "",
                )} · ${String(out?.severity ?? "")}`;
              }
              updateTool(name, { state: "done", attempt, detail });
            }
          } else if (chunk.type === "text-delta" && typeof chunk.text === "string") {
            assistantText += chunk.text;
            setFinalText(assistantText);
          }
        }
      }
      setStatus("done");
    } catch (err) {
      console.error("[compliance-retry] run failed", err);
      setStatus("error");
    }
  }, [updateTool]);

  const statusPill =
    status === "done"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
      : status === "running"
        ? "border-sky-400/40 bg-sky-500/10 text-sky-300 animate-pulse"
        : status === "error"
          ? "border-red-500/40 bg-red-500/10 text-red-300"
          : "border-white/10 bg-white/5 text-zinc-400";
  const statusLabel =
    status === "done"
      ? "AUDIT COMPLETE"
      : status === "running"
        ? "AUDITING"
        : status === "error"
          ? "ERROR"
          : "READY";

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-white/10 px-12 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Compliance · Retry
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            FDA recall cross-check survives a flaky feed
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            The agent audits{" "}
            <span className="font-mono text-zinc-200">sku-shrimp-pad-thai</span>{" "}
            and pings the FDA RES feed. First call 503s. Runtime replays the
            same <span className="font-mono text-sky-300">stepId</span>. Agent
            never sees the failure.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`rounded-full border px-5 py-2 font-mono text-xs font-semibold tracking-[0.2em] ${statusPill}`}
          >
            {statusLabel}
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={status === "running"}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition disabled:opacity-40"
          >
            {status === "running" ? "Running…" : "Run audit"}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-8 overflow-hidden px-12 py-10">
        <section className="flex min-h-0 flex-1 flex-col gap-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Agent tools
          </p>
          <div className="flex flex-col gap-4">
            {tools.map((tool) => (
              <div
                key={tool.key}
                className={`rounded-2xl border p-6 transition-colors duration-300 ${stateBorder(tool.state)}`}
                style={{ minHeight: 136 }}
              >
                <div className="flex items-start justify-between gap-6">
                  <div className="flex items-start gap-4">
                    <span
                      className={`mt-2 h-3 w-3 shrink-0 rounded-full ${stateDot(tool.state)}`}
                    />
                    <div>
                      <p className="font-mono text-base text-zinc-200">
                        {tool.name}
                      </p>
                      <p className="mt-1 text-lg font-semibold tracking-tight">
                        {tool.label}
                      </p>
                      <p className="mt-1 text-sm text-zinc-500">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${
                      tool.state === "retrying"
                        ? "border-sky-400 bg-sky-500/15 text-sky-200"
                        : tool.state === "done"
                          ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
                          : tool.state === "running"
                            ? "border-sky-400/40 bg-sky-500/10 text-sky-300"
                            : tool.state === "error"
                              ? "border-red-500/40 bg-red-500/10 text-red-300"
                              : "border-white/10 bg-white/5 text-zinc-500"
                    }`}
                  >
                    {stateLabel(tool.state, tool.attempt)}
                  </span>
                </div>
                <div
                  className={`mt-4 overflow-hidden font-mono text-sm leading-snug transition-opacity duration-300 ${
                    tool.detail ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ minHeight: 22 }}
                >
                  <span
                    className={
                      tool.state === "retrying"
                        ? "text-sky-300"
                        : tool.state === "error"
                          ? "text-red-300"
                          : "text-zinc-400"
                    }
                  >
                    {tool.detail ?? " "}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="flex w-[460px] shrink-0 flex-col gap-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Agent reply
          </p>
          <div
            className="flex-1 rounded-2xl border border-white/10 bg-zinc-950 p-6"
            style={{ minHeight: 280 }}
          >
            <div
              className={`text-xl leading-relaxed text-zinc-100 transition-opacity duration-300 ${
                finalText ? "opacity-100" : "opacity-40"
              }`}
            >
              {finalText || "Awaiting audit…"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Run id
            </p>
            <p className="mt-2 break-all font-mono text-sm text-zinc-300">
              {runId ?? "—"}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
