import { DisputeLab, EYEBROW, TITLE } from "../_shared";

// v2 — Larger heading, compact copy.
export default function V2() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1360px] flex-col gap-8 px-10 py-12">
      <div className="flex flex-col gap-4">
        <div className="flex items-baseline justify-between gap-6">
          <h2 className="text-[64px] font-semibold leading-[1.0] tracking-tight">
            {TITLE}
          </h2>
          <span className="font-mono text-base uppercase tracking-[0.22em] text-zinc-500 tabular-nums">
            {EYEBROW}
          </span>
        </div>
        <p className="max-w-[820px] text-xl leading-[1.5] text-zinc-400">
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
