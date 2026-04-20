"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  SENTINEL_VARIANT_ORDER,
  SENTINEL_VARIANTS,
  type SentinelVariantSlug,
} from "../../_data/sentinel-variants";
import {
  CreditCard,
  Siren,
  ShieldAlert,
  GitPullRequest,
  Radar,
} from "lucide-react";

// ------------------------------------------------------------------
// Per-variant visual lookups — local to the picker. The variant data
// is metadata-only now; each bespoke demo owns its own visual vocab.
// ------------------------------------------------------------------

type PickerLook = {
  icon: React.ReactNode;
  // tailwind class strings (must be static so JIT keeps them)
  border: string;
  dot: string;
  text: string;
  bg: string;
};

const LOOK: Record<SentinelVariantSlug, PickerLook> = {
  fraud: {
    icon: <CreditCard size={40} strokeWidth={1.75} />,
    border: "border-red-500/30",
    dot: "bg-red-400",
    text: "text-red-300",
    bg: "bg-[radial-gradient(ellipse_at_top_left,rgba(248,113,113,0.08),transparent_60%)]",
  },
  slo: {
    icon: <Siren size={40} strokeWidth={1.75} />,
    border: "border-amber-500/30",
    dot: "bg-amber-400",
    text: "text-amber-300",
    bg: "bg-[radial-gradient(ellipse_at_top_left,rgba(251,191,36,0.08),transparent_60%)]",
  },
  moderation: {
    icon: <ShieldAlert size={40} strokeWidth={1.75} />,
    border: "border-violet-500/30",
    dot: "bg-violet-400",
    text: "text-violet-300",
    bg: "bg-[radial-gradient(ellipse_at_top_left,rgba(167,139,250,0.08),transparent_60%)]",
  },
  patcher: {
    icon: <GitPullRequest size={40} strokeWidth={1.75} />,
    border: "border-emerald-500/30",
    dot: "bg-emerald-400",
    text: "text-emerald-300",
    bg: "bg-[radial-gradient(ellipse_at_top_left,rgba(52,211,153,0.08),transparent_60%)]",
  },
  "order-safety": {
    icon: <Radar size={40} strokeWidth={1.75} />,
    border: "border-sky-500/30",
    dot: "bg-sky-400",
    text: "text-sky-300",
    bg: "bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.08),transparent_60%)]",
  },
};

export default function SentinelVariantsIndexPage() {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        !!target?.isContentEditable
      )
        return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= SENTINEL_VARIANT_ORDER.length) {
        e.preventDefault();
        const slug = SENTINEL_VARIANT_ORDER[n - 1];
        router.push(`/slides/observer/variants/${slug}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  useEffect(() => {
    for (const slug of SENTINEL_VARIANT_ORDER) {
      router.prefetch(`/slides/observer/variants/${slug}`);
    }
  }, [router]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col gap-10 px-10 pt-20 pb-12">
      <div className="flex flex-col gap-4">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          Observer · auditions
        </p>
        <h1 className="text-[56px] font-semibold leading-[1.0] tracking-tight">
          Five always-on agents.
          <br />
          <span className="text-zinc-500">Pick one to crash.</span>
        </h1>
        <p className="max-w-3xl text-xl leading-relaxed text-zinc-400">
          Each of these is a different take on &ldquo;what happens when an
          agent loses its server?&rdquo; — same state machine, different
          stakes. Press <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">1</kbd>–<kbd className="ml-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">5</kbd> to jump.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-5 gap-6">
        {SENTINEL_VARIANT_ORDER.map((slug, i) => {
          const variant = SENTINEL_VARIANTS[slug];
          const look = LOOK[slug];
          return (
            <Link
              key={slug}
              href={`/slides/observer/variants/${slug}`}
              className={`group relative flex flex-col gap-6 overflow-hidden rounded-2xl border bg-zinc-950 p-7 transition-all hover:bg-zinc-900 ${look.border} hover:border-white/30`}
            >
              <span className={`pointer-events-none absolute inset-0 ${look.bg}`} />

              <div className="relative flex items-start justify-between">
                <span className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 bg-white/5 font-mono text-base text-zinc-300">
                  {i + 1}
                </span>
                <span className={`h-3 w-3 rounded-full animate-pulse ${look.dot}`} />
              </div>

              <div className={`relative ${look.text}`}>{look.icon}</div>

              <div className="relative flex flex-col gap-3">
                <p className={`text-xs font-semibold uppercase tracking-[0.22em] ${look.text}`}>
                  {variant.eyebrow}
                </p>
                <h2 className="text-3xl font-semibold leading-tight tracking-tight">
                  {variant.agentName}
                </h2>
                <p className="text-base leading-relaxed text-zinc-400">
                  {variant.purposeLine}
                </p>
              </div>

              <div className="relative mt-auto flex flex-col gap-3 border-t border-white/10 pt-5">
                <span className="font-mono text-xs uppercase tracking-[0.18em] text-zinc-500">
                  {variant.uptimeLabel}
                </span>
                <span className={`font-mono text-sm ${look.text}`}>
                  {variant.resumed.statChip}
                </span>
                <span className="font-mono text-[11px] text-zinc-500">
                  catastrophe: {variant.kill.catastropheLine}
                </span>
              </div>

              <span className="relative flex items-center gap-2 text-sm font-semibold text-zinc-500 transition-colors group-hover:text-white">
                Audition
                <span className="transition-transform group-hover:translate-x-1">→</span>
              </span>
            </Link>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-sm text-zinc-500">
        <Link
          href="/slides/observer/demo"
          className="font-mono uppercase tracking-[0.2em] hover:text-white"
        >
          ← back to observer / demo
        </Link>
        <span className="font-mono uppercase tracking-[0.2em]">
          default on stage: {SENTINEL_VARIANTS.fraud.agentName}
        </span>
      </div>
    </div>
  );
}
