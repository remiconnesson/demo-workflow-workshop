"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DebugDrawer } from "@/app/_components/debug-drawer";
import { getSlideNav, SLIDES } from "./config";
import { WorkflowMark } from "./_components/workflow-mark";

export default function SlidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const slug = pathname.replace(/^\/slides\//, "");
  const { current, prev, next, total } = getSlideNav(slug);

  const [runInfo, setRunInfo] = useState<{ runId: string; orderId: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

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

  // Close picker on slide change
  useEffect(() => {
    setPickerOpen(false);
  }, [slug]);

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const onClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [pickerOpen]);

  // Prefetch all slide routes on mount so dev server compiles them eagerly
  useEffect(() => {
    for (const slide of SLIDES) {
      router.prefetch(`/slides/${slide.slug}`);
    }
  }, [router]);

  useEffect(() => {
    console.info("[slides] open", { slug });
  }, [slug]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setPickerOpen(false);
      }

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isEditable =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        !!target?.isContentEditable;
      if (isEditable) return;

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        const consumed = !window.dispatchEvent(
          new CustomEvent("slide:nav-forward", { cancelable: true, detail: { slug } }),
        );
        if (consumed) return;
        router.push(`/slides/${next.slug}`);
      }
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        const consumed = !window.dispatchEvent(
          new CustomEvent("slide:nav-back", { cancelable: true, detail: { slug } }),
        );
        if (consumed) return;
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
      if (e.key === "g") {
        e.preventDefault();
        setPickerOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router, slug]);

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white font-sans">
      {children}

      {slug !== "title" && (
        <div className="pointer-events-none fixed top-8 right-8 z-50">
          <WorkflowMark size={32} className="text-white/70" />
        </div>
      )}

      {current?.breadcrumb && (
        <div className="pointer-events-none fixed top-8 left-8 z-50">
          <span className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
            {current.breadcrumb}
          </span>
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

        {/* slide number — click to open picker */}
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="px-2 py-2 text-zinc-500 hover:text-white transition-colors cursor-pointer"
          >
            {current?.number ?? "?"} / {total}
          </button>

          {/* slide picker popover */}
          {pickerOpen && (
            <div className="absolute bottom-full mb-2 right-1/2 translate-x-1/2 w-72 max-h-[70vh] overflow-y-auto rounded-xl border border-white/10 bg-zinc-950/95 backdrop-blur shadow-2xl">
              <div className="p-2">
                {SLIDES.map((slide) => (
                  <button
                    key={slide.slug}
                    onClick={() => {
                      router.push(`/slides/${slide.slug}`);
                      setPickerOpen(false);
                    }}
                    className={`w-full text-left px-3 py-2 rounded-lg text-base font-mono transition-colors flex items-center gap-3 cursor-pointer ${
                      slide.slug === slug
                        ? "bg-white/10 text-white"
                        : "text-zinc-400 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    <span className="text-zinc-600 w-6 text-right shrink-0">
                      {slide.number}
                    </span>
                    <span className="truncate">{slide.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

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


      {/* debug drawer — always open when a run is active */}
      {runInfo && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-8">
          <div className="pointer-events-auto">
            <DebugDrawer runId={runInfo.runId} orderId={runInfo.orderId} />
          </div>
        </div>
      )}
    </div>
  );
}
