import { DisputeLab, EYEBROW, TITLE } from "../_shared";

// v7 — Largest heading, prominent copy.
export default function V7() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-8 px-10 py-12">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-6">
          <h2 className="text-[72px] font-semibold leading-[0.98] tracking-tight">
            {TITLE}
          </h2>
          <span className="font-mono text-base uppercase tracking-[0.22em] text-zinc-500 tabular-nums">
            {EYEBROW}
          </span>
        </div>
        <p className="max-w-[920px] text-[28px] leading-[1.35] text-zinc-300">
          A post-delivery hook lets any stakeholder unwind the saga — every
          prior compensation fires in reverse.
        </p>
      </div>
      <div className="min-h-0 flex-1">
        <DisputeLab />
      </div>
    </div>
  );
}
