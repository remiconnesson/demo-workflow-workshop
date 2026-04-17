"use client";

import { useCallback, useMemo, useRef, useState } from "react";

type ToolState = "idle" | "running" | "waiting" | "done" | "error";

type ToolCard = {
  key: string;
  name: string;
  label: string;
  description: string;
  state: ToolState;
  detail: string | null;
};

const INITIAL_TOOLS: ToolCard[] = [
  {
    key: "getExposedBuyers",
    name: "getExposedBuyers",
    label: "Pull exposure roster",
    description:
      "List every customer who ordered sku-shrimp-pad-thai since batch PN-2041-C started shipping.",
    state: "idle",
    detail: null,
  },
  {
    key: "draftCustomerNotice",
    name: "draftCustomerNotice",
    label: "Draft recall notification",
    description:
      "Compose the FDA-compliant customer email citing recall F-1207-2026 and undeclared milk.",
    state: "idle",
    detail: null,
  },
  {
    key: "requestLegalApproval",
    name: "requestLegalApproval",
    label: "Suspend for Legal + PR sign-off",
    description:
      "Regulated health notices cannot auto-send. Workflow suspends on a durable hook.",
    state: "idle",
    detail: null,
  },
  {
    key: "dispatchCustomerNotice",
    name: "dispatchCustomerNotice",
    label: "Dispatch notification",
    description:
      "Send the approved email to every exposed buyer via the transactional provider.",
    state: "idle",
    detail: null,
  },
  {
    key: "recordHoldOnNotice",
    name: "recordHoldOnNotice",
    label: "Park on hold (if rejected)",
    description:
      "Record Legal's rejection reason and stand down pending revision.",
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

type PendingApproval = {
  token: string;
  subject: string;
  recipients: number;
  draftId: string;
};

function stateBorder(state: ToolState): string {
  switch (state) {
    case "running":
      return "border-sky-400/60 bg-sky-500/5";
    case "waiting":
      return "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/50";
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
    case "waiting":
      return "bg-amber-400 animate-ping";
    case "done":
      return "bg-emerald-400";
    case "error":
      return "bg-red-500";
    default:
      return "bg-zinc-700";
  }
}

function statePill(state: ToolState): string {
  switch (state) {
    case "waiting":
      return "border-amber-400 bg-amber-500/15 text-amber-200";
    case "done":
      return "border-emerald-400/40 bg-emerald-500/10 text-emerald-300";
    case "running":
      return "border-sky-400/40 bg-sky-500/10 text-sky-300";
    case "error":
      return "border-red-500/40 bg-red-500/10 text-red-300";
    default:
      return "border-white/10 bg-white/5 text-zinc-500";
  }
}

function stateLabel(state: ToolState): string {
  switch (state) {
    case "running":
      return "RUNNING";
    case "waiting":
      return "WAITING";
    case "done":
      return "DONE";
    case "error":
      return "ERROR";
    default:
      return "IDLE";
  }
}

export default function ComplianceSuspendPage() {
  const [tools, setTools] = useState<ToolCard[]>(INITIAL_TOOLS);
  const [status, setStatus] = useState<
    "idle" | "running" | "suspended" | "done" | "error"
  >("idle");
  const [finalText, setFinalText] = useState<string>("");
  const [runId, setRunId] = useState<string | null>(null);
  const [pending, setPending] = useState<PendingApproval | null>(null);
  const [decisionSent, setDecisionSent] = useState<
    null | "approved" | "rejected"
  >(null);
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
    setPending(null);
    setDecisionSent(null);
    setStatus("running");
    callIdToName.current.clear();

    try {
      const res = await fetch("/api/experiments/compliance-suspend/start", {
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

          if (
            chunk.type === "tool-input-start" &&
            chunk.toolCallId &&
            chunk.toolName
          ) {
            callIdToName.current.set(chunk.toolCallId, chunk.toolName);
            if (chunk.toolName === "requestLegalApproval") {
              // The workflow is about to suspend. Flip UI immediately so
              // the audience sees amber WAITING before the input even lands.
              updateTool(chunk.toolName, { state: "waiting", detail: null });
              setStatus("suspended");
            } else {
              updateTool(chunk.toolName, { state: "running", detail: null });
            }
          } else if (
            chunk.type === "tool-input-available" &&
            chunk.toolCallId &&
            chunk.toolName
          ) {
            callIdToName.current.set(chunk.toolCallId, chunk.toolName);
            if (chunk.toolName === "requestLegalApproval") {
              const input = chunk.input as
                | {
                    findingId?: string;
                    draftId?: string;
                    recipients?: number;
                    subject?: string;
                  }
                | undefined;
              const findingId = input?.findingId ?? "find_ALG01";
              setPending({
                token: `compliance-suspend:${findingId}`,
                subject: input?.subject ?? "Recall notification",
                recipients: input?.recipients ?? 0,
                draftId: input?.draftId ?? "",
              });
              updateTool(chunk.toolName, {
                state: "waiting",
                detail: `Awaiting Legal + PR · ${input?.recipients ?? 0} recipients`,
              });
              setStatus("suspended");
            } else {
              updateTool(chunk.toolName, { state: "running" });
            }
          } else if (
            chunk.type === "tool-output-available" &&
            chunk.toolCallId
          ) {
            const name = callIdToName.current.get(chunk.toolCallId);
            if (!name) continue;
            const out = chunk.output as Record<string, unknown> | undefined;
            let detail: string | null = null;
            if (name === "getExposedBuyers") {
              detail = `${String(out?.count ?? 0)} exposed buyers since ${String(
                out?.sinceIso ?? "",
              ).slice(0, 10)}`;
            } else if (name === "draftCustomerNotice") {
              detail = `${String(out?.draftId ?? "")} · ${String(
                out?.recipients ?? 0,
              )} recipients · channel ${String(out?.channel ?? "")}`;
            } else if (name === "requestLegalApproval") {
              const approved = Boolean(out?.approved);
              detail = approved
                ? `approved · ${String(out?.reason ?? "cleared for dispatch")}`
                : `rejected · ${String(out?.reason ?? "held for revision")}`;
              // Clear the pending card once the hook resolves.
              setPending(null);
              setStatus(approved ? "running" : "running");
            } else if (name === "dispatchCustomerNotice") {
              detail = `${String(out?.dispatchId ?? "")} · sent to ${String(
                out?.recipients ?? 0,
              )} · ${String(out?.provider ?? "")}`;
            } else if (name === "recordHoldOnNotice") {
              detail = `${String(out?.heldId ?? "")} · ${String(
                out?.status ?? "held",
              )}`;
            }
            updateTool(name, { state: "done", detail });
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
      console.error("[compliance-suspend] run failed", err);
      setStatus("error");
    }
  }, [updateTool]);

  const handleDecision = useCallback(
    async (approved: boolean) => {
      if (!pending) return;
      setDecisionSent(approved ? "approved" : "rejected");
      try {
        await fetch("/api/experiments/compliance-suspend/approve", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: pending.token,
            approved,
            reason: approved
              ? "Legal + PR approved wording; dispatch authorized."
              : "Wording flagged by Legal; revise tone before resubmission.",
          }),
        });
      } catch (err) {
        console.error("[compliance-suspend] approve failed", err);
      }
    },
    [pending],
  );

  const statusPill = useMemo(() => {
    switch (status) {
      case "done":
        return "border-emerald-400/40 bg-emerald-500/10 text-emerald-300";
      case "running":
        return "border-sky-400/40 bg-sky-500/10 text-sky-300 animate-pulse";
      case "suspended":
        return "border-amber-400 bg-amber-500/15 text-amber-200 animate-pulse";
      case "error":
        return "border-red-500/40 bg-red-500/10 text-red-300";
      default:
        return "border-white/10 bg-white/5 text-zinc-400";
    }
  }, [status]);

  const statusLabel = useMemo(() => {
    switch (status) {
      case "done":
        return "RESPONSE COMPLETE";
      case "running":
        return "RESPONDING";
      case "suspended":
        return "SUSPENDED · AWAITING LEGAL";
      case "error":
        return "ERROR";
      default:
        return "READY";
    }
  }, [status]);

  return (
    <div className="flex h-full w-full flex-col overflow-hidden">
      <header className="flex items-center justify-between border-b border-white/10 px-12 py-8">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Compliance · Suspend · Chapter 2
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight">
            Recall notification pauses for Legal + PR
          </h1>
          <p className="mt-3 max-w-3xl text-lg text-zinc-400">
            Finding{" "}
            <span className="font-mono text-zinc-200">find_ALG01</span> just
            closed. The agent drafts the customer notification for{" "}
            <span className="font-mono text-zinc-200">
              sku-shrimp-pad-thai
            </span>{" "}
            exposure, then{" "}
            <span className="font-mono text-amber-300">suspends</span> on a
            durable hook until a human approves the wording.
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
            disabled={status === "running" || status === "suspended"}
            className="rounded-xl bg-white px-6 py-3 font-semibold text-black transition disabled:opacity-40"
          >
            {status === "running" || status === "suspended"
              ? "Running…"
              : "Run response"}
          </button>
        </div>
      </header>

      <main className="flex min-h-0 flex-1 gap-8 overflow-hidden px-12 py-10">
        <section className="flex min-h-0 flex-1 flex-col gap-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Agent tools
          </p>
          <div className="flex flex-col gap-3">
            {tools.map((tool) => (
              <div
                key={tool.key}
                className={`rounded-2xl border p-5 transition-colors duration-300 ${stateBorder(tool.state)}`}
                style={{ minHeight: 116 }}
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
                    className={`shrink-0 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold tracking-[0.18em] ${statePill(tool.state)}`}
                  >
                    {stateLabel(tool.state)}
                  </span>
                </div>
                <div
                  className={`mt-3 overflow-hidden font-mono text-sm leading-snug transition-opacity duration-300 ${
                    tool.detail ? "opacity-100" : "opacity-0"
                  }`}
                  style={{ minHeight: 22 }}
                >
                  <span
                    className={
                      tool.state === "waiting"
                        ? "text-amber-200"
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

        <aside className="flex w-[480px] shrink-0 flex-col gap-5">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Legal + PR approval
          </p>
          <div
            className={`rounded-2xl border p-6 transition-colors duration-300 ${
              pending
                ? "border-amber-400 bg-amber-500/10 ring-2 ring-amber-400/40"
                : "border-white/10 bg-zinc-950"
            }`}
            style={{ minHeight: 280 }}
          >
            <div
              className={`transition-opacity duration-300 ${pending ? "opacity-100" : "opacity-40"}`}
            >
              <p className="font-mono text-xs font-semibold uppercase tracking-[0.2em] text-amber-300">
                {pending ? "Awaiting decision" : "Idle"}
              </p>
              <p className="mt-3 text-xl font-semibold leading-snug text-zinc-100">
                {pending?.subject ?? "No draft pending review."}
              </p>
              <p className="mt-3 font-mono text-sm text-zinc-400">
                {pending
                  ? `${pending.recipients} recipients · draft ${pending.draftId}`
                  : "Run the response to generate a draft."}
              </p>
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={!pending || decisionSent !== null}
                  onClick={() => handleDecision(true)}
                  className="flex-1 rounded-xl bg-white px-4 py-3 font-semibold text-black transition disabled:opacity-30"
                >
                  {decisionSent === "approved" ? "Approved" : "Approve & send"}
                </button>
                <button
                  type="button"
                  disabled={!pending || decisionSent !== null}
                  onClick={() => handleDecision(false)}
                  className="flex-1 rounded-xl border border-red-500/40 px-4 py-3 font-semibold text-red-300 transition disabled:opacity-30"
                >
                  {decisionSent === "rejected" ? "Rejected" : "Reject"}
                </button>
              </div>
            </div>
          </div>

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Agent reply
          </p>
          <div
            className="flex-1 rounded-2xl border border-white/10 bg-zinc-950 p-6"
            style={{ minHeight: 160 }}
          >
            <div
              className={`text-xl leading-relaxed text-zinc-100 transition-opacity duration-300 ${
                finalText ? "opacity-100" : "opacity-40"
              }`}
            >
              {finalText || "Awaiting response…"}
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-zinc-950 p-5">
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
