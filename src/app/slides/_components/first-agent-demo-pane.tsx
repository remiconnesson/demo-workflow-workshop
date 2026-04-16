"use client";

import { useChat } from "@ai-sdk/react";
import { WorkflowChatTransport } from "@workflow/ai";
import { useEffect, useMemo, useState } from "react";

const STORAGE_KEY = "slides:first-agent:run-id";
const PRESET_PROMPT = "My food was cold and late. Order ord-8842.";

/**
 * Presenter-scale chat pane for the "Our First Agent" slide.
 *
 * Reuses the `/api/experiments/our-first-agent` routes. The slide's job
 * is to let the presenter:
 *   1. Press "Open ticket" — agent starts streaming
 *   2. While the tool is running (3s sleep), hit F5
 *   3. Watch the same sentence finish itself after reload
 *
 * Everything is sized for projector legibility: text-3xl message bodies,
 * a full-width "AGENT WORKING — RELOAD SAFE" state card, and a run-id
 * badge in Geist Mono that stays identical across the reload.
 */
export function FirstAgentDemoPane() {
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

  const isWorking = status === "submitted" || status === "streaming";
  const hasMessages = messages.length > 0;

  function handleSend() {
    if (isWorking) return;
    sendMessage({ text: PRESET_PROMPT });
  }

  function handleReset() {
    localStorage.removeItem(STORAGE_KEY);
    setActiveRunId(undefined);
    window.location.reload();
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-[1fr_440px] gap-8 overflow-hidden">
      {/* LEFT — chat surface */}
      <div className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-white/10 px-8 py-5">
          <div className="flex items-center gap-4">
            <span className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Support · new ticket
            </span>
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-1.5 font-mono text-xs text-zinc-400 hover:bg-white/10"
          >
            Reset
          </button>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
          {!hasMessages && (
            <div className="flex h-full items-center justify-center p-10">
              <div className="max-w-xl text-center">
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Zeroth demo
                </p>
                <p className="mt-4 text-3xl font-semibold leading-tight tracking-tight text-white">
                  A customer opens a ticket.
                </p>
                <p className="mt-4 text-xl leading-relaxed text-zinc-400">
                  The agent acknowledges, looks up the order, and
                  drafts a resolution. It takes about five seconds.
                </p>
              </div>
            </div>
          )}

          {hasMessages && (
            <div className="flex h-full flex-col gap-6 overflow-y-auto px-8 py-8">
              {messages.map((m) => (
                <MessageCard key={m.id} message={m} />
              ))}
              {isWorking && <WorkingPulse />}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-white/10 px-8 py-6">
          <div className="flex-1 rounded-xl border border-white/10 bg-black px-5 py-4 font-sans text-lg text-zinc-400">
            {PRESET_PROMPT}
          </div>
          <button
            type="button"
            onClick={handleSend}
            disabled={isWorking || hasMessages}
            className="rounded-xl bg-white px-8 py-4 text-lg font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40"
          >
            Open ticket
          </button>
        </div>
      </div>

      {/* RIGHT — the F5 hint + under-the-hood */}
      <aside className="flex min-h-0 flex-col gap-6 overflow-hidden">
        <div
          className={`flex flex-col gap-3 rounded-2xl border p-8 transition-colors duration-300 ${
            isWorking
              ? "border-sky-500/40 bg-sky-500/10"
              : "border-white/10 bg-zinc-950"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            The demo
          </p>
          <p className="text-4xl font-semibold leading-[1.05] tracking-tight">
            Hit{" "}
            <kbd className="rounded-lg border border-white/20 bg-white/10 px-3 py-1 font-mono text-3xl">
              F5
            </kbd>
            <br />
            mid-response.
          </p>
          <p className="text-lg leading-relaxed text-zinc-400">
            The stream reconnects. The sentence finishes itself. The
            tool call that was already running doesn&apos;t re-fire.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Run id
          </p>
          <p className="mt-3 font-mono text-xl text-emerald-300">
            {mounted && activeRunId
              ? activeRunId.slice(0, 24) + "…"
              : "—"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-zinc-500">
            Same id before and after the reload. The client reads it
            from{" "}
            <span className="font-mono text-zinc-400">localStorage</span>
            {" "}and reconnects to the live stream.
          </p>
        </div>

        <div className="mt-auto rounded-2xl border border-white/10 bg-black p-6">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            Primitive
          </p>
          <p className="mt-3 font-mono text-xl leading-relaxed text-zinc-300">
            new <span className="text-white">DurableAgent</span>
            <br />+ WorkflowChatTransport
          </p>
        </div>
      </aside>
    </div>
  );
}

/* ---------- subcomponents ---------- */

function WorkingPulse() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-sky-500/40 bg-sky-500/10 px-6 py-5">
      <span className="h-3 w-3 animate-pulse rounded-full bg-sky-400" />
      <span className="font-mono text-lg uppercase tracking-[0.2em] text-sky-200">
        agent working — reload safe
      </span>
    </div>
  );
}

type ChatMessage = ReturnType<typeof useChat>["messages"][number];

function MessageCard({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[86%] rounded-2xl border px-6 py-5 ${
          isUser
            ? "border-white/15 bg-white/5"
            : "border-white/10 bg-black"
        }`}
      >
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500">
          {isUser ? "Customer" : "Support agent"}
        </p>
        <div className="mt-3 flex flex-col gap-3">
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
      <p className="whitespace-pre-wrap text-2xl leading-[1.35] text-zinc-100">
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
        className={`flex items-center gap-3 rounded-xl border px-4 py-3 font-mono text-base ${
          done
            ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
            : "border-sky-500/40 bg-sky-500/10 text-sky-200"
        }`}
      >
        <span
          className={`h-2 w-2 rounded-full ${
            done ? "bg-emerald-400" : "animate-pulse bg-sky-400"
          }`}
        />
        <span className="text-zinc-500">tool</span>
        <span className="tabular-nums">{toolName}</span>
        <span className="text-zinc-500">·</span>
        <span>{done ? "done" : "running"}</span>
      </div>
    );
  }
  return null;
}
