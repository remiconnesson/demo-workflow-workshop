"use client";

import { useEffect, useRef, useState } from "react";
import type { ReportEntry } from "@/lib/ops-data";
import { WorkflowMark } from "./workflow-mark";

type ObserverReportPaneProps = {
  autostart?: boolean;
};

/**
 * Scripted cadence for the stage demo. Each entry fades in at the top of
 * the report stack; the oldest fades out so the rendered slot count is
 * fixed (see MAX_VISIBLE) and the layout never shifts.
 *
 * Note: this component POSTs /api/agent/observer/start on mount so the
 * real durable run is live in the background (for the "kill the server,
 * report resumes" beat). The visible entries are scripted to guarantee
 * readable cadence for the 30-foot rule — UIMessageChunk parsing for
 * live output was deferred to avoid on-stage flake.
 */
const SCRIPT: Array<Omit<ReportEntry, "at"> & { delayMs: number }> = [
  {
    delayMs: 1600,
    kind: "metric",
    text: "Scanned last 25 orders.",
    data: { total: 25, window: "4m" },
  },
  {
    delayMs: 2200,
    kind: "metric",
    text: "Detected 3 slow waits over 7s.",
    data: { slow_waits: 3, threshold_ms: 7000 },
  },
  {
    delayMs: 2600,
    kind: "metric",
    text: "Saw 2 retries above threshold.",
    data: { high_retries: 2 },
  },
  {
    delayMs: 2400,
    kind: "summary",
    text: "Compensations fired 8 times this window.",
    data: { compensations: 8 },
  },
  {
    delayMs: 2800,
    kind: "flag",
    text: "r-sushi-zen cancelled 3 times in a row — flagging.",
    data: { restaurant: "r-sushi-zen", severity: "critical" },
  },
  {
    delayMs: 2400,
    kind: "summary",
    text: "Window closed. Sleeping 30s before next loop.",
    data: { next_loop_in: "30s" },
  },
  {
    delayMs: 2600,
    kind: "metric",
    text: "Resumed after restart. Picking up from last tool call.",
    data: { resumed: true },
  },
];

const MAX_VISIBLE = 4;
const SLOT_HEIGHT_PX = 120;

type VisibleEntry = {
  id: number;
  entry: ReportEntry;
};

const KIND_STYLES: Record<
  ReportEntry["kind"],
  { label: string; pill: string }
> = {
  metric: {
    label: "METRIC",
    pill: "border-sky-400/40 bg-sky-500/10 text-sky-300",
  },
  flag: {
    label: "FLAG",
    pill: "border-amber-400/40 bg-amber-500/10 text-amber-300",
  },
  summary: {
    label: "SUMMARY",
    pill: "border-fuchsia-400/40 bg-fuchsia-500/10 text-fuchsia-300",
  },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function ObserverReportPane({
  autostart = true,
}: ObserverReportPaneProps) {
  const [visible, setVisible] = useState<VisibleEntry[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "done">("idle");
  const nextIdRef = useRef(1);

  // Fire-and-forget kickoff of the real durable run. We do not wait on it
  // or read its output — the scripted cadence below drives the stage
  // visual. The real run exists so the durability beat (kill the server,
  // report resumes) has something to resume from.
  useEffect(() => {
    if (!autostart) return;
    let cancelled = false;
    fetch("/api/agent/observer/start", { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null)
      .then(() => {
        if (cancelled) return;
      });
    return () => {
      cancelled = true;
    };
  }, [autostart]);

  useEffect(() => {
    if (!autostart) return;
    let cancelled = false;
    setStatus("running");

    let i = 0;
    const pump = () => {
      if (cancelled) return;
      if (i >= SCRIPT.length) {
        setStatus("done");
        return;
      }
      const step = SCRIPT[i];
      i += 1;
      window.setTimeout(() => {
        if (cancelled) return;
        const id = nextIdRef.current++;
        const entry: ReportEntry = {
          at: new Date().toISOString(),
          kind: step.kind,
          text: step.text,
          data: step.data,
        };
        setVisible((prev) => {
          const next = [{ id, entry }, ...prev];
          return next.slice(0, MAX_VISIBLE);
        });
        pump();
      }, step.delayMs);
    };
    pump();

    return () => {
      cancelled = true;
    };
  }, [autostart]);

  const statusPill =
    status === "done"
      ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-300"
      : "border-amber-400/40 bg-amber-500/10 text-amber-300 animate-pulse";
  const statusLabel =
    status === "done" ? "REPORT COMPLETE" : "WATCHING";

  // Pad visible list to MAX_VISIBLE so slots are always reserved (CLS = 0).
  const slots: Array<VisibleEntry | null> = [];
  for (let i = 0; i < MAX_VISIBLE; i++) {
    slots.push(visible[i] ?? null);
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex w-[560px] flex-col overflow-hidden rounded-2xl border border-white/10 bg-zinc-950">
        <div className="flex items-center justify-between border-b border-white/10 px-8 py-6">
          <div className="flex items-center gap-3">
            <WorkflowMark size={22} className="text-white" />
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Observer
            </span>
          </div>
          <div
            className={`rounded-full border px-4 py-1.5 font-mono text-xs font-semibold tracking-[0.2em] ${statusPill}`}
          >
            {statusLabel}
          </div>
        </div>

        <div className="flex flex-col gap-3 px-6 py-6">
          {slots.map((slot, idx) => (
            <div
              key={slot?.id ?? `empty-${idx}`}
              style={{ height: SLOT_HEIGHT_PX }}
              className={`flex flex-col justify-center overflow-hidden rounded-xl border border-white/5 bg-black/40 px-5 transition-opacity duration-500 ${
                slot ? "opacity-100" : "opacity-0"
              }`}
            >
              {slot ? (
                <>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-base text-zinc-500">
                      {formatTime(slot.entry.at)}
                    </span>
                    <span
                      className={`rounded-full border px-2.5 py-0.5 font-mono text-[11px] font-semibold tracking-[0.18em] ${
                        KIND_STYLES[slot.entry.kind].pill
                      }`}
                    >
                      {KIND_STYLES[slot.entry.kind].label}
                    </span>
                  </div>
                  <div className="mt-2 text-xl leading-snug text-zinc-100">
                    {slot.entry.text}
                  </div>
                  {slot.entry.data ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {Object.entries(slot.entry.data).map(([k, v]) => (
                        <span
                          key={k}
                          className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[11px] text-zinc-400"
                        >
                          {k}: {String(v)}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
