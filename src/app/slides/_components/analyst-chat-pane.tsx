"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { MenuItem } from "@/lib/ops-data";
import {
  clearOperatorEvents,
  getOperatorEvents,
  registerResetDispatcher,
  registerRollbackDispatcher,
  registerSendDispatcher,
  setAppliedProposals,
  setIsStreaming as publishIsStreaming,
  setPendingPrompt,
  subscribeOperatorEvents,
  type AppliedProposal,
  type OperatorEvent,
} from "./analyst-approval-bus";
import { AnalystMarkdown } from "./analyst-markdown";

type ToolCallState = {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  status: "running" | "done" | "error";
  summary: string;
  startedAt: number;
};

type AssistantMessage = {
  id: string;
  role: "assistant";
  text: string;
  toolCalls: ToolCallState[];
};

type UserMessage = {
  id: string;
  role: "user";
  text: string;
};

type ChatItem = UserMessage | AssistantMessage;

type WireChunk =
  | { type: "text-start"; id: string }
  | { type: "text-delta"; id: string; delta: string }
  | { type: "text-end"; id: string }
  | { type: "tool-input-start"; toolCallId: string; toolName: string }
  | { type: "tool-input-available"; toolCallId: string; toolName: string; input: unknown }
  | { type: "tool-output-available"; toolCallId: string; output: unknown }
  | { type: "tool-output-error"; toolCallId: string; errorText: string }
  | { type: "start" | "finish" | "start-step" | "finish-step" | "abort" }
  | { type: string; [k: string]: unknown };

type FlatToolCall = ToolCallState & { assistantId: string; order: number };

type HistoryRow =
  | { kind: "tool"; at: number; order: number; tool: FlatToolCall }
  | { kind: "operator"; at: number; order: number; event: OperatorEvent };

type ProposalCacheEntry = {
  proposalId: string;
  sku: string;
  itemName: string;
  current: MenuItem | null;
  patch: Partial<MenuItem>;
  rationale: string;
};

function summarizeToolInput(name: string, input: unknown): string {
  if (!input || typeof input !== "object") return `${name}()`;
  const obj = input as Record<string, unknown>;
  const keys = Object.keys(obj);
  if (keys.length === 0) return `${name}()`;
  const first = keys[0];
  const v = obj[first];
  const rendered =
    typeof v === "string"
      ? `"${v}"`
      : typeof v === "number" || typeof v === "boolean"
        ? String(v)
        : Array.isArray(v)
          ? `[${v.length}]`
          : "{…}";
  const extra = keys.length > 1 ? `, …` : "";
  return `${name}(${first}: ${rendered}${extra})`;
}

function summarizeToolOutput(name: string, output: unknown): string {
  if (output === undefined || output === null) return "ok";
  if (Array.isArray(output)) return `${output.length} row${output.length === 1 ? "" : "s"}`;
  if (typeof output === "object") {
    const obj = output as Record<string, unknown>;
    if ("proposal" in obj && obj.proposal && typeof obj.proposal === "object") {
      const p = obj.proposal as Record<string, unknown>;
      if (typeof p.id === "string") return `proposal ${p.id.slice(0, 10)}…`;
    }
    if ("id" in obj && typeof obj.id === "string") return `id: ${obj.id}`;
    if ("proposalId" in obj && typeof obj.proposalId === "string")
      return `proposal ${String(obj.proposalId).slice(0, 10)}…`;
    if ("applied" in obj) return obj.applied ? "applied" : `skipped · ${obj.error ?? "?"}`;
    if ("rolledBack" in obj) return obj.rolledBack ? "rolled back" : "no history";
    if ("approved" in obj) return obj.approved ? "approved" : "rejected";
    const k = Object.keys(obj);
    if (k.length > 0) return k.slice(0, 2).join(" · ");
  }
  return String(output);
}

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

const STORAGE_KEY = "analyst-chat:v2";

type Persisted = {
  items: ChatItem[];
  activeRunId: string | null;
  activeAssistantId: string | null;
  appliedProposals: AppliedProposal[];
};

function loadPersisted(): Persisted | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Persisted;
  } catch {
    return null;
  }
}

function savePersisted(p: Persisted) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
  } catch {
    // ignore quota errors
  }
}

export type AnalystDebugEvent = { kind: string; msg: string };

export function AnalystChatPane({
  onRunIdChange,
  onEventsChange,
}: {
  onRunIdChange?: (runId: string | null) => void;
  onEventsChange?: (events: AnalystDebugEvent[]) => void;
} = {}) {
  const [items, setItems] = useState<ChatItem[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState<null | {
    summary: string;
  }>(null);
  const [applied, setApplied] = useState<AppliedProposal[]>([]);
  const [operatorEvents, setOperatorEventsState] = useState<OperatorEvent[]>(
    () => getOperatorEvents(),
  );
  const [hydrated, setHydrated] = useState(false);
  const activeRunIdRef = useRef<string | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const conversationScrollRef = useRef<HTMLDivElement>(null);
  const toolHistoryScrollRef = useRef<HTMLDivElement>(null);
  const proposalCacheRef = useRef<Map<string, ProposalCacheEntry>>(new Map());

  const messagesForApi = useMemo(() => {
    return items
      .filter((i): i is ChatItem => i.role === "user" || i.role === "assistant")
      .map((i) => ({
        role: i.role,
        content: i.role === "user" ? i.text : i.text,
      }));
  }, [items]);

  // Flat, chronological list of every tool call across every assistant turn.
  const flatToolCalls = useMemo<FlatToolCall[]>(() => {
    const out: FlatToolCall[] = [];
    let order = 0;
    for (const item of items) {
      if (item.role !== "assistant") continue;
      for (const t of item.toolCalls) {
        out.push({ ...t, assistantId: item.id, order: order++ });
      }
    }
    return out;
  }, [items]);

  // Merge tool calls + operator events into one chronological history. Tool
  // calls carry `startedAt`; operator events carry `at`. Stable ordering is
  // preserved by using the flat order index as a tiebreaker.
  const historyRows = useMemo<HistoryRow[]>(() => {
    const toolRows: HistoryRow[] = flatToolCalls.map((t) => ({
      kind: "tool",
      at: t.startedAt,
      order: t.order,
      tool: t,
    }));
    const opRows: HistoryRow[] = operatorEvents.map((event, i) => ({
      kind: "operator",
      at: event.at,
      order: flatToolCalls.length + i,
      event,
    }));
    return [...toolRows, ...opRows].sort((a, b) => {
      if (a.at !== b.at) return a.at - b.at;
      return a.order - b.order;
    });
  }, [flatToolCalls, operatorEvents]);

  const debugEvents: AnalystDebugEvent[] = useMemo(() => {
    const out: AnalystDebugEvent[] = [];
    for (const item of items) {
      if (item.role === "user") {
        out.push({ kind: "LOG", msg: `user · ${item.text.slice(0, 60)}` });
      } else if (item.role === "assistant") {
        for (const t of item.toolCalls) {
          if (t.status === "running") {
            out.push({ kind: "RUN", msg: t.summary });
          } else if (t.status === "done") {
            out.push({ kind: "OK ", msg: t.summary });
          } else if (t.status === "error") {
            out.push({ kind: "ERR", msg: t.summary });
          }
        }
      }
    }
    if (items.length > 0 && !isStreaming) {
      out.push({ kind: "END", msg: "agent complete" });
    }
    return out;
  }, [items, isStreaming]);

  useEffect(() => {
    onEventsChange?.(debugEvents);
  }, [debugEvents, onEventsChange]);

  useEffect(() => {
    if (conversationScrollRef.current) {
      conversationScrollRef.current.scrollTop =
        conversationScrollRef.current.scrollHeight;
    }
  }, [items, awaitingApproval]);

  useEffect(() => {
    if (toolHistoryScrollRef.current) {
      toolHistoryScrollRef.current.scrollTop =
        toolHistoryScrollRef.current.scrollHeight;
    }
  }, [historyRows.length]);

  useEffect(() => subscribeOperatorEvents(setOperatorEventsState), []);

  // Publish applied-proposals changes to the bus so the phone can react.
  useEffect(() => {
    setAppliedProposals(applied);
  }, [applied]);

  // Publish streaming flag so the phone can disable its action buttons while
  // the agent is mid-turn.
  useEffect(() => {
    publishIsStreaming(isStreaming);
  }, [isStreaming]);

  const handleChunk = useCallback(
    (chunk: WireChunk, assistantId: string) => {
      // New text block after a previous one (typically: tool call ran, now the
      // model resumes writing). Without a separator the two segments would
      // concatenate as `...speed.Hidden Omakase...`. Insert a paragraph break.
      if (chunk.type === "text-start") {
        setItems((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId || m.role !== "assistant") return m;
            if (m.text.length === 0) return m;
            return { ...m, text: m.text.replace(/\s*$/, "") + "\n\n" };
          }),
        );
        return;
      }
      if (chunk.type === "text-delta" && "delta" in chunk) {
        const delta = chunk.delta;
        setItems((prev) =>
          prev.map((m) =>
            m.id === assistantId && m.role === "assistant"
              ? { ...m, text: m.text + delta }
              : m,
          ),
        );
        return;
      }
      if (chunk.type === "tool-input-start" || chunk.type === "tool-input-available") {
        const toolCallId = String(chunk.toolCallId);
        const toolName = String(chunk.toolName);
        const input = "input" in chunk ? chunk.input : undefined;
        setItems((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId || m.role !== "assistant") return m;
            const existing = m.toolCalls.find((t) => t.toolCallId === toolCallId);
            if (existing) {
              return {
                ...m,
                toolCalls: m.toolCalls.map((t) =>
                  t.toolCallId === toolCallId
                    ? {
                        ...t,
                        input: input ?? t.input,
                        summary: summarizeToolInput(toolName, input ?? t.input),
                      }
                    : t,
                ),
              };
            }
            return {
              ...m,
              toolCalls: [
                ...m.toolCalls,
                {
                  toolCallId,
                  toolName,
                  input,
                  status: "running",
                  summary: summarizeToolInput(toolName, input),
                  startedAt: Date.now(),
                },
              ],
            };
          }),
        );
        if (toolName === "requestApproval" && chunk.type === "tool-input-available") {
          const inputObj = input as { proposalId?: string } | undefined;
          const proposalId = inputObj?.proposalId ?? "";
          const token = `analyst-approval:${proposalId}`;
          const cached = proposalCacheRef.current.get(proposalId);
          setAwaitingApproval({
            summary: cached
              ? `Approve change to ${cached.itemName}`
              : `Approve proposal ${proposalId.slice(0, 10)}…`,
          });
          setPendingPrompt({
            kind: "approval",
            token,
            proposalId,
            sku: cached?.sku ?? proposalId,
            itemName: cached?.itemName ?? `Proposal ${proposalId.slice(0, 10)}…`,
            current: cached?.current ?? null,
            patch: cached?.patch ?? {},
            rationale:
              cached?.rationale ??
              "Agent proposed a menu optimization. Review and decide.",
          });
        }
        return;
      }
      if (chunk.type === "tool-output-available") {
        const toolCallId = String(chunk.toolCallId);
        const output = chunk.output;
        setItems((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId || m.role !== "assistant") return m;
            return {
              ...m,
              toolCalls: m.toolCalls.map((t) =>
                t.toolCallId === toolCallId
                  ? {
                      ...t,
                      output,
                      status: "done",
                      summary: `${t.summary} → ${summarizeToolOutput(
                        t.toolName,
                        output,
                      )}`,
                    }
                  : t,
              ),
            };
          }),
        );

        // Cache proposeMenuChange output so requestApproval can render a diff.
        if (output && typeof output === "object" && "proposal" in output) {
          const o = output as {
            proposal?: {
              id?: string;
              sku?: string;
              patch?: Partial<MenuItem>;
              rationale?: string;
            };
            current?: MenuItem | null;
          };
          const p = o.proposal;
          if (p && typeof p.id === "string" && typeof p.sku === "string") {
            proposalCacheRef.current.set(p.id, {
              proposalId: p.id,
              sku: p.sku,
              itemName: o.current?.name ?? p.sku,
              current: o.current ?? null,
              patch: p.patch ?? {},
              rationale: p.rationale ?? "",
            });
          }
        }

        // On applyMenuChange success: append to applied-proposals log.
        if (
          output &&
          typeof output === "object" &&
          "applied" in output &&
          (output as { applied?: unknown }).applied === true
        ) {
          const o = output as {
            proposalId?: string;
            sku?: string;
            menuItem?: MenuItem;
          };
          const proposalId = o.proposalId ?? "";
          const sku = o.sku ?? "";
          if (proposalId && sku) {
            const cached = proposalCacheRef.current.get(proposalId);
            const entry: AppliedProposal = {
              proposalId,
              sku,
              itemName: cached?.itemName ?? o.menuItem?.name ?? sku,
              patch: cached?.patch ?? {},
              appliedAt: Date.now(),
            };
            setApplied((prev) => [...prev, entry]);
          }
        }

        // On rollbackMenuChange success: pop the most recent matching sku.
        if (
          output &&
          typeof output === "object" &&
          "rolledBack" in output &&
          (output as { rolledBack?: unknown }).rolledBack === true
        ) {
          const o = output as { sku?: string };
          const sku = o.sku ?? "";
          if (sku) {
            setApplied((prev) => {
              // Remove the *last* entry with a matching sku, matching the
              // LIFO semantics of menuHistory.pop().
              for (let i = prev.length - 1; i >= 0; i--) {
                if (prev[i].sku === sku) {
                  return [...prev.slice(0, i), ...prev.slice(i + 1)];
                }
              }
              return prev;
            });
          }
        }

        // Approval prompt resolved. Clear banner/bus.
        setAwaitingApproval(null);
        setPendingPrompt(null);
        return;
      }
      if (chunk.type === "tool-output-error") {
        const toolCallId = String(chunk.toolCallId);
        setItems((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId || m.role !== "assistant") return m;
            return {
              ...m,
              toolCalls: m.toolCalls.map((t) =>
                t.toolCallId === toolCallId
                  ? { ...t, status: "error", summary: `${t.summary} → error` }
                  : t,
              ),
            };
          }),
        );
      }
    },
    [],
  );

  const consumeStream = useCallback(
    async (body: ReadableStream<Uint8Array>, assistantId: string) => {
      const reader = body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let idx: number;
        while ((idx = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, idx).trim();
          buffer = buffer.slice(idx + 1);
          if (!line) continue;
          try {
            const chunk = JSON.parse(line) as WireChunk;
            handleChunk(chunk, assistantId);
          } catch {
            // Skip unparseable lines.
          }
        }
      }
    },
    [handleChunk],
  );

  const send = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming) return;

      const userId = makeId("user");
      const assistantId = makeId("assistant");
      const nextUserItem: UserMessage = { id: userId, role: "user", text };
      const nextAssistantItem: AssistantMessage = {
        id: assistantId,
        role: "assistant",
        text: "",
        toolCalls: [],
      };

      setItems((prev) => [...prev, nextUserItem, nextAssistantItem]);
      setIsStreaming(true);
      activeAssistantIdRef.current = assistantId;

      const history = [
        ...messagesForApi,
        { role: "user" as const, content: text },
      ];

      try {
        const res = await fetch("/api/agent/analyst/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: history }),
        });

        if (!res.body) {
          setIsStreaming(false);
          return;
        }

        const runId = res.headers.get("x-workflow-run-id");
        if (runId) {
          activeRunIdRef.current = runId;
          onRunIdChange?.(runId);
        }

        await consumeStream(res.body, assistantId);
      } finally {
        setIsStreaming(false);
        setAwaitingApproval(null);
        setPendingPrompt(null);
        activeAssistantIdRef.current = null;
        // Keep activeRunIdRef and onRunIdChange intact so the debug drawer stays visible
      }
    },
    [consumeStream, isStreaming, messagesForApi, onRunIdChange],
  );

  // Register the phone's rollback dispatcher: phone calls dispatchRollback(skus)
  // which invokes this function, which synthesizes a user message for the agent.
  useEffect(() => {
    return registerRollbackDispatcher((skus) => {
      if (skus.length === 0) return;
      const list = skus.join(", ");
      const msg =
        skus.length === 1
          ? `Please roll back ${list}. Call rollbackMenuChange and confirm briefly.`
          : `Please roll back the following skus: ${list}. Call rollbackMenuChange once per sku in order and confirm briefly.`;
      // Fire and forget. The send() call guards against concurrent streams.
      void send(msg);
    });
  }, [send]);

  // Register the phone's send dispatcher: phone-surfaced prompt chips and
  // text input feed straight into the chat pane's send().
  useEffect(() => {
    return registerSendDispatcher((text) => {
      void send(text);
    });
  }, [send]);

  // Rehydrate from localStorage on mount; reconnect to any in-flight run.
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) {
      setItems(persisted.items ?? []);
      setApplied(persisted.appliedProposals ?? []);
    }
    setHydrated(true);

    // Reconcile: ops-data state is in-memory and wiped on server restart /
    // HMR. Any persisted applied-proposal whose sku the server no longer
    // recognizes as rollbackable would fail with "no_history", so drop it to ensure
    // the phone's checklist never offers an undo that can't execute.
    if (persisted?.appliedProposals && persisted.appliedProposals.length > 0) {
      void (async () => {
        try {
          const r = await fetch("/api/agent/analyst/rollbackable");
          if (!r.ok) return;
          const { skus } = (await r.json()) as { skus?: string[] };
          if (!skus) return;
          const valid = new Set(skus);
          setApplied((prev) => prev.filter((p) => valid.has(p.sku)));
        } catch {
          // Best-effort. If the endpoint is down, leave the list intact.
        }
      })();
    }

    const runId = persisted?.activeRunId ?? null;
    const assistantId = persisted?.activeAssistantId ?? null;
    if (!runId || !assistantId) return;

    savePersisted({
      items: persisted?.items ?? [],
      activeRunId: null,
      activeAssistantId: null,
      appliedProposals: persisted?.appliedProposals ?? [],
    });

    let cancelled = false;
    const abort = new AbortController();
    (async () => {
      try {
        setIsStreaming(true);
        activeRunIdRef.current = runId;
        activeAssistantIdRef.current = assistantId;
        onRunIdChange?.(runId);

        const res = await fetch(`/api/agent/analyst/chat/${runId}`, {
          signal: abort.signal,
        });
        if (cancelled || !res.body) return;
        await consumeStream(res.body, assistantId);
      } catch {
        // Run may have finished or expired. Just drop the reconnect.
      } finally {
        if (!cancelled) {
          setIsStreaming(false);
          setAwaitingApproval(null);
          setPendingPrompt(null);
          activeRunIdRef.current = null;
          activeAssistantIdRef.current = null;
          onRunIdChange?.(null);
        }
      }
    })();

    const timeout = setTimeout(() => abort.abort(), 5000);

    return () => {
      cancelled = true;
      abort.abort();
      clearTimeout(timeout);
    };
  }, [consumeStream, onRunIdChange]);

  const reset = useCallback(() => {
    if (isStreaming) return;
    setItems([]);
    setApplied([]);
    clearOperatorEvents();
    setAwaitingApproval(null);
    setPendingPrompt(null);
    proposalCacheRef.current.clear();
    activeRunIdRef.current = null;
    activeAssistantIdRef.current = null;
    onRunIdChange?.(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [isStreaming, onRunIdChange]);

  // Register the phone's reset dispatcher.
  useEffect(() => {
    return registerResetDispatcher(() => {
      reset();
    });
  }, [reset]);

  useEffect(() => {
    if (!hydrated) return;
    savePersisted({
      items,
      activeRunId: isStreaming ? activeRunIdRef.current : null,
      activeAssistantId: isStreaming ? activeAssistantIdRef.current : null,
      appliedProposals: applied,
    });
  }, [items, isStreaming, hydrated, applied]);

  const promptBorderClass = awaitingApproval
    ? "border-amber-400/40 shadow-[0_0_40px_rgba(251,191,36,0.15)]"
    : "border-white/10";
  const statusDotClass = isStreaming
    ? "bg-sky-400"
    : awaitingApproval
      ? "bg-amber-400"
      : "bg-emerald-400";
  const statusLabel = isStreaming
    ? "Thinking"
    : awaitingApproval
      ? "Awaiting approval"
      : "Ready";
  const suspensionBarClass = awaitingApproval
    ? "border-amber-400/30 bg-amber-500/10 opacity-100"
    : "border-transparent bg-transparent opacity-0";

  return (
    <div
      className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-zinc-950 transition-[border-color,box-shadow] duration-500 ${promptBorderClass}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-8 py-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Optimize agent
          </span>
          <span className="font-mono text-sm text-zinc-500">
            anthropic/claude-haiku-4.5
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-3 w-3 rounded-full transition-colors ${statusDotClass}`}
          />
          <span className="text-sm text-zinc-400">{statusLabel}</span>
        </div>
      </div>

      {/* Suspension bar (CLS-safe: always reserves height, fades via opacity) */}
      <div
        aria-hidden={!awaitingApproval}
        className={`flex h-14 items-center gap-4 border-b px-8 transition-[opacity,border-color,background-color] duration-500 ${suspensionBarClass}`}
      >
        <span className="h-3 w-3 animate-pulse rounded-full bg-amber-400" />
        <span className="font-mono text-lg uppercase tracking-[0.2em] text-amber-200">
          agent suspended, waiting for human
        </span>
      </div>

      {/* Main area, two columns: conversation text | tool call history */}
      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px]">
        {/* ── Conversation text column ── */}
        <div
          ref={conversationScrollRef}
          className="flex flex-col gap-5 overflow-y-auto px-8 py-6"
        >
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center">
              <p className="text-2xl text-zinc-600">
                Use the phone to send a prompt.
              </p>
            </div>
          ) : (
            items.map((item) =>
              item.role === "user" ? (
                <div key={item.id} className="flex justify-end">
                  <div className="max-w-[85%] rounded-xl bg-white px-4 py-3 text-xl text-black">
                    {item.text}
                  </div>
                </div>
              ) : (
                <div key={item.id} className="flex flex-col gap-2">
                  {item.text ? <AnalystMarkdown>{item.text}</AnalystMarkdown> : null}
                </div>
              ),
            )
          )}
        </div>

        {/* ── Tool-call + operator history column ── */}
        <div className="flex min-h-0 flex-col border-l border-white/10 bg-black/40">
          <div className="flex items-center gap-3 border-b border-white/10 px-5 py-3">
            <span className="h-2 w-2 rounded-full bg-zinc-600" />
            <span className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Tool + manager history
            </span>
            <span className="ml-auto font-mono text-xs text-zinc-600">
              {historyRows.length}
            </span>
          </div>
          <div
            ref={toolHistoryScrollRef}
            className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4"
          >
            {historyRows.length === 0 ? (
              <div className="flex flex-1 items-center justify-center text-center text-sm text-zinc-700">
                No activity yet
              </div>
            ) : (
              historyRows.map((row) => {
                if (row.kind === "operator") {
                  const e = row.event;
                  const tintClass =
                    e.kind === "approve"
                      ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
                      : e.kind === "reject"
                        ? "border-red-500/40 bg-red-500/10 text-red-100"
                        : e.kind === "optimize"
                          ? "border-sky-500/40 bg-sky-500/10 text-sky-100"
                          : "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-100";
                  const dotClass =
                    e.kind === "approve"
                      ? "bg-emerald-300"
                      : e.kind === "reject"
                        ? "bg-red-300"
                        : e.kind === "optimize"
                          ? "bg-sky-300"
                          : "bg-fuchsia-300";
                  return (
                    <div
                      key={e.id}
                      className={`flex items-center gap-3 rounded-xl border border-dashed px-3 py-2 font-mono text-sm transition-colors ${tintClass}`}
                    >
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`}
                      />
                      <span className="truncate">{e.label}</span>
                    </div>
                  );
                }
                const t = row.tool;
                const isRollback = t.toolName === "rollbackMenuChange";
                const tintClass =
                  t.status === "error"
                    ? "border-red-500/40 bg-red-500/5 text-red-300"
                    : isRollback
                      ? "border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-100"
                      : t.status === "done"
                        ? "border-sky-500/30 bg-sky-500/5 text-sky-200"
                        : "border-sky-400/40 bg-sky-500/10 text-sky-100";
                const dotClass =
                  t.status === "error"
                    ? "bg-red-400"
                    : isRollback
                      ? t.status === "running"
                        ? "animate-pulse bg-fuchsia-300"
                        : "bg-fuchsia-300"
                      : t.status === "running"
                        ? "animate-pulse bg-sky-300"
                        : "bg-sky-300";
                return (
                  <div
                    key={t.toolCallId}
                    className={`flex items-center gap-3 rounded-xl border px-3 py-2 font-mono text-sm transition-colors ${tintClass}`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${dotClass}`} />
                    <span className="truncate">{t.summary}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
