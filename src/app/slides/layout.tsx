"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { DebugDrawer } from "@/app/_components/debug-drawer";
import { getSlideNav, SLIDES, type SlideInfo } from "./config";
import { WorkflowMark } from "./_components/workflow-mark";
import { SlidesDebugProvider } from "./_components/slides-debug-context";

type RailTone =
  | "zinc"
  | "sky"
  | "amber"
  | "fuchsia"
  | "emerald"
  | "amber-fuchsia";

type AudienceRailInfo = {
  family: string;
  beat: string;
  tone: RailTone;
  proof?: string;
};

const THREE_BEATS = ["Demo", "Code", "Pattern"] as const;

const RAIL_TONE_CLASS: Record<
  RailTone,
  {
    dot: string;
    line: string;
    proof: string;
  }
> = {
  zinc: {
    dot: "bg-zinc-500",
    line: "bg-white/35",
    proof: "border-white/10 bg-white/5 text-zinc-300",
  },
  sky: {
    dot: "bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.55)]",
    line: "bg-sky-400",
    proof: "border-sky-400/30 bg-sky-500/10 text-sky-300",
  },
  amber: {
    dot: "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]",
    line: "bg-amber-400",
    proof: "border-amber-400/30 bg-amber-500/10 text-amber-300",
  },
  fuchsia: {
    dot: "bg-fuchsia-400 shadow-[0_0_18px_rgba(232,121,249,0.55)]",
    line: "bg-fuchsia-400",
    proof: "border-fuchsia-400/30 bg-fuchsia-500/10 text-fuchsia-300",
  },
  emerald: {
    dot: "bg-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.55)]",
    line: "bg-emerald-400",
    proof: "border-emerald-400/30 bg-emerald-500/10 text-emerald-300",
  },
  "amber-fuchsia": {
    dot: "bg-gradient-to-r from-amber-400 to-fuchsia-400 shadow-[0_0_18px_rgba(232,121,249,0.45)]",
    line: "bg-gradient-to-r from-amber-400 to-fuchsia-400",
    proof:
      "border-fuchsia-400/30 bg-gradient-to-r from-amber-500/10 to-fuchsia-500/10 text-white",
  },
};

function beatForTriplet(number: number, start: number) {
  return THREE_BEATS[number - start] ?? "Demo";
}

function getAudienceRailInfo(
  slide: SlideInfo | null,
): AudienceRailInfo | null {
  if (!slide || slide.slug === "title") return null;
  const n = slide.number;
  if (n >= 2 && n <= 5) {
    const beatByNumber: Record<number, string> = {
      2: "Happy path",
      3: "Starting code",
      4: "Three properties",
      5: "Workshop map",
    };
    return {
      family: "Setup",
      beat: beatByNumber[n] ?? slide.title,
      tone: "zinc",
    };
  }
  if (n >= 6 && n <= 8) {
    return { family: "Stable", beat: beatForTriplet(n, 6), tone: "sky" };
  }
  if (n >= 9 && n <= 11) {
    return { family: "Suspendable", beat: beatForTriplet(n, 9), tone: "amber" };
  }
  if (n >= 12 && n <= 14) {
    return {
      family: "Undoable",
      beat: beatForTriplet(n, 12),
      tone: "fuchsia",
    };
  }
  if (n === 15) {
    return {
      family: "Pivot",
      beat: "Workflows → Agents",
      tone: "zinc",
    };
  }
  if (n >= 16 && n <= 18) {
    return {
      family: "Hello World",
      proof: "Run survives refresh",
      beat: beatForTriplet(n, 16),
      tone: "emerald",
    };
  }
  if (n >= 19 && n <= 21) {
    return {
      family: "Autonomous",
      proof: "Forever loop",
      beat: beatForTriplet(n, 19),
      tone: "sky",
    };
  }
  if (n >= 22 && n <= 24) {
    return {
      family: "Optimize",
      proof: "Approval + Undo",
      beat: beatForTriplet(n, 22),
      tone: "amber-fuchsia",
    };
  }
  if (n === 25) {
    return {
      family: "Close",
      proof: "Workflow → Agent",
      beat: "Mirror",
      tone: "zinc",
    };
  }
  if (n === 26) {
    return {
      family: "Close",
      beat: "Original function",
      tone: "emerald",
    };
  }
  const closerBeatByNumber: Record<number, AudienceRailInfo> = {
    27: { family: "Close", proof: "1 / 6", beat: "Step", tone: "sky" },
    28: {
      family: "Close",
      proof: "2 / 6",
      beat: "Idempotency",
      tone: "sky",
    },
    29: { family: "Close", proof: "3 / 6", beat: "Hook", tone: "amber" },
    30: {
      family: "Close",
      proof: "4 / 6",
      beat: "Sleep + Race",
      tone: "amber",
    },
    31: {
      family: "Close",
      proof: "5 / 6",
      beat: "Compensation",
      tone: "fuchsia",
    },
    32: { family: "Close", proof: "6 / 6", beat: "Replay", tone: "sky" },
  };
  if (closerBeatByNumber[n]) return closerBeatByNumber[n];
  if (n === 33) {
    return { family: "Close", beat: "Ship it", tone: "zinc" };
  }
  return {
    family: slide.title,
    beat: "",
    tone: "zinc",
  };
}

export default function SlidesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const slug = pathname.replace(/^\/slides\//, "");
  const { current, prev, next, total } = getSlideNav(slug);
  const railInfo = getAudienceRailInfo(current);
  const railTone = railInfo ? RAIL_TONE_CLASS[railInfo.tone] : null;
  const progressPercent =
    current && total > 0 ? `${(current.number / total) * 100}%` : "0%";

  const [runInfo, setRunInfo] = useState<{ runId: string; orderId: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [debugOpen, setDebugOpen] = useState(false);
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

  // Close picker and debug drawer on slide change
  useEffect(() => {
    setPickerOpen(false);
    setDebugOpen(false);
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
      const isArrowNavKey =
        e.key === "ArrowRight" ||
        e.key === "ArrowDown" ||
        e.key === "ArrowLeft" ||
        e.key === "ArrowUp";
      const hasTextSelection =
        (target instanceof HTMLInputElement ||
          target instanceof HTMLTextAreaElement) &&
        typeof target.selectionStart === "number" &&
        typeof target.selectionEnd === "number" &&
        target.selectionStart !== target.selectionEnd;
      if (isEditable) {
        if (isArrowNavKey && !hasTextSelection) {
          target?.blur();
        } else {
          return;
        }
      }

      if (e.metaKey || e.ctrlKey || e.altKey) return;

      if ((e.key === "ArrowRight" || e.key === "ArrowDown") && next) {
        e.preventDefault();
        const consumed = !window.dispatchEvent(
          new CustomEvent("slide:nav-forward", { cancelable: true, detail: { slug } }),
        );
        if (consumed) return;
        router.push(`/slides/${next.slug}`);
      }
      if ((e.key === "ArrowLeft" || e.key === "ArrowUp") && prev) {
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
      if (e.key === "D" && e.shiftKey) {
        e.preventDefault();
        setDebugOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prev, next, router, slug]);

  return (
    <SlidesDebugProvider value={debugOpen}>
    <div className="relative h-screen w-screen overflow-hidden bg-black text-white font-sans">
      {children}

      {slug !== "title" && slug !== "close" && (
        <div className="pointer-events-none fixed top-8 right-8 z-50">
          <WorkflowMark size={32} className="text-white/70" />
        </div>
      )}

      {railInfo && railTone && (
        <>
          <div
            aria-hidden
            className="pointer-events-none fixed inset-x-0 top-0 z-50 h-[2px] bg-white/[0.06]"
          >
            <div
              className={`h-full transition-[width] duration-300 ease-out ${railTone.line}`}
              style={{ width: progressPercent }}
            />
          </div>
          <div className="pointer-events-none fixed left-1/2 top-4 z-50 flex max-w-[calc(100vw-12rem)] -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-black/45 px-5 py-2 shadow-[0_18px_60px_rgba(0,0,0,0.38)] backdrop-blur-md">
            <span
              aria-hidden
              className={`h-2.5 w-2.5 shrink-0 rounded-full ${railTone.dot}`}
            />
            <span className="whitespace-nowrap text-xl font-semibold leading-none text-zinc-100">
              {railInfo.family}
            </span>
            {railInfo.proof ? (
              <>
                <span aria-hidden className="h-5 w-px bg-white/15" />
                <span
                  className={`whitespace-nowrap rounded-full border px-3.5 py-1.5 font-mono text-base font-semibold leading-none tracking-tight ${railTone.proof}`}
                >
                  {railInfo.proof}
                </span>
              </>
            ) : null}
            {railInfo.beat ? (
              <>
                <span aria-hidden className="h-5 w-px bg-white/15" />
                <span className="whitespace-nowrap text-lg font-medium leading-none text-zinc-400">
                  {railInfo.beat}
                </span>
              </>
            ) : null}
          </div>
        </>
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


      {/* debug drawer — opt-in via Shift+D when a run is active */}
      {debugOpen && runInfo && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-8">
          <div className="pointer-events-auto">
            <DebugDrawer runId={runInfo.runId} orderId={runInfo.orderId} />
          </div>
        </div>
      )}
    </div>
    </SlidesDebugProvider>
  );
}
