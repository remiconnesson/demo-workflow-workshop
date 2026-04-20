"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type ToolState = "idle" | "running" | "waiting" | "done" | "undone" | "error";

type Phase = "forward" | "rollback";

type ToolCard = {
  key: string;
  name: string;
  label: string;
  description: string;
  phase: Phase;
  state: ToolState;
  detail: string | null;
};

const INITIAL_TOOLS: ToolCard[] = [
  {
    key: "sealRecallDossier",
    name: "sealRecallDossier",
    label: "Seal recall dossier",
    description:
      "Lock ch.1 finding, ch.2 draft + dispatch, and the 8-buyer roster for audit.",
    phase: "forward",
    state: "idle",
    detail: null,
  },
  {
    key: "flagRestaurantOnMarketplace",
    name: "flagRestaurantOnMarketplace",
    label: "Flag Bangkok Street",
    description:
      "Post public recall banner on the restaurant's marketplace listing.",
    phase: "forward",
    state: "idle",
    detail: null,
  },
  {
    key: "fileFdaRecallReport",
    name: "fileFdaRecallReport",
    label: "File FDA recall report",
    description:
      "Submit Class I recall F-1207-2026 to the FDA RES for batch PN-2041-C.",
    phase: "forward",
    state: "idle",
    detail: null,
  },
  {
    key: "removeMenuItemFromPlatform",
    name: "removeMenuItemFromPlatform",
    label: "Pull Shrimp Pad Thai from platform",
    description:
      "Remove sku-shrimp-pad-thai so no new orders can be placed.",
    phase: "forward",
    state: "idle",
    detail: null,
  },
  {
    key: "awaitLabReanalysis",
    name: "awaitLabReanalysis",
    label: "Suspend for lab re-analysis",
    description:
      "Contract lab re-runs the CoA on the retained sample of batch PN-2041-C.",
    phase: "forward",
    state: "idle",
    detail: null,
  },
  {
    key: "restoreMenuItem",
    name: "restoreMenuItem",
    label: "Restore Shrimp Pad Thai",
    description: "Compensation for step 4 — re-list the SKU.",
    phase: "rollback",
    state: "idle",
    detail: null,
  },
  {
    key: "withdrawFdaRecallReport",
    name: "withdrawFdaRecallReport",
    label: "Withdraw FDA recall report",
    description: "Compensation for step 3 — formal withdrawal to FDA RES.",
    phase: "rollback",
    state: "idle",
    detail: null,
  },
  {
    key: "unflagRestaurantOnMarketplace",
    name: "unflagRestaurantOnMarketplace",
    label: "Unflag Bangkok Street",
    description:
      "Compensation for step 2 — pull the recall banner, restore the listing.",
    phase: "rollback",
    state: "idle",
    detail: null,
  },
  {
    key: "unsealRecallDossier",
    name: "unsealRecallDossier",
    label: "Unseal dossier as false positive",
    description:
      "Compensation for step 1 — reclassify audit trail as retracted.",
    phase: "rollback",
    state: "idle",
    detail: null,
  },
  {
    key: "notifyBuyersRecallRetracted",
    name: "notifyBuyersRecallRetracted",
    label: "Apologize to 8 exposed buyers",
    description:
      "Email the ch.2 recipients: false alarm, your order was safe, we're sorry.",
    phase: "rollback",
    state: "idle",
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

type PendingTrigger = {
  token: string;
  findingId: string;
};

function forwardBorder(state: ToolState): string {
  switch (state) {
    case "running":
      return "border-sky-400/60 bg-sky-500/5";
    case "waiting":
      return "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/50";
    case "done":
      return "border-emerald-400/50 bg-emerald-500/5";
    case "undone":
      return "border-white/10 bg-zinc-950 opacity-40";
    case "error":
      return "border-red-500/50 bg-red-500/5";
    default:
      return "border-white/10 bg-zinc-950";
  }
}

function rollbackBorder(state: ToolState): string {
  switch (state) {
    case "running":
      return "border-fuchsia-400 bg-fuchsia-500/10 ring-2 ring-fuchsia-400/50";
    case "done":
      return "border-fuchsia-400/60 bg-fuchsia-500/5";
    case "error":
      return "border-red-500/50 bg-red-500/5";
    default:
      return "border-white/10 bg-zinc-950";
  }
}

function dotColor(tool: ToolCard): string {
  if (tool.phase === "rollback") {
    switch (tool.state) {
      case "running":
        return "bg-fuchsia-400 animate-pulse";
      case "done":
        return "bg-fuchsia-400";
      case "error":
        return "bg-red-500";
      default:
        return "bg-zinc-700";
    }
  }
  switch (tool.state) {
    case "running":
      return "bg-sky-400 animate-pulse";
    case "waiting":
      return "bg-amber-400 animate-ping";
    case "done":
      return "bg-emerald-400";
    case "undone":
      return "bg-zinc-600";
    case "error":
      return "bg-red-500";
    default:
      return "bg-zinc-700";
  }
}

function statePill(tool: ToolCard): string {
  if (tool.phase === "rollback") {
    switch (tool.state) {
      case "running":
        return "border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-200";
      case "done":
        return "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300";
      case "error":
        return "border-red-500/40 bg-red-500/10 text-red-300";
      default:
        return "border-white/10 bg-white/5 text-zinc-500";
    }
  }
  switch (tool.state) {
    case "running":
      return "border-sky-400/40 bg-sky-500/10 text-sky-300";
    case "waiting":
      return "border-amber-400 bg-amber-500/15 text-amber-200";
    case "done":
      return "border-emerald-400/40 bg-emerald-500/10 text-emerald-300";
    case "undone":
      return "border-white/10 bg-white/5 text-zinc-500";
    case "error":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    default:
      return "border-white/10 bg-white/5 text-zinc-500";
  }
}

function pillText(state: ToolState): string {
  switch (state) {
    case "running":
      return "RUNNING";
    case "waiting":
      return "WAITING";
    case "done":
      return "DONE";
    case "undone":
      return "UNDONE";
    case "error":
      return "ERROR";
    default:
      return "IDLE";
  }
}

// Forward step → the compensation card that "undoes" it.
const UNDONE_BY: Record<string, string> = {
  sealRecallDossier: "unsealRecallDossier",
  flagRestaurantOnMarketplace: "unflagRestaurantOnMarketplace",
  fileFdaRecallReport: "withdrawFdaRecallReport",
  removeMenuItemFromPlatform: "restoreMenuItem",
};

// The inverse: compensation tool → the forward step it just retired.
const RETIRES_FORWARD: Record<string, string> = Object.fromEntries(
  Object.entries(UNDONE_BY).map(([fwd, comp]) => [comp, fwd]),
);

export default function ComplianceRollbackPage() {
  const [tools, setTools] = useState<ToolCard[]>(INITIAL_TOOLS);
  const [status, setStatus] = useState<
    "idle" | "running" | "suspended" | "rolling-back" | "done" | "error"
  >("idle");
  const [finalText, setFinalText] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingTrigger | null>(null);
  const [decisionSent, setDecisionSent] = useState<
    null | "false-positive" | "confirmed"
  >(null);
  const callIdToName = useRef<Map<string, string>>(new Map());

  const updateTool = useCallback((name: string, patch: Partial<ToolCard>) => {
    setTools((prev) =>
      prev.map((t) => (t.name === name ? { ...t, ...patch } : t)),
    );
  }, []);

  const handleRun = useCallback(async () => {
    setTools(INITIAL_TOOLS.map((t) => ({ ...t })));
    setFinalText("");
    setPending(null);
    setDecisionSent(null);
    setStatus("running");
    callIdToName.current.clear();

    try {
      const res = await fetch("/api/experiments/compliance-rollback/start", {
        method: "POST",
      });
      if (!res.ok || !res.body) {
        throw new Error(`HTTP ${res.status}`);
      }
      setRunId(res.headers.get("x-workflow-run-id"));

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

          if (
            chunk.type === "tool-input-start" &&
            chunk.toolCallId &&
            chunk.toolName
          ) {
            callIdToName.current.set(chunk.toolCallId, chunk.toolName);
            const name = chunk.toolName;
            if (name === "awaitLabReanalysis") {
              updateTool(name, { state: "waiting", detail: null });
              setStatus("suspended");
            } else if (name in RETIRES_FORWARD) {
              updateTool(name, { state: "running", detail: null });
              setStatus("rolling-back");
            } else {
              updateTool(name, { state: "running", detail: null });
            }
          } else if (
            chunk.type === "tool-input-available" &&
            chunk.toolCallId &&
            chunk.toolName
          ) {
            callIdToName.current.set(chunk.toolCallId, chunk.toolName);
            const name = chunk.toolName;
            if (name === "awaitLabReanalysis") {
              const input = chunk.input as
                | { findingId?: string }
                | undefined;
              const findingId = input?.findingId ?? "find_ALG01";
              setPending({
                token: `compliance-rollback:${findingId}`,
                findingId,
              });
              updateTool(name, {
                state: "waiting",
                detail: `Awaiting lab · sample from batch PN-2041-C`,
              });
              setStatus("suspended");
            }
          } else if (
            chunk.type === "tool-output-available" &&
            chunk.toolCallId
          ) {
            const name = callIdToName.current.get(chunk.toolCallId);
            if (!name) continue;
            const out = chunk.output as Record<string, unknown> | undefined;
            let detail: string | null = null;
            if (name === "sealRecallDossier") {
              detail = `${String(out?.dossierId ?? "")} · ${
                Array.isArray(out?.artifacts)
                  ? (out?.artifacts as string[]).length
                  : 0
              } artifacts sealed`;
            } else if (name === "flagRestaurantOnMarketplace") {
              detail = `banner posted · public`;
            } else if (name === "fileFdaRecallReport") {
              detail = `${String(out?.submissionId ?? "")} · Class ${String(
                out?.class ?? "I",
              )}`;
            } else if (name === "removeMenuItemFromPlatform") {
              detail = `${String(out?.sku ?? "")} · ${String(
                out?.newState ?? "",
              )}`;
            } else if (name === "awaitLabReanalysis") {
              const fp = Boolean(out?.falsePositive);
              detail = fp
                ? `FALSE POSITIVE · ${String(out?.labNote ?? "")}`
                : `recall confirmed · ${String(out?.labNote ?? "")}`;
              setPending(null);
              if (fp) setStatus("rolling-back");
            } else if (name === "restoreMenuItem") {
              detail = `${String(out?.sku ?? "")} · re-listed`;
            } else if (name === "withdrawFdaRecallReport") {
              detail = `${String(out?.withdrawalId ?? "")} · withdrawn`;
            } else if (name === "unflagRestaurantOnMarketplace") {
              detail = `banner removed · listing clear`;
            } else if (name === "unsealRecallDossier") {
              detail = `${String(out?.dossierId ?? "")} · archived as false-positive`;
            } else if (name === "notifyBuyersRecallRetracted") {
              detail = `${String(out?.dispatchId ?? "")} · ${String(
                out?.exposedCount ?? 0,
              )} buyers re-contacted`;
            }
            updateTool(name, { state: "done", detail });

            // When a compensation finishes, dim its forward counterpart.
            const retires = RETIRES_FORWARD[name];
            if (retires) {
              updateTool(retires, { state: "undone" });
            }
          } else if (
            chunk.type === "text-delta" &&
            typeof chunk.text === "string"
          ) {
            assistantText += chunk.text;
            setFinalText(assistantText);
          }
        }
      }
      setStatus((prev) => (prev === "error" ? "error" : "done"));
    } catch (err) {
      console.error("[compliance-rollback] run failed", err);
      setStatus("error");
    }
  }, [updateTool]);

  const handleTrigger = useCallback(
    async (falsePositive: boolean) => {
      if (!pending) return;
      setDecisionSent(falsePositive ? "false-positive" : "confirmed");
      try {
        await fetch("/api/experiments/compliance-rollback/trigger", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: pending.token,
            falsePositive,
            labNote: falsePositive
              ? "Retained sample LC-MS/MS re-assay: undeclared milk <1 ppm — original hit traced to lab prep cross-contamination."
              : "Re-assay confirms undeclared milk protein; recall stands.",
          }),
        });
      } catch (err) {
        console.error("[compliance-rollback] trigger failed", err);
      }
    },
    [pending],
  );

  const statusPill = useMemo(() => {
    switch (status) {
      case "done":
        return "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300";
      case "running":
        return "border-sky-400/40 bg-sky-500/10 text-sky-300 animate-pulse";
      case "suspended":
        return "border-amber-400 bg-amber-500/15 text-amber-200 animate-pulse";
      case "rolling-back":
        return "border-fuchsia-400 bg-fuchsia-500/15 text-fuchsia-200 animate-pulse";
      case "error":
        return "border-red-500/40 bg-red-500/10 text-red-300";
      default:
        return "border-white/10 bg-white/5 text-zinc-400";
    }
  }, [status]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "done":
        return "RECALL RETRACTED";
      case "running":
        return "RECALLING";
      case "suspended":
        return "SUSPENDED · LAB RE-ASSAY";
      case "rolling-back":
        return "ROLLING BACK";
      case "error":
        return "ERROR";
      default:
        return "READY";
    }
  }, [status]);

  const forwardTools = tools.filter((t) => t.phase === "forward");
  const rollbackTools = tools.filter((t) => t.phase === "rollback");

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-white/10 px-12 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Compliance · Rollback · Chapter 3
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Lab clears the batch — agent unwinds the recall
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            Finding{" "}
            <span className="font-mono text-zinc-200">find_ALG01</span> went
            public: dossier sealed, FDA recall{" "}
            <span className="font-mono text-zinc-200">F-1207-2026</span> filed,{" "}
            <span className="font-mono text-zinc-200">sku-shrimp-pad-thai</span>{" "}
            pulled. Then a lab re-assay returns{" "}
            <span className="font-mono text-fuchsia-300">false positive</span>.
            The agent unwinds every action in reverse and apologizes to all 8
            exposed buyers.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div
            className={`rounded-full border px-5 py-2 font-mono text-xs font-semibold tracking-[0.2em] transition-colors ${statusPill}`}
          >
            {statusLabel}
          </div>
          <button
            type="button"
            onClick={handleRun}
            disabled={
              status === "running" ||
              status === "suspended" ||
              status === "rolling-back"
            }
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition disabled:opacity-40"
          >
            {status === "running" ||
            status === "suspended" ||
            status === "rolling-back"
              ? "Running…"
              : "Run recall"}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-8 overflow-hidden px-12 py-8">
        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Forward · public recall
          </p>
          <div className="flex flex-col gap-2">
            {forwardTools.map((tool) => (
              <div
                key={tool.key}
                className={`rounded-2xl border p-4 transition-colors duration-300 ${forwardBorder(tool.state)}`}
                style={{ minHeight: 92 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-2 h-3 w-3 shrink-0 rounded-full ${dotColor(tool)}`}
                    />
                    <div>
                      <p className="font-mono text-sm text-zinc-200">
                        {tool.name}
                      </p>
                      <p className="mt-0.5 text-base font-semibold tracking-tight">
                        {tool.label}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] ${statePill(tool)}`}
                  >
                    {pillText(tool.state)}
                  </span>
                </div>
                <div
                  className="mt-1 overflow-hidden pl-6 font-mono text-xs leading-snug transition-opacity duration-300"
                  style={{
                    minHeight: 18,
                    opacity: tool.detail ? 1 : 0,
                  }}
                >
                  <span
                    className={
                      tool.state === "waiting"
                        ? "text-amber-200"
                        : tool.state === "undone"
                          ? "text-zinc-600 line-through"
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

        <section className="flex min-h-0 flex-1 flex-col gap-3">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-400">
            Rollback · reverse unwind
          </p>
          <div className="flex flex-col gap-2">
            {rollbackTools.map((tool) => (
              <div
                key={tool.key}
                className={`rounded-2xl border p-4 transition-colors duration-300 ${rollbackBorder(tool.state)}`}
                style={{ minHeight: 92 }}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-2 h-3 w-3 shrink-0 rounded-full ${dotColor(tool)}`}
                    />
                    <div>
                      <p className="font-mono text-sm text-zinc-200">
                        {tool.name}
                      </p>
                      <p className="mt-0.5 text-base font-semibold tracking-tight">
                        {tool.label}
                      </p>
                      <p className="mt-0.5 text-xs text-zinc-500">
                        {tool.description}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-semibold tracking-[0.18em] ${statePill(tool)}`}
                  >
                    {pillText(tool.state)}
                  </span>
                </div>
                <div
                  className="mt-1 overflow-hidden pl-6 font-mono text-xs leading-snug transition-opacity duration-300"
                  style={{
                    minHeight: 18,
                    opacity: tool.detail ? 1 : 0,
                  }}
                >
                  <span
                    className={
                      tool.state === "running" || tool.state === "done"
                        ? "text-fuchsia-200"
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

        <aside className="flex w-[420px] shrink-0 flex-col gap-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Lab re-analysis
          </p>
          <div
            className={`rounded-2xl border p-5 transition-colors duration-300 ${
              pending
                ? "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40"
                : "border-white/10 bg-zinc-950"
            }`}
            style={{ minHeight: 240 }}
          >
            <div
              className={`transition-opacity duration-300 ${pending ? "opacity-100" : "opacity-40"}`}
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                {pending ? "Retained sample re-assay" : "Idle"}
              </p>
              <p className="mt-3 text-lg font-semibold leading-snug text-zinc-100">
                Contract lab is re-running the CoA on batch PN-2041-C.
              </p>
              <p className="mt-2 font-mono text-xs text-zinc-400">
                Trigger the lab result to resume the suspended workflow.
              </p>
              <div className="mt-5 flex flex-col gap-2">
                <button
                  type="button"
                  disabled={!pending || decisionSent !== null}
                  onClick={() => handleTrigger(true)}
                  className="rounded-xl border border-fuchsia-500/40 bg-fuchsia-500/10 px-4 py-3 font-semibold text-fuchsia-200 transition disabled:opacity-30"
                >
                  {decisionSent === "false-positive"
                    ? "Triggered rollback"
                    : "Trigger: lab clears batch"}
                </button>
                <button
                  type="button"
                  disabled={!pending || decisionSent !== null}
                  onClick={() => handleTrigger(false)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 font-semibold text-zinc-300 transition disabled:opacity-30"
                >
                  {decisionSent === "confirmed"
                    ? "Recall confirmed"
                    : "Trigger: lab confirms recall"}
                </button>
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Agent reply
          </p>
          <div
            className="flex-1 rounded-2xl border border-white/10 bg-zinc-950 p-5"
            style={{ minHeight: 140 }}
          >
            <div
              className={`text-lg leading-relaxed text-zinc-100 transition-opacity duration-300 ${
                finalText ? "opacity-100" : "opacity-40"
              }`}
            >
              {finalText || "Awaiting the recall finale…"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Run id
            </p>
            <p className="mt-2 break-all font-mono text-xs text-zinc-300">
              {runId ?? "—"}
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}
