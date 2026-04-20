import Link from "next/link";
import { FRAUD_VARIANTS } from "../../_components/fraud-lab/_registry";

export default function FraudLabIndex() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col gap-8 px-10 pt-20 pb-12">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-red-400">
          fraud lab · 25 variants
        </p>
        <h2 className="text-[56px] font-semibold leading-[1.0] tracking-tight">
          Same story. Twenty-five voices.
        </h2>
        <p className="text-lg text-zinc-400">
          Every card tells the same ninety-four-day fraud story a different way.
          Click one. Press <kbd className="mx-1 rounded-md border border-white/20 bg-white/10 px-2 py-0.5 font-mono text-base">r</kbd> to run.
        </p>
      </div>

      <div className="grid min-h-0 flex-1 auto-rows-min grid-cols-5 gap-4 overflow-y-auto pr-2">
        {FRAUD_VARIANTS.map((v) => (
          <Link
            key={v.slug}
            href={`/slides/observer/fraud-lab/${v.slug}`}
            className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-zinc-950 p-5 transition-all hover:border-red-500/40 hover:bg-red-500/[0.04]"
          >
            <div className="flex items-baseline gap-2">
              <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 tabular-nums">
                {v.number.toString().padStart(2, "0")}
              </span>
              <span className="text-lg font-semibold text-white transition-colors group-hover:text-red-200">
                {v.title}
              </span>
            </div>
            <p className="text-sm text-zinc-400">{v.tagline}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
