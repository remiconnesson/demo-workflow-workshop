"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

const VERCEL_DASHBOARD_BASE =
  "https://vercel.com/vercel-labs/2026-04-08-12-09-food-delivery";

function DashboardModal({
  url,
  onClose,
}: {
  url: string;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

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
      <iframe
        src={url}
        className="flex-1 w-full border-0"
        onClick={(e) => e.stopPropagation()}
        title="Vercel Workflow Dashboard"
      />
    </div>,
    document.body,
  );
}

export function DebugDrawer({
  runId,
  orderId,
}: {
  runId: string | null;
  orderId: string | null;
}) {
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null);

  if (!runId) return null;

  const command = `npx workflow runs inspect ${runId}`;
  const url = `${VERCEL_DASHBOARD_BASE}/workflow/runs/${runId}`;

  return (
    <>
      {dashboardUrl && (
        <DashboardModal
          url={dashboardUrl}
          onClose={() => setDashboardUrl(null)}
        />
      )}
      <div className="rounded-lg border border-white/10 bg-zinc-950/95 px-5 py-3 backdrop-blur">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setDashboardUrl(url)}
            className="font-mono text-lg text-zinc-400 hover:text-white transition-colors truncate"
            title="Open Vercel Workflow dashboard"
          >
            <span className="text-zinc-600">$</span> {command}
          </button>
          {orderId && (
            <span className="font-mono text-sm text-zinc-600 shrink-0">
              {orderId}
            </span>
          )}
        </div>
      </div>
    </>
  );
}
