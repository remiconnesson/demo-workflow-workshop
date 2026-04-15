"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { DebugDrawer } from "@/app/_components/debug-drawer";
import { getSlideNav } from "./config";
import { WorkflowMark } from "./_components/workflow-mark";

export default function SlidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const slug = pathname.split("/").pop() ?? "";
  const { current, prev, next, total } = getSlideNav(slug);
  const [showNotes, setShowNotes] = useState(false);
  const [runInfo, setRunInfo] = useState<{ runId: string; orderId: string } | null>(null);

  // Listen for workflow run events from child slides
  useEffect(() => {
    const onRun = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.runId) {
        setRunInfo({ runId: detail.runId, orderId: detail.orderId ?? null });
      }
    };
    window.addEventListener("slide:workflow-started", onRun);
    return () => window.removeEventListener("slide:workflow-started", onRun);
  }, []);

  // Clear run info on slide change
  useEffect(() => {
    setRunInfo(null);
  }, [slug]);

  useEffect(() => {
    console.info("[slides] open", { slug });
  }, [slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        router.push(`/slides/${next.slug}`);
      }
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        router.push(`/slides/${prev.slug}`);
      }
      if (e.key === "Home") {
        e.preventDefault();
        router.push("/slides/title");
      }
      if (e.key === "r") {
        e.preventDefault();
        console.info("[slides] run_current", { slug });
        window.dispatchEvent(
          new CustomEvent("slide:run", { detail: { slug } }),
        );
      }
      if (e.key === "R") {
        e.preventDefault();
        console.info("[slides] reset_current", { slug });
        window.dispatchEvent(
          new CustomEvent("slide:reset", { detail: { slug } }),
        );
      }
      if (e.key === "n") {
        e.preventDefault();
        setShowNotes((s) => !s);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white font-sans">
      {children}

      {slug !== "title" && (
        <div className="pointer-events-none fixed top-8 right-8 z-50">
          <WorkflowMark size={32} className="text-white/70" />
        </div>
      )}

      {/* speaker notes overlay */}
      {showNotes && current?.notes && (
        <div className="fixed inset-x-0 bottom-0 z-50 max-h-[40vh] overflow-y-auto border-t border-white/10 bg-zinc-950/95 px-10 py-6 backdrop-blur font-mono text-base leading-relaxed text-zinc-300">
          <div className="flex items-center justify-between mb-4">
            <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Speaker Notes
            </span>
            <button
              onClick={() => setShowNotes(false)}
              className="text-sm text-zinc-500 hover:text-white"
            >
              Close (n)
            </button>
          </div>
          <pre className="whitespace-pre-wrap">{current.notes}</pre>
        </div>
      )}

      {/* navigation bar */}
      <div className="fixed bottom-6 right-8 z-50 flex items-center gap-0 rounded-full border border-white/10 bg-zinc-950/80 backdrop-blur font-mono text-lg select-none">
        {/* left arrow (clickable) */}
        <button
          onClick={() => prev && router.push(`/slides/${prev.slug}`)}
          disabled={!prev}
          className={`px-4 py-2 rounded-l-full transition-colors ${
            prev
              ? "text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              : "text-zinc-800 cursor-default"
          }`}
        >
          &larr;
        </button>

        {/* slide number */}
        <span className="px-2 py-2 text-zinc-500">
          {current?.number ?? "?"} / {total}
        </span>

        {/* right arrow (clickable) */}
        <button
          onClick={() => next && router.push(`/slides/${next.slug}`)}
          disabled={!next}
          className={`px-4 py-2 rounded-r-full transition-colors ${
            next
              ? "text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer"
              : "text-zinc-800 cursor-default"
          }`}
        >
          &rarr;
        </button>
      </div>

      {/* slide title + notes hint + debug toggle */}
      <div className="fixed bottom-6 left-8 z-50 flex items-center gap-4 font-mono text-lg select-none">
        <span className="text-zinc-600">{current?.title}</span>
        <button
          onClick={() => setShowNotes((s) => !s)}
          className={`rounded border px-2 py-0.5 text-sm transition-colors ${
            showNotes
              ? "border-white/20 text-zinc-300"
              : "border-white/10 text-zinc-600 hover:text-zinc-400"
          }`}
        >
          n
        </button>
      </div>

      {/* debug drawer — always open when a run is active */}
      {runInfo && (
        <div className="pointer-events-none fixed inset-x-0 bottom-16 z-50 flex justify-center px-8">
          <div className="pointer-events-auto">
            <DebugDrawer runId={runInfo.runId} orderId={runInfo.orderId} />
          </div>
        </div>
      )}
    </div>
  );
}
