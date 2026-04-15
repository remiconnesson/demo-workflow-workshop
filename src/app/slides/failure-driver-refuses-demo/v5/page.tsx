import { DisputeLab, EYEBROW, TITLE } from "../_shared";

// v5 — Split row: heading left, copy right (two-column header).
export default function V5() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1400px] flex-col gap-8 px-10 py-12">
      <div className="flex items-start justify-between gap-10">
        <div className="flex flex-col gap-2">
          <span className="font-mono text-base uppercase tracking-[0.22em] text-zinc-500 tabular-nums">
            {EYEBROW}
          </span>
          <h2 className="text-[56px] font-semibold leading-[1.0] tracking-tight">
            {TITLE}
          </h2>
        </div>
        <p className="max-w-[520px] pt-6 text-xl leading-[1.5] text-zinc-400">
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
