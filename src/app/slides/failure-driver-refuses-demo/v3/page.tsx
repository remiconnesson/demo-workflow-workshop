import { DisputeLab, EYEBROW, TITLE } from "../_shared";

// v3 — Eyebrow stacked above heading, copy below.
export default function V3() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1360px] flex-col gap-8 px-10 py-12">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-lg uppercase tracking-[0.22em] text-zinc-500 tabular-nums">
          {EYEBROW}
        </span>
        <h2 className="text-[56px] font-semibold leading-[1.05] tracking-tight">
          {TITLE}
        </h2>
        <p className="max-w-[860px] text-2xl leading-[1.45] text-zinc-400">
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
