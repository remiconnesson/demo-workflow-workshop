"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { setPendingApproval } from "./analyst-approval-bus";
import { AnalystMarkdown } from "./analyst-markdown";

type ToolCallState = {
  toolCallId: string;
  toolName: string;
  input?: unknown;
  output?: unknown;
  status: "running" | "done" | "error";
  summary: string;
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

const SUGGESTED_PROMPTS = [
  "What's going wrong?",
  "Why are we refunding so much?",
  "Should we hide any menu items?",
];

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

const STORAGE_KEY = "analyst-chat:v1";

type Persisted = {
  items: ChatItem[];
  activeRunId: string | null;
  activeAssistantId: string | null;
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
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [awaitingApproval, setAwaitingApproval] = useState<null | {
    summary: string;
  }>(null);
  const [hydrated, setHydrated] = useState(false);
  const activeRunIdRef = useRef<string | null>(null);
  const activeAssistantIdRef = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messagesForApi = useMemo(() => {
    return items
      .filter((i): i is ChatItem => i.role === "user" || i.role === "assistant")
      .map((i) => ({
        role: i.role,
        content: i.role === "user" ? i.text : i.text,
      }));
  }, [items]);

  // Derive debug events from tool calls and notify parent
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
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [items, awaitingApproval]);

  const handleChunk = useCallback(
    (chunk: WireChunk, assistantId: string) => {
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
                },
              ],
            };
          }),
        );
        if (toolName === "requestApproval" && chunk.type === "tool-input-available") {
          const inputObj = input as { proposalId?: string } | undefined;
          const proposalId = inputObj?.proposalId ?? "";
          const token = `analyst-approval:${proposalId}`;
          const summary = `Approve proposal ${proposalId.slice(0, 10)}…`;
          setAwaitingApproval({ summary });
          setPendingApproval({
            token,
            proposalId,
            summary: `Menu change · ${proposalId.slice(0, 12)}…`,
            rationale:
              "Analyst proposed a menu change. Review the rationale in the report and decide.",
          });
        }
        return;
      }
      if (chunk.type === "tool-output-available") {
        const toolCallId = String(chunk.toolCallId);
        setItems((prev) =>
          prev.map((m) => {
            if (m.id !== assistantId || m.role !== "assistant") return m;
            return {
              ...m,
              toolCalls: m.toolCalls.map((t) =>
                t.toolCallId === toolCallId
                  ? {
                      ...t,
                      output: chunk.output,
                      status: "done",
                      summary: `${t.summary} → ${summarizeToolOutput(
                        t.toolName,
                        chunk.output,
                      )}`,
                    }
                  : t,
              ),
            };
          }),
        );
        // Approval resolved — clear banner.
        setAwaitingApproval(null);
        setPendingApproval(null);
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
      setInput("");
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

        const runId = res.headers.get("X-Run-Id");
        if (runId) {
          activeRunIdRef.current = runId;
          onRunIdChange?.(runId);
        }

        await consumeStream(res.body, assistantId);
      } finally {
        setIsStreaming(false);
        setAwaitingApproval(null);
        setPendingApproval(null);
        activeAssistantIdRef.current = null;
        // Keep activeRunIdRef and onRunIdChange intact so the debug drawer stays visible
      }
    },
    [consumeStream, isStreaming, messagesForApi, onRunIdChange],
  );

  // Rehydrate from localStorage on mount; reconnect to any in-flight run.
  useEffect(() => {
    const persisted = loadPersisted();
    if (persisted) {
      setItems(persisted.items ?? []);
    }
    setHydrated(true);

    const runId = persisted?.activeRunId ?? null;
    const assistantId = persisted?.activeAssistantId ?? null;
    if (!runId || !assistantId) return;

    // Clear the persisted run pointer immediately so a subsequent
    // navigation doesn't try to reconnect to the same dead run.
    savePersisted({ items: persisted?.items ?? [], activeRunId: null, activeAssistantId: null });

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
        // Run may have finished or expired — just drop the reconnect.
      } finally {
        if (!cancelled) {
          setIsStreaming(false);
          setAwaitingApproval(null);
          setPendingApproval(null);
          activeRunIdRef.current = null;
          activeAssistantIdRef.current = null;
          onRunIdChange?.(null);
        }
      }
    })();

    // Abort the reconnection attempt after 5s so stale runs don't block the UI.
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
    setAwaitingApproval(null);
    setPendingApproval(null);
    activeRunIdRef.current = null;
    activeAssistantIdRef.current = null;
    onRunIdChange?.(null);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [isStreaming, onRunIdChange]);

  // Persist transcript + active run pointer whenever they change.
  useEffect(() => {
    if (!hydrated) return;
    savePersisted({
      items,
      activeRunId: isStreaming ? activeRunIdRef.current : null,
      activeAssistantId: isStreaming ? activeAssistantIdRef.current : null,
    });
  }, [items, isStreaming, hydrated]);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void send(input);
  };

  return (
    <div className={`flex h-full w-full flex-col overflow-hidden rounded-2xl border bg-zinc-950 transition-[border-color,box-shadow] duration-500 ${
      awaitingApproval
        ? "border-amber-400/40 shadow-[0_0_40px_rgba(251,191,36,0.15)]"
        : "border-white/10"
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-8 py-5">
        <div className="flex flex-col gap-1">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Analyst
          </span>
          <span className="font-mono text-sm text-zinc-500">
            anthropic/claude-haiku-4.5
          </span>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span
              className={`h-3 w-3 rounded-full transition-colors ${
                isStreaming
                  ? "bg-sky-400"
                  : awaitingApproval
                    ? "bg-amber-400"
                    : "bg-emerald-400"
              }`}
            />
            <span className="text-sm text-zinc-400">
              {isStreaming
                ? "Thinking"
                : awaitingApproval
                  ? "Awaiting approval"
                  : "Ready"}
            </span>
          </div>
          <button
            type="button"
            onClick={reset}
            disabled={isStreaming}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Reset
          </button>
        </div>
      </div>

      {/* Suspension bar — CLS-safe via opacity, always in DOM */}
      <div
        className={`flex items-center gap-4 border-b px-8 transition-[opacity,border-color,background-color,padding] duration-500 ${
          awaitingApproval
            ? "py-4 border-amber-400/30 bg-amber-500/10 opacity-100"
            : "h-0 overflow-hidden border-transparent opacity-0 py-0"
        }`}
      >
        <span className="h-3 w-3 animate-pulse rounded-full bg-amber-400" />
        <span className="font-mono text-lg uppercase tracking-[0.2em] text-amber-200">
          agent suspended — waiting for human
        </span>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-5 overflow-y-auto px-8 py-6"
      >
        {items.length === 0 ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="text-2xl text-zinc-600">
              Ask the analyst anything about today&apos;s orders.
            </p>
          </div>
        ) : (
          items.map((item) =>
            item.role === "user" ? (
              <div key={item.id} className="flex justify-end">
                <div className="max-w-[75%] rounded-xl bg-white px-4 py-3 text-xl text-black">
                  {item.text}
                </div>
              </div>
            ) : (
              <div key={item.id} className="flex flex-col gap-2">
                {item.toolCalls.length > 0 && (
                  <div className="flex flex-col gap-2">
                    {item.toolCalls.map((t) => (
                      <div
                        key={t.toolCallId}
                        className={`flex items-center gap-3 rounded-xl border px-4 py-2 font-mono text-lg transition-colors ${
                          t.status === "done"
                            ? "border-sky-500/30 bg-sky-500/5 text-sky-200"
                            : t.status === "error"
                              ? "border-red-500/40 bg-red-500/5 text-red-300"
                              : "border-sky-400/40 bg-sky-500/10 text-sky-100"
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            t.status === "running"
                              ? "animate-pulse bg-sky-300"
                              : t.status === "error"
                                ? "bg-red-400"
                                : "bg-sky-300"
                          }`}
                        />
                        <span className="truncate">{t.summary}</span>
                      </div>
                    ))}
                  </div>
                )}
                {item.text && <AnalystMarkdown>{item.text}</AnalystMarkdown>}
              </div>
            ),
          )
        )}

        {/* Approval banner — reserved slot via opacity, CLS-safe */}
        <div
          className={`overflow-hidden transition-[max-height,opacity] duration-200 ${
            awaitingApproval ? "max-h-40 opacity-100" : "max-h-0 opacity-0"
          }`}
        >
          <div className="rounded-xl border border-amber-400/40 bg-amber-500/10 px-5 py-4">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
              Awaiting operator approval
            </div>
            <div className="mt-1 text-xl text-amber-100">
              {awaitingApproval?.summary ?? ""}
            </div>
          </div>
        </div>
      </div>

      {/* Input row */}
      <div className="border-t border-white/10 bg-zinc-950 px-8 py-5">
        {items.length === 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {SUGGESTED_PROMPTS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => void send(p)}
                className="rounded-full border border-white/10 bg-white/5 px-5 py-2 text-base text-zinc-300 transition hover:border-white/20 hover:bg-white/10 hover:text-white"
                disabled={isStreaming}
              >
                {p}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={onSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isStreaming}
            placeholder="Ask the analyst…"
            className="flex-1 rounded-xl border border-white/10 bg-black px-5 py-3 text-xl text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={isStreaming || !input.trim()}
            className="rounded-xl bg-white px-6 py-3 text-xl font-semibold text-black transition hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
