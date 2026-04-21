"use client";

import type { MenuItem } from "@/lib/ops-data";

export type ApprovalEvidence = {
  orders: number;
  delivered: number;
  failed: number;
  cancelled: number;
  refunded: number;
  compensations: number;
  retries: number;
};

/**
 * Module-local event bus for the analyst demo. Three channels:
 *
 *  1. `pending` — the active approval prompt the agent is suspended on.
 *     Published by the chat pane, consumed by the phone. One at a time.
 *
 *  2. `appliedProposals` — running list of menu changes the agent has
 *     applied this session. Used by the phone to render the "Undo a
 *     previous change" affordance + checklist.
 *
 *  3. `rollbackDispatcher` — a callback registered by the chat pane so the
 *     phone can synthesize a user turn ("please roll back X, Y") without
 *     owning any network code.
 */

// ---------------------------------------------------------------------------
// 1. Pending approval prompt
// ---------------------------------------------------------------------------

export type PendingApprovalPrompt = {
  kind: "approval";
  token: string;
  proposalId: string;
  sku: string;
  itemName: string;
  /** Snapshot of the menu item before the patch. null if the sku is unknown. */
  current: MenuItem | null;
  /** Partial patch the agent wants to apply. */
  patch: Partial<MenuItem>;
  rationale: string;
  evidence?: ApprovalEvidence;
};

export type PendingInfoPrompt = {
  kind: "more-info";
  token: string;
  question: string;
  reason: string;
};

export type PendingPrompt = PendingApprovalPrompt | PendingInfoPrompt;

type PromptListener = (state: PendingPrompt | null) => void;

let currentPrompt: PendingPrompt | null = null;
const promptListeners = new Set<PromptListener>();

export function getPendingPrompt(): PendingPrompt | null {
  return currentPrompt;
}

export function setPendingPrompt(next: PendingPrompt | null) {
  currentPrompt = next;
  for (const l of promptListeners) l(currentPrompt);
}

export function subscribePendingPrompt(listener: PromptListener): () => void {
  promptListeners.add(listener);
  return () => {
    promptListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// 2. Applied-proposal history
// ---------------------------------------------------------------------------

export type AppliedProposal = {
  proposalId: string;
  sku: string;
  itemName: string;
  current?: MenuItem | null;
  patch: Partial<MenuItem>;
  menuItem?: MenuItem;
  evidence?: ApprovalEvidence;
  appliedAt: number;
};

type AppliedListener = (state: AppliedProposal[]) => void;

let appliedProposals: AppliedProposal[] = [];
const appliedListeners = new Set<AppliedListener>();

export function getAppliedProposals(): AppliedProposal[] {
  return appliedProposals;
}

export function setAppliedProposals(next: AppliedProposal[]) {
  appliedProposals = next;
  for (const l of appliedListeners) l(appliedProposals);
}

export function subscribeAppliedProposals(
  listener: AppliedListener,
): () => void {
  appliedListeners.add(listener);
  return () => {
    appliedListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// 3. Rollback dispatcher (phone -> chat pane send())
// ---------------------------------------------------------------------------

type RollbackDispatcher = (skus: string[]) => void;

let rollbackDispatcher: RollbackDispatcher | null = null;

export function registerRollbackDispatcher(
  fn: RollbackDispatcher | null,
): () => void {
  rollbackDispatcher = fn;
  return () => {
    if (rollbackDispatcher === fn) rollbackDispatcher = null;
  };
}

export function dispatchRollback(skus: string[]): boolean {
  if (!rollbackDispatcher || skus.length === 0) return false;
  rollbackDispatcher(skus);
  return true;
}

// ---------------------------------------------------------------------------
// 4. Send dispatcher (phone -> chat pane send())
//    The phone is the only UI surface the operator touches on stage, so every
//    user message originates there. The chat pane registers a send handler
//    that feeds the text into its own send(text) method.
// ---------------------------------------------------------------------------

type SendDispatcher = (text: string) => void;

let sendDispatcher: SendDispatcher | null = null;

export function registerSendDispatcher(
  fn: SendDispatcher | null,
): () => void {
  sendDispatcher = fn;
  return () => {
    if (sendDispatcher === fn) sendDispatcher = null;
  };
}

export function dispatchSend(text: string): boolean {
  const trimmed = text.trim();
  if (!sendDispatcher || !trimmed) return false;
  sendDispatcher(trimmed);
  return true;
}

// ---------------------------------------------------------------------------
// 5. Reset dispatcher (phone -> chat pane reset())
// ---------------------------------------------------------------------------

type ResetDispatcher = () => void;

let resetDispatcher: ResetDispatcher | null = null;

export function registerResetDispatcher(
  fn: ResetDispatcher | null,
): () => void {
  resetDispatcher = fn;
  return () => {
    if (resetDispatcher === fn) resetDispatcher = null;
  };
}

export function dispatchReset(): boolean {
  if (!resetDispatcher) return false;
  resetDispatcher();
  return true;
}

// ---------------------------------------------------------------------------
// 6. Operator events (phone -> chat pane)
//    When the operator taps Approve / Reject / "Undo…" on the phone, we push a
//    small, timestamped event so the chat pane can interleave it with the
//    agent's tool calls in one chronological column. Gives the audience a
//    continuous record of who acted when.
// ---------------------------------------------------------------------------

export type OperatorEventKind =
  | "approve"
  | "reject"
  | "more-info"
  | "undo-requested"
  | "lucky";

export type OperatorEvent = {
  id: string;
  kind: OperatorEventKind;
  label: string;
  at: number;
};

type OperatorEventListener = (events: OperatorEvent[]) => void;

let operatorEvents: OperatorEvent[] = [];
const operatorEventListeners = new Set<OperatorEventListener>();

export function getOperatorEvents(): OperatorEvent[] {
  return operatorEvents;
}

export function pushOperatorEvent(event: Omit<OperatorEvent, "id" | "at">): OperatorEvent {
  const full: OperatorEvent = {
    id: `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    ...event,
  };
  operatorEvents = [...operatorEvents, full];
  for (const l of operatorEventListeners) l(operatorEvents);
  return full;
}

export function clearOperatorEvents(): void {
  if (operatorEvents.length === 0) return;
  operatorEvents = [];
  for (const l of operatorEventListeners) l(operatorEvents);
}

export function subscribeOperatorEvents(
  listener: OperatorEventListener,
): () => void {
  operatorEventListeners.add(listener);
  return () => {
    operatorEventListeners.delete(listener);
  };
}

// ---------------------------------------------------------------------------
// 7. Streaming status (chat pane -> phone)
//    The phone disables its input / buttons while the agent is streaming. We
//    publish the flag on every transition.
// ---------------------------------------------------------------------------

type StreamingListener = (isStreaming: boolean) => void;

let streaming = false;
const streamingListeners = new Set<StreamingListener>();

export function getIsStreaming(): boolean {
  return streaming;
}

export function setIsStreaming(next: boolean): void {
  if (streaming === next) return;
  streaming = next;
  for (const l of streamingListeners) l(streaming);
}

export function subscribeIsStreaming(listener: StreamingListener): () => void {
  streamingListeners.add(listener);
  return () => {
    streamingListeners.delete(listener);
  };
}
