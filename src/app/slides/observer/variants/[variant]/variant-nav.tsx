"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  SENTINEL_VARIANTS,
  SENTINEL_VARIANT_ORDER,
  type SentinelVariantSlug,
} from "../../../_data/sentinel-variants";

export function VariantNav({ currentSlug }: { currentSlug: SentinelVariantSlug }) {
  const router = useRouter();
  const index = SENTINEL_VARIANT_ORDER.indexOf(currentSlug);
  const prevSlug = index > 0 ? SENTINEL_VARIANT_ORDER[index - 1] : null;
  const nextSlug =
    index < SENTINEL_VARIANT_ORDER.length - 1 ? SENTINEL_VARIANT_ORDER[index + 1] : null;

  useEffect(() => {
    // Prefetch neighbors for instant cycling
    if (prevSlug) router.prefetch(`/slides/observer/variants/${prevSlug}`);
    if (nextSlug) router.prefetch(`/slides/observer/variants/${nextSlug}`);
  }, [router, prevSlug, nextSlug]);

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

      // Digits 1–5 jump directly across variants.
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= SENTINEL_VARIANT_ORDER.length) {
        e.preventDefault();
        const target = SENTINEL_VARIANT_ORDER[n - 1];
        if (target !== currentSlug) {
          router.push(`/slides/observer/variants/${target}`);
        }
      }

      // [ / ] cycle through variants (avoids the slides-layout arrow handler)
      if (e.key === "[" && prevSlug) {
        e.preventDefault();
        router.push(`/slides/observer/variants/${prevSlug}`);
      }
      if (e.key === "]" && nextSlug) {
        e.preventDefault();
        router.push(`/slides/observer/variants/${nextSlug}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, currentSlug, prevSlug, nextSlug]);

  const current = SENTINEL_VARIANTS[currentSlug];

  return (
    <div className="pointer-events-none fixed top-8 left-1/2 z-40 -translate-x-1/2">
      <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-zinc-950/90 px-2 py-1 backdrop-blur">
        <Link
          href="/slides/observer/variants"
          className="rounded-full px-3 py-1 font-mono text-xs uppercase tracking-[0.2em] text-zinc-500 transition-colors hover:bg-white/5 hover:text-white"
        >
          ← variants
        </Link>
        <span className="px-2 font-mono text-xs uppercase tracking-[0.2em] text-zinc-300">
          {current.agentName}
        </span>
        <span className="px-1 font-mono text-xs text-zinc-600">
          {index + 1} / {SENTINEL_VARIANT_ORDER.length}
        </span>
        <button
          type="button"
          disabled={!prevSlug}
          onClick={() => prevSlug && router.push(`/slides/observer/variants/${prevSlug}`)}
          className="rounded-full px-2 py-1 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
          title="Previous variant ([)"
        >
          ←
        </button>
        <button
          type="button"
          disabled={!nextSlug}
          onClick={() => nextSlug && router.push(`/slides/observer/variants/${nextSlug}`)}
          className="rounded-full px-2 py-1 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:text-zinc-700"
          title="Next variant (])"
        >
          →
        </button>
      </div>
    </div>
  );
}
