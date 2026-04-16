"use client";

import { useEffect, useState } from "react";
import {
  getPendingApproval,
  subscribePendingApproval,
  type PendingApproval,
} from "./analyst-approval-bus";

export function AnalystApprovalPhone() {
  const [pending, setPending] = useState<PendingApproval | null>(() =>
    getPendingApproval(),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => subscribePendingApproval(setPending), []);

  const decide = async (approved: boolean) => {
    if (!pending || submitting) return;
    setSubmitting(true);
    const body: { token: string; approved: boolean; reason?: string } = {
      token: pending.token,
      approved,
    };
    if (!approved) body.reason = "Operator rejected on stage";
    console.log("[approval-phone] POST /api/agent/approve", body);
    try {
      const res = await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      console.log("[approval-phone] response", res.status, json);
    } catch (err) {
      console.error("[approval-phone] fetch threw", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full w-full items-center justify-center">
      {/* Phone frame */}
      <div
        className={`relative flex flex-col overflow-hidden rounded-[56px] border-[14px] border-black bg-white transition-shadow duration-500 ${
          pending
            ? "shadow-[0_0_50px_rgba(251,191,36,0.5)]"
            : ""
        }`}
        style={{ width: 280, height: 560 }}
      >
        {/* Dynamic island */}
        <div className="absolute left-1/2 top-3 h-6 w-24 -translate-x-1/2 rounded-full bg-black" />

        {/* Status bar spacer */}
        <div className="h-10" />

        {/* Content */}
        <div className="relative flex flex-1 flex-col px-5 py-4">
          {/* Empty state */}
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center px-6 text-center transition-opacity duration-200 ${
              pending ? "pointer-events-none opacity-0" : "opacity-100"
            }`}
            aria-hidden={pending ? true : undefined}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.28em] text-zinc-400">
              Operator
            </div>
            <div className="mt-3 text-lg text-zinc-500">
              No pending approvals
            </div>
          </div>

          {/* Active state */}
          <div
            className={`flex flex-1 flex-col gap-4 transition-opacity duration-200 ${
              pending ? "opacity-100" : "opacity-0"
            }`}
            aria-hidden={pending ? undefined : true}
          >
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-amber-600">
                Approval requested
              </div>
              <div className="mt-2 text-2xl font-semibold leading-tight text-black">
                {pending?.summary ?? ""}
              </div>
            </div>
            <div className="rounded-xl bg-zinc-100 px-4 py-3 text-base leading-snug text-zinc-700">
              {pending?.rationale ?? ""}
            </div>
            <div className="mt-auto flex flex-col gap-3">
              <button
                type="button"
                disabled={!pending || submitting}
                onClick={() => void decide(true)}
                className="w-full rounded-xl bg-black px-4 py-3 text-lg font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={!pending || submitting}
                onClick={() => void decide(false)}
                className="w-full rounded-xl border border-red-500/40 px-4 py-3 text-lg font-semibold text-red-500 transition hover:bg-red-500/5 disabled:opacity-40"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
