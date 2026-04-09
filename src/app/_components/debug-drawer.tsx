"use client";

import { createPortal } from "react-dom";
import { useEffect, useRef, useState } from "react";
import type { OrderEvent } from "@/workflows/place-order";

const WORKFLOW_WEB_PORT = 3456;

function DashboardModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  const [reachable, setReachable] = useState<boolean | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Probe the web UI to see if it's running
  useEffect(() => {
    fetch(`http://localhost:${WORKFLOW_WEB_PORT}/`, { mode: "no-cors" })
      .then(() => setReachable(true))
      .catch(() => setReachable(false));
  }, []);

  return createPortal(
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/95 backdrop-blur-sm"
      onClick={onClose}
    >
      <div className="flex items-center justify-between px-8 py-4 border-b border-white/10">
        <span className="font-mono text-lg text-zinc-400 truncate">
          {url}
        </span>
        <button
          onClick={onClose}
          className="rounded-lg border border-white/10 px-5 py-2 text-lg font-semibold text-zinc-300 hover:border-white/30 hover:text-white transition-colors"
        >
          Close{" "}
          <kbd className="ml-2 rounded bg-white/10 px-2 py-0.5 text-sm">
            Esc
          </kbd>
        </button>
      </div>
      {reachable === false ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-8">
          <div className="text-4xl font-semibold text-zinc-300">
            Workflow Web UI not running
          </div>
          <p className="text-xl text-zinc-500 text-center max-w-xl">
            Start the observability server in a separate terminal:
          </p>
          <pre className="rounded-xl border border-white/10 bg-zinc-950 px-8 py-5 font-mono text-2xl text-zinc-300">
            npx workflow web --noBrowser
          </pre>
          <p className="text-lg text-zinc-600">
            Then click the <span className="font-mono text-zinc-400">$</span> button again to open this panel.
          </p>
        </div>
      ) : (
        <iframe
          src={url}
          className="flex-1 w-full border-0"
          onClick={(e) => e.stopPropagation()}
          title="Workflow Web UI"
        />
      )}
    </div>,
    document.body,
  );
}

function formatEventLine(event: OrderEvent): { kind: string; msg: string } {
  switch (event.type) {
    case "step_running":
      return { kind: "RUN", msg: `${event.step} \u00b7 ${event.label}` };
    case "step_succeeded":
      return { kind: "OK ", msg: `${event.step}${event.detail ? ` \u00b7 ${event.detail}` : ""}` };
    case "step_failed":
      return { kind: "ERR", msg: `${event.step} \u00b7 ${event.error}` };
    case "step_skipped":
      return { kind: "SKP", msg: event.step };
    case "waiting_for_hook":
      return { kind: "WAI", msg: `${event.step} \u00b7 awaiting ${event.token}` };
    case "hook_resolved":
      return { kind: "HOK", msg: `${event.step}${event.detail ? ` \u00b7 ${event.detail}` : ""}` };
    case "compensation_pushed":
      return { kind: "CMP", msg: `pushed ${event.action} (for ${event.forStep})` };
    case "compensating":
      return { kind: "CMP", msg: `running ${event.action}` };
    case "compensated":
      return { kind: "CMP", msg: `done ${event.action}` };
    case "log":
      return { kind: "LOG", msg: event.message };
    case "done":
      return { kind: "END", msg: `${event.status} \u00b7 ${event.orderId}` };
  }
}

function kindColor(kind: string): string {
  switch (kind) {
    case "OK ": return "text-emerald-400";
    case "ERR": return "text-red-400";
    case "WAI": case "HOK": return "text-amber-400";
    case "CMP": return "text-fuchsia-400";
    case "RUN": return "text-sky-400";
    case "END": return "text-white";
    default: return "text-zinc-500";
  }
}

export function DebugDrawer({
  runId,
  orderId,
}: {
  runId: string | null;
  orderId: string | null;
}) {
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);

  // Listen for events broadcast from LiveOrderConceptLab
  useEffect(() => {
    const onEvents = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.events) setEvents(detail.events);
    };
    window.addEventListener("slide:workflow-events", onEvents);
    return () => window.removeEventListener("slide:workflow-events", onEvents);
  }, []);

  // Auto-scroll event feed
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight });
  }, [events.length]);

  if (!runId) return null;

  const command = `npx workflow web ${runId}`;
  const webUiUrl = `http://localhost:${WORKFLOW_WEB_PORT}/run/${runId}`;

  return (
    <>
      {dashboardUrl && (
        <DashboardModal
          url={dashboardUrl}
          onClose={() => setDashboardUrl(null)}
        />
      )}
      <div className="rounded-lg border border-white/10 bg-zinc-950/95 px-5 py-3 backdrop-blur w-full max-w-3xl">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDashboardUrl(webUiUrl)}
            className="font-mono text-lg text-zinc-400 hover:text-white transition-colors truncate"
            title="Open workflow web UI"
          >
            <span className="text-zinc-600">$</span> {command}
          </button>
          {orderId && (
            <span className="font-mono text-sm text-zinc-600 shrink-0">
              {orderId}
            </span>
          )}
        </div>
        {/* Event feed — presenter-only, hidden from audience */}
        {events.length > 0 && (
          <div
            ref={feedRef}
            className="mt-3 border-t border-white/5 pt-3 font-mono text-sm max-h-[200px] overflow-y-auto"
          >
            {events.map((event, i) => {
              const line = formatEventLine(event);
              return (
                <div key={i} className="flex gap-3 py-0.5">
                  <span className={`w-8 shrink-0 font-semibold ${kindColor(line.kind)}`}>
                    {line.kind}
                  </span>
                  <span className="text-zinc-400">{line.msg}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
