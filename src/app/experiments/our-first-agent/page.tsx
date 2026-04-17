"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "our-first-agent:run-id";

export default function OurFirstAgentPage() {
  const [mounted, setMounted] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setActiveRunId(stored);
  }, []);

  const transport = useMemo(
    () =>
      new WorkflowChatTransport({
        api: "/api/experiments/our-first-agent",
        onChatSendMessage: (response) => {
          const runId = response.headers.get("x-workflow-run-id");
          if (runId) {
            localStorage.setItem(STORAGE_KEY, runId);
            setActiveRunId(runId);
          }
        },
        onChatEnd: () => {
          localStorage.removeItem(STORAGE_KEY);
          setActiveRunId(undefined);
        },
        prepareReconnectToStreamRequest: ({ api: _api, ...rest }) => {
          const runId = localStorage.getItem(STORAGE_KEY);
          if (!runId) throw new Error("No active run id");
          return {
            ...rest,
            api: `/api/experiments/our-first-agent/${encodeURIComponent(runId)}/stream`,
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status } = useChat({
    resume: Boolean(activeRunId),
    transport,
  });

  const [input, setInput] = useState("My food was cold and late. Order ord-8842.");
  const isWorking = status === "submitted" || status === "streaming";

  function handleSend() {
    const text = input.trim();
    if (!text || isWorking) return;
    sendMessage({ text });
    setInput("");
  }

  function handleClear() {
    localStorage.removeItem(STORAGE_KEY);
    setActiveRunId(undefined);
    window.location.reload();
  }

  return (
    <div className="flex h-full w-full flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-8 py-5">
        <div className="flex flex-col gap-1">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Experiment · Zeroth demo
          </p>
          <h1 className="text-2xl font-semibold tracking-tight">
            Our first agent
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <RunIdBadge runId={mounted ? activeRunId : undefined} />
          <button
            type="button"
            onClick={handleClear}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs text-zinc-400 hover:bg-white/10"
          >
            New session
          </button>
        </div>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_360px]">
        <div className="flex min-h-0 flex-col overflow-hidden">
          <ExperimentChatScroll messages={messages} isWorking={isWorking} />

          <div className="border-t border-white/10 px-8 py-5">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                  }
                }}
                placeholder="Describe your issue…"
                className="flex-1 rounded-xl border border-white/10 bg-zinc-950 px-4 py-3 font-sans text-base text-white placeholder:text-zinc-600 focus:border-white/30 focus:outline-none"
                disabled={isWorking}
              />
              <button
                type="button"
                onClick={handleSend}
                disabled={isWorking || !input.trim()}
                className="rounded-xl bg-white px-5 py-3 font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </div>
        </div>

        <aside className="flex min-h-0 flex-col gap-4 border-l border-white/10 bg-zinc-950 p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              The demo
            </p>
            <h2 className="mt-2 text-xl font-semibold leading-snug tracking-tight">
              Hit <kbd className="rounded border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-sm">F5</kbd> mid-response
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">
              While the agent is streaming a reply — or waiting on the
              <span className="px-1 font-mono text-xs text-sky-400">fetchOrderDetails</span>
              tool — reload the page. The stream reconnects. The same
              sentence finishes itself.
            </p>
          </div>

          <div className="rounded-xl border border-white/10 bg-black p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Under the hood
            </p>
            <ul className="mt-3 flex flex-col gap-2 font-mono text-xs text-zinc-400">
              <li>
                <span className="text-sky-400">POST</span>{" "}
                /api/experiments/our-first-agent
              </li>
              <li>
                <span className="text-emerald-400">returns</span>{" "}
                x-workflow-run-id
              </li>
              <li>
                <span className="text-amber-400">localStorage</span>{" "}
                remembers the run id
              </li>
              <li>
                <span className="text-sky-400">GET</span>{" "}
                /.../[runId]/stream?startIndex=…
              </li>
              <li>
                <span className="text-emerald-400">reconnects</span>{" "}
                to the live stream
              </li>
            </ul>
          </div>

          <div className="mt-auto rounded-xl border border-white/10 bg-black p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Next
            </p>
            <p className="mt-2 text-sm leading-relaxed text-zinc-400">
              Once the audience trusts the reload, we add the three
              verbs: <span className="text-sky-400">retry</span> ·{" "}
              <span className="text-amber-400">suspend</span> ·{" "}
              <span className="text-fuchsia-400">rollback</span>.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}

type ExperimentChatScrollProps = {
  messages: ReturnType<typeof useChat>["messages"];
  isWorking: boolean;
};

function ExperimentChatScroll({ messages, isWorking }: ExperimentChatScrollProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isWorking]);

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-6">
        {messages.length === 0 && <EmptyState />}
        {messages.map((m) => (
          <MessageBubble key={m.id} message={m} />
        ))}
        {isWorking && <WorkingHint />}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950 p-8 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Support · new ticket
      </p>
      <p className="mt-3 text-lg leading-snug text-zinc-300">
        Press <span className="font-mono text-white">Send</span> to open
        a ticket. The agent will acknowledge, look up the order, and
        propose a resolution.
      </p>
    </div>
  );
}

function WorkingHint() {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-sky-500/30 bg-sky-500/5 px-4 py-3">
      <span className="h-2 w-2 animate-pulse rounded-full bg-sky-400" />
      <span className="font-mono text-xs uppercase tracking-[0.2em] text-sky-300">
        agent working — reload is safe
      </span>
    </div>
  );
}

function RunIdBadge({ runId }: { runId: string | undefined }) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black px-3 py-1.5 font-mono text-xs">
      <span className="text-zinc-500">runId</span>
      <span className={runId ? "text-emerald-300" : "text-zinc-600"}>
        {runId ? runId.slice(0, 14) + "…" : "—"}
      </span>
    </div>
  );
}

type ChatMessage = ReturnType<typeof useChat>["messages"][number];

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl border px-5 py-4 ${
          isUser
            ? "border-white/15 bg-white/5 text-zinc-100"
            : "border-white/10 bg-zinc-950 text-zinc-200"
        }`}
      >
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">
          {isUser ? "Customer" : "Support agent"}
        </p>
        <div className="flex flex-col gap-2">
          {message.parts.map((part, i) => (
            <MessagePart key={i} part={part} />
          ))}
        </div>
      </div>
    </div>
  );
}

type MessagePart = ChatMessage["parts"][number];

function MessagePart({ part }: { part: MessagePart }) {
  if (part.type === "text") {
    return (
      <p className="whitespace-pre-wrap text-base leading-relaxed">
        {part.text}
      </p>
    );
  }
  if (part.type === "reasoning") {
    return (
      <p className="whitespace-pre-wrap text-sm italic text-zinc-500">
        {part.text}
      </p>
    );
  }
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    const toolName = part.type.slice("tool-".length);
    const state = (part as { state?: string }).state ?? "calling";
    const done =
      state === "output-available" || state === "output-error";
    return (
      <div
        className={`rounded-lg border px-3 py-2 font-mono text-xs ${
          done
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
            : "border-sky-500/30 bg-sky-500/5 text-sky-300"
        }`}
      >
        <span className="text-zinc-500">tool</span>{" "}
        <span>{toolName}</span>{" "}
        <span className="text-zinc-500">·</span>{" "}
        <span>{done ? "done" : "running…"}</span>
      </div>
    );
  }
  return null;
}
