"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import type { MenuItem } from "@/lib/ops-data";
import {
  dispatchRollback,
  dispatchReset,
  dispatchSend,
  getAppliedProposals,
  getIsStreaming,
  getPendingPrompt,
  pushOperatorEvent,
  setPendingPrompt,
  subscribeAppliedProposals,
  subscribeIsStreaming,
  subscribePendingPrompt,
  type AppliedProposal,
  type PendingPrompt,
} from "./analyst-approval-bus";

type DiffRow = { key: string; label: string; from: string; to: string };

function formatMenuValue(key: keyof MenuItem, value: unknown): string {
  if (value === undefined || value === null) return "—";
  if (key === "price" && typeof value === "number") return `$${value.toFixed(2)}`;
  if (key === "hidden") return value ? "yes" : "no";
  return String(value);
}

function buildDiff(
  current: MenuItem | null,
  patch: Partial<MenuItem>,
): DiffRow[] {
  const keys = Object.keys(patch) as Array<keyof MenuItem>;
  return keys
    .filter((k) => k !== "sku")
    .map((k) => ({
      key: String(k),
      label: String(k),
      from: formatMenuValue(k, current?.[k]),
      to: formatMenuValue(k, patch[k]),
    }));
}

function formatAppliedTime(ms: number): string {
  const secs = Math.max(1, Math.round((Date.now() - ms) / 1000));
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  return `${hours}h ago`;
}

export function AnalystApprovalPhone() {
  const [pending, setPending] = useState<PendingPrompt | null>(() =>
    getPendingPrompt(),
  );
  const [applied, setApplied] = useState<AppliedProposal[]>(() =>
    getAppliedProposals(),
  );
  const [isStreaming, setIsStreaming] = useState<boolean>(() => getIsStreaming());
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [view, setView] = useState<"idle" | "checklist">("idle");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [focusedSkus, setFocusedSkus] = useState<Set<string>>(new Set());
  const [input, setInput] = useState("");
  const [suggestedProposals, setSuggestedProposals] = useState<string[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => subscribePendingPrompt(setPending), []);
  useEffect(() => subscribeAppliedProposals(setApplied), []);
  useEffect(() => subscribeIsStreaming(setIsStreaming), []);

  // Refresh menu on mount and whenever applied/rolled-back changes.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/agent/analyst/menu");
        if (!r.ok) return;
        const { items } = (await r.json()) as { items?: MenuItem[] };
        if (!cancelled && items) setMenu(items);
      } catch {
        // Best-effort — menu is decorative context, not safety-critical.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applied]);

  // Exit checklist automatically if the applied list empties while it's open.
  useEffect(() => {
    if (view === "checklist" && applied.length === 0) {
      setView("idle");
      setSelected(new Set());
    }
  }, [view, applied.length]);

  // Keep the prompt input focused whenever the phone is idle (no approval
  // card, no checklist) and the input is enabled. Re-fires on every state
  // transition that could have moved focus away — view switches, streaming
  // start/stop, approval land/resolve.
  const inputDisabled = isStreaming || Boolean(pending);
  useEffect(() => {
    if (view !== "idle" || inputDisabled) return;
    // Wait one microtask so any concurrent overlay opacity transition doesn't
    // steal focus back from us as it tears down.
    const id = window.setTimeout(() => {
      inputRef.current?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(id);
  }, [view, inputDisabled, pending, isStreaming]);

  const diffRows = useMemo(
    () => (pending ? buildDiff(pending.current, pending.patch) : []),
    [pending],
  );

  const decideApproval = async (approved: boolean) => {
    if (!pending || submitting) return;
    setSubmitting(true);
    const itemName = pending.itemName;
    pushOperatorEvent({
      kind: approved ? "approve" : "reject",
      label: `manager ${approved ? "approved" : "rejected"} · ${itemName}`,
    });
    const body: { token: string; approved: boolean; reason?: string } = {
      token: pending.token,
      approved,
    };
    if (!approved) body.reason = "Operator rejected on stage";
    try {
      const res = await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      await res.json().catch(() => ({}));
      // Optimistically clear the approval overlay once the server has
      // accepted the decision. The chat pane will also clear pending on
      // the next tool-output-available, but if the stream drops between
      // approve and applyMenuChange the UI must not stay stuck on
      // APPROVAL REQUESTED.
      if (res.ok) setPendingPrompt(null);
    } catch (err) {
      console.error("[approval-phone] approve fetch threw", err);
    } finally {
      setSubmitting(false);
    }
  };

  const openChecklist = () => {
    if (applied.length === 0) return;
    setSelected(new Set());
    setView("checklist");
  };

  const cancelChecklist = () => {
    setSelected(new Set());
    setView("idle");
  };

  const toggleSelected = (proposalId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(proposalId)) next.delete(proposalId);
      else next.add(proposalId);
      return next;
    });
  };

  const confirmRollback = async () => {
    if (submitting || selected.size === 0) return;
    // Resolve skus in the order they were applied (newest first — matches
    // the menuHistory stack's pop semantics).
    const skus = applied
      .slice()
      .reverse()
      .filter((p) => selected.has(p.proposalId))
      .map((p) => p.sku);
    if (skus.length === 0) return;

    setSubmitting(true);
    pushOperatorEvent({
      kind: "undo-requested",
      label:
        skus.length === 1
          ? `manager requested undo · ${skus[0]}`
          : `manager requested undo · ${skus.length} changes`,
    });
    try {
      // If an approval is currently pending, clear it out first so the
      // agent can finish that turn before starting the rollback turn.
      if (pending) {
        try {
          await fetch("/api/agent/approve", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              token: pending.token,
              approved: false,
              reason: "undo_requested",
            }),
          });
        } catch (err) {
          console.error("[approval-phone] pre-undo reject threw", err);
        }
      }
      dispatchRollback(skus);
    } finally {
      setSelected(new Set());
      setView("idle");
      setSubmitting(false);
    }
  };

  const focusedItems = useMemo(
    () => menu.filter((m) => focusedSkus.has(m.sku)),
    [menu, focusedSkus],
  );

  const buildOutgoing = (text: string): string => {
    if (focusedItems.length === 0) return text;
    const summary = focusedItems
      .map((m) => `${m.sku} (${m.name})`)
      .join(", ");
    return `Focus on these menu items: ${summary}. ${text}`;
  };

  const toggleFocused = (sku: string) => {
    setFocusedSkus((prev) => {
      const next = new Set(prev);
      if (next.has(sku)) next.delete(sku);
      else next.add(sku);
      return next;
    });
  };

  const clearFocused = () => {
    if (focusedSkus.size === 0) return;
    setFocusedSkus(new Set());
  };

  const handleSendSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = input.trim();
    if (!text || isStreaming) return;
    if (dispatchSend(buildOutgoing(text))) {
      setInput("");
      setFocusedSkus(new Set());
      setSuggestedProposals([]);
    }
  };

  const sendChip = (text: string) => {
    if (isStreaming) return;
    if (dispatchSend(buildOutgoing(text))) {
      setFocusedSkus(new Set());
      setSuggestedProposals([]);
    }
  };

  const handleReset = () => {
    if (isStreaming) return;
    dispatchReset();
    setInput("");
    setFocusedSkus(new Set());
    setSuggestedProposals([]);
    setOptimizeError(null);
  };

  const runOptimize = async () => {
    if (isOptimizing || isStreaming || Boolean(pending)) return;
    setIsOptimizing(true);
    setOptimizeError(null);
    pushOperatorEvent({
      kind: "optimize",
      label:
        focusedSkus.size > 0
          ? `manager optimize · ${focusedSkus.size} in focus`
          : "manager optimize · full menu",
    });
    try {
      const res = await fetch("/api/agent/analyst/optimize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ focusedSkus: Array.from(focusedSkus) }),
      });
      if (!res.ok) throw new Error(`optimize ${res.status}`);
      const data = (await res.json()) as { proposals?: string[] };
      const next = Array.isArray(data.proposals)
        ? data.proposals.filter((p) => typeof p === "string" && p.trim())
        : [];
      if (next.length === 0) throw new Error("no proposals");
      setSuggestedProposals(next);
      pushOperatorEvent({
        kind: "optimize",
        label: `agent returned ${next.length} proposal${next.length === 1 ? "" : "s"}`,
      });
    } catch (err) {
      console.error("[approval-phone] optimize failed", err);
      setOptimizeError("Couldn't generate proposals. Try again.");
    } finally {
      setIsOptimizing(false);
    }
  };

  const isChecklist = view === "checklist";
  const hasApplied = applied.length > 0;
  const showApproval = Boolean(pending) && !isChecklist;

  const glowClass = isChecklist
    ? "shadow-[0_0_50px_rgba(232,121,249,0.55)]"
    : pending
      ? "shadow-[0_0_50px_rgba(251,191,36,0.5)]"
      : hasApplied
        ? "shadow-[0_0_40px_rgba(232,121,249,0.25)]"
        : "";

  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* Phone frame */}
      <div
        className={`relative flex flex-col overflow-hidden rounded-[56px] border-[14px] border-black bg-white transition-shadow duration-500 ${glowClass}`}
        style={{ width: 360, height: 720 }}
      >
        {/* Dynamic island */}
        <div className="absolute left-1/2 top-3 h-6 w-28 -translate-x-1/2 rounded-full bg-black z-10" />

        {/* Status bar spacer */}
        <div className="h-10" />

        {/* Content */}
        <div className="relative flex flex-1 flex-col overflow-hidden">
          {/* ─────────── Idle / command-center state ─────────── */}
          <div
            className={`absolute inset-0 flex flex-col px-5 pb-4 pt-3 transition-opacity duration-200 ${
              !showApproval && !isChecklist
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
            aria-hidden={!showApproval && !isChecklist ? undefined : true}
          >
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] font-semibold uppercase tracking-[0.28em] text-zinc-400">
                  Menu
                </span>
                <span className="text-base font-semibold text-black">
                  {focusedSkus.size > 0
                    ? `${focusedSkus.size} in context`
                    : "Tap to focus"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`h-2 w-2 rounded-full transition-colors ${
                    isStreaming
                      ? "animate-pulse bg-sky-500"
                      : "bg-emerald-500"
                  }`}
                  title={isStreaming ? "Thinking" : "Ready"}
                  aria-label={isStreaming ? "Thinking" : "Ready"}
                />
                <button
                  type="button"
                  onClick={openChecklist}
                  disabled={!hasApplied || submitting || isStreaming}
                  title={
                    hasApplied
                      ? `Undo previous change${applied.length === 1 ? "" : "s"} (${applied.length})`
                      : "No changes to undo"
                  }
                  aria-label={
                    hasApplied
                      ? `Undo previous ${applied.length} change${applied.length === 1 ? "" : "s"}`
                      : "No changes to undo"
                  }
                  className="relative flex h-8 w-8 items-center justify-center rounded-full border border-fuchsia-300 bg-fuchsia-50 text-fuchsia-600 transition hover:border-fuchsia-500 hover:bg-fuchsia-100 hover:text-fuchsia-700 disabled:cursor-not-allowed disabled:border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-400 disabled:opacity-60"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3.5 8.5 6 6M3.5 8.5 6 11M3.5 8.5h7a3 3 0 0 1 0 6" />
                  </svg>
                  {hasApplied ? (
                    <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-fuchsia-600 px-1 font-mono text-[9px] font-bold leading-none text-white">
                      {applied.length}
                    </span>
                  ) : null}
                </button>
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={isStreaming}
                  title="Reset chat"
                  aria-label="Reset chat"
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-zinc-300 bg-white text-zinc-500 transition hover:border-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M3 8a5 5 0 1 0 1.6-3.7" />
                    <path d="M3 3.2V5.5h2.3" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Menu list */}
            <div className="mt-3 flex-1 overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50">
              {menu.length === 0 ? (
                <div className="flex h-full items-center justify-center px-3 py-6 text-center text-xs text-zinc-500">
                  Loading menu…
                </div>
              ) : (
                <ul className="flex flex-col">
                  {menu.map((item, i) => {
                    const isFocused = focusedSkus.has(item.sku);
                    return (
                      <li
                        key={item.sku}
                        className={`${i > 0 ? "border-t border-zinc-200" : ""}`}
                      >
                        <button
                          type="button"
                          onClick={() => toggleFocused(item.sku)}
                          aria-pressed={isFocused}
                          className={`flex w-full items-center gap-2 px-3 py-2 text-left transition ${
                            isFocused
                              ? "bg-sky-50"
                              : "bg-transparent hover:bg-zinc-100"
                          } ${item.hidden && !isFocused ? "opacity-45" : ""}`}
                        >
                          <span
                            className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border transition ${
                              isFocused
                                ? "border-sky-500 bg-sky-500 text-white"
                                : "border-zinc-300 bg-white"
                            }`}
                            aria-hidden="true"
                          >
                            {isFocused ? (
                              <svg
                                viewBox="0 0 12 12"
                                className="h-3 w-3"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M2 6.5 5 9.5 10 3" />
                              </svg>
                            ) : null}
                          </span>
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-sm font-semibold text-black">
                              {item.name}
                              {item.hidden ? (
                                <span className="ml-1.5 rounded bg-zinc-200 px-1 py-0.5 font-mono text-[9px] font-normal uppercase tracking-wider text-zinc-600">
                                  hidden
                                </span>
                              ) : null}
                            </span>
                            <span className="truncate font-mono text-[10px] text-zinc-500">
                              {item.sku}
                            </span>
                          </span>
                          <span className="shrink-0 font-mono text-sm font-semibold text-black">
                            ${item.price.toFixed(2)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {/* Focus-context row: always present (reserves height) */}
            <div
              className={`mt-3 flex min-h-[28px] flex-wrap items-center gap-1.5 transition-opacity ${
                focusedSkus.size > 0 ? "opacity-100" : "opacity-0"
              }`}
              aria-hidden={focusedSkus.size === 0}
            >
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-sky-600">
                In context
              </span>
              {focusedItems.map((m) => (
                <button
                  key={m.sku}
                  type="button"
                  onClick={() => toggleFocused(m.sku)}
                  className="group flex items-center gap-1 rounded-full border border-sky-300 bg-sky-50 px-2 py-0.5 font-mono text-[10px] text-sky-800 transition hover:border-sky-500 hover:bg-sky-100"
                >
                  {m.sku}
                  <span className="text-sky-500 transition group-hover:text-sky-800">
                    ×
                  </span>
                </button>
              ))}
              {focusedSkus.size > 1 ? (
                <button
                  type="button"
                  onClick={clearFocused}
                  className="ml-auto text-[10px] font-semibold text-zinc-500 hover:text-zinc-800"
                >
                  clear
                </button>
              ) : null}
            </div>

            {/* Optimize row — AI-generated proposal chips.
                Collapses between three states:
                  1. idle          → full-width "Optimize" showstopper button
                  2. loading       → full-width shimmer placeholder
                  3. has proposals → stacked chips from the model + refresh
             */}
            <div className="mt-2 flex flex-col gap-1.5">
              {isOptimizing ? (
                <div className="relative flex h-12 w-full items-center justify-center overflow-hidden rounded-xl bg-fuchsia-100">
                  <span className="absolute inset-0 animate-pulse bg-gradient-to-r from-fuchsia-100 via-fuchsia-200 to-fuchsia-100" />
                  <span className="relative flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.24em] text-fuchsia-700">
                    <svg
                      viewBox="0 0 16 16"
                      className="h-4 w-4 animate-spin"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M3.8 3.8l1.7 1.7M10.5 10.5l1.7 1.7M3.8 12.2l1.7-1.7M10.5 5.5l1.7-1.7" />
                    </svg>
                    Optimizing
                  </span>
                </div>
              ) : suggestedProposals.length > 0 ? (
                <>
                  {suggestedProposals.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => sendChip(p)}
                      disabled={inputDisabled}
                      title={p}
                      className="w-full truncate rounded-xl border border-fuchsia-300 bg-fuchsia-50 px-3 py-2 text-left text-xs font-medium leading-snug text-fuchsia-800 transition hover:border-fuchsia-500 hover:bg-fuchsia-100 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {p}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={runOptimize}
                    disabled={inputDisabled || isOptimizing}
                    className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-fuchsia-300 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.2em] text-fuchsia-600 transition hover:border-fuchsia-500 hover:bg-fuchsia-50 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <svg
                      viewBox="0 0 16 16"
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <path d="M3 8a5 5 0 1 0 1.6-3.7" />
                      <path d="M3 3.2V5.5h2.3" />
                    </svg>
                    Regenerate
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={runOptimize}
                  disabled={inputDisabled || isOptimizing}
                  className="group flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-fuchsia-600 px-4 text-sm font-semibold uppercase tracking-[0.18em] text-white shadow-lg shadow-fuchsia-500/30 transition hover:bg-fuchsia-700 hover:shadow-fuchsia-500/40 disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:text-zinc-500 disabled:shadow-none"
                >
                  <svg
                    viewBox="0 0 16 16"
                    className="h-5 w-5 transition-transform group-hover:rotate-45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M8 2v2.5M8 11.5V14M2 8h2.5M11.5 8H14M3.8 3.8l1.7 1.7M10.5 10.5l1.7 1.7M3.8 12.2l1.7-1.7M10.5 5.5l1.7-1.7" />
                  </svg>
                  Optimize
                  {focusedSkus.size > 0 ? (
                    <span className="ml-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-white/20 px-1.5 font-mono text-[10px] font-bold text-white">
                      {focusedSkus.size}
                    </span>
                  ) : null}
                </button>
              )}
              {optimizeError ? (
                <span className="text-[10px] text-red-600">{optimizeError}</span>
              ) : null}
            </div>

            {/* Input */}
            <form onSubmit={handleSendSubmit} className="mt-2 flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={inputDisabled}
                autoFocus
                placeholder={
                  pending
                    ? "Awaiting approval…"
                    : focusedSkus.size > 0
                      ? `Ask about ${focusedSkus.size} item${focusedSkus.size === 1 ? "" : "s"}…`
                      : "Ask the analyst…"
                }
                className="flex-1 rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-black placeholder:text-zinc-400 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-300 disabled:bg-zinc-100 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={inputDisabled || !input.trim()}
                className="rounded-xl bg-black px-3 py-2 text-sm font-semibold text-white transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-30"
              >
                Send
              </button>
            </form>

          </div>

          {/* ─────────── Approval prompt overlay ─────────── */}
          <div
            className={`absolute inset-0 flex flex-col px-5 pb-4 pt-3 transition-opacity duration-200 ${
              showApproval
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
            aria-hidden={showApproval ? undefined : true}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-600">
                Approval requested
              </div>
              <div className="mt-2 text-xl font-semibold leading-tight text-black">
                {pending?.itemName ?? ""}
              </div>
              <div className="font-mono text-[11px] text-zinc-500">
                {pending?.sku ?? ""}
              </div>
            </div>

            {/* Diff rows */}
            <div className="mt-3 flex flex-col gap-1.5 rounded-xl bg-zinc-100 px-3 py-3">
              {diffRows.length === 0 ? (
                <div className="text-sm text-zinc-500">(no field changes)</div>
              ) : (
                diffRows.map((row) => (
                  <div
                    key={row.key}
                    className="flex items-baseline justify-between gap-2"
                  >
                    <span className="font-mono text-[11px] uppercase tracking-wider text-zinc-500">
                      {row.label}
                    </span>
                    <span className="truncate text-sm text-zinc-800">
                      <span className="text-zinc-400 line-through">
                        {row.from}
                      </span>
                      <span className="mx-1 text-zinc-400">→</span>
                      <span className="font-semibold">{row.to}</span>
                    </span>
                  </div>
                ))
              )}
            </div>

            {/* Rationale */}
            <div className="mt-3 flex-1 overflow-y-auto rounded-xl bg-zinc-50 px-3 py-2 text-sm leading-snug text-zinc-700">
              {pending?.rationale ?? ""}
            </div>

            {/* Buttons */}
            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={!pending || submitting}
                onClick={() => void decideApproval(true)}
                className="w-full rounded-xl bg-black px-4 py-2.5 text-base font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
              >
                Approve
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={!pending || submitting}
                  onClick={() => void decideApproval(false)}
                  className="flex-1 rounded-xl border border-red-500/40 px-3 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-500/5 disabled:opacity-40"
                >
                  Reject
                </button>
                <button
                  type="button"
                  disabled={!hasApplied || submitting}
                  onClick={openChecklist}
                  className="flex-1 rounded-xl border border-fuchsia-500/60 px-3 py-2.5 text-sm font-semibold text-fuchsia-500 transition hover:bg-fuchsia-500/5 disabled:opacity-30"
                >
                  Undo…
                </button>
              </div>
            </div>
          </div>

          {/* ─────────── Undo checklist overlay ─────────── */}
          <div
            className={`absolute inset-0 flex flex-col px-5 pb-4 pt-3 transition-opacity duration-200 ${
              isChecklist
                ? "opacity-100"
                : "pointer-events-none opacity-0"
            }`}
            aria-hidden={isChecklist ? undefined : true}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-fuchsia-600">
                Roll back changes
              </div>
              <div className="mt-2 text-lg font-semibold leading-tight text-black">
                Select changes to undo
              </div>
            </div>

            <div className="mt-3 flex flex-1 flex-col gap-1.5 overflow-y-auto">
              {applied
                .slice()
                .reverse()
                .map((p) => {
                  const checked = selected.has(p.proposalId);
                  return (
                    <button
                      key={p.proposalId}
                      type="button"
                      onClick={() => toggleSelected(p.proposalId)}
                      className={`mb-1.5 flex w-full items-start gap-2 rounded-xl border px-3 py-2 text-left transition ${
                        checked
                          ? "border-fuchsia-500/70 bg-fuchsia-500/10"
                          : "border-zinc-200 bg-zinc-50 hover:bg-zinc-100"
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-4 w-4 items-center justify-center rounded border transition ${
                          checked
                            ? "border-fuchsia-500 bg-fuchsia-500 text-white"
                            : "border-zinc-400 bg-white"
                        }`}
                      >
                        {checked ? (
                          <svg
                            viewBox="0 0 12 12"
                            className="h-3 w-3"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M2 6.5 5 9.5 10 3" />
                          </svg>
                        ) : null}
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate text-sm font-semibold text-black">
                          {p.itemName}
                        </span>
                        <span className="truncate font-mono text-[10px] text-zinc-500">
                          {p.sku} · {formatAppliedTime(p.appliedAt)}
                        </span>
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="mt-3 flex flex-col gap-2">
              <button
                type="button"
                disabled={selected.size === 0 || submitting}
                onClick={() => void confirmRollback()}
                className="w-full rounded-xl bg-fuchsia-500 px-4 py-2.5 text-base font-semibold text-white transition hover:bg-fuchsia-600 disabled:opacity-40"
              >
                {selected.size > 0
                  ? `Roll back ${selected.size} change${selected.size === 1 ? "" : "s"}`
                  : "Select changes to roll back"}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={cancelChecklist}
                className="w-full rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
