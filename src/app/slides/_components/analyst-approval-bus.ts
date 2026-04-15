"use client";

/**
 * Tiny module-local event bus that lets the analyst chat pane and the
 * approval phone coordinate without prop drilling. The chat pane publishes
 * pending approval requests; the phone subscribes and publishes decisions.
 *
 * Deliberately minimal — one approval at a time is all the demo needs.
 */

export type PendingApproval = {
  token: string;
  proposalId: string;
  summary: string;
  rationale: string;
};

type Listener = (state: PendingApproval | null) => void;

let current: PendingApproval | null = null;
const listeners = new Set<Listener>();

export function getPendingApproval(): PendingApproval | null {
  return current;
}

export function setPendingApproval(next: PendingApproval | null) {
  current = next;
  for (const l of listeners) l(current);
}

export function subscribePendingApproval(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
