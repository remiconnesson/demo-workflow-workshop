import { DisputeLab, EYEBROW, TITLE } from "../_shared";

// v6 — Centered header stack above lab.
export default function V6() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1360px] flex-col gap-8 px-10 py-12">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="font-mono text-base uppercase tracking-[0.22em] text-zinc-500 tabular-nums">
          {EYEBROW}
        </span>
        <h2 className="text-[56px] font-semibold leading-[1.05] tracking-tight">
          {TITLE}
        </h2>
        <p className="max-w-[900px] text-2xl leading-[1.45] text-zinc-400">
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
