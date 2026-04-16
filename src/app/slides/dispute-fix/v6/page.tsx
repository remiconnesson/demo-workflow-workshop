import { CodeBlock } from "../../_components/code-block";
import { FinishedTimelineStrip } from "../../_components/finished-timeline-strip";
import { DISPUTE_CODE } from "../_shared";

// v6 — Code-forward. Slim rail (220px) with just title + dot.
// Code panel dominates and gets a larger text size.
export default function V6() {
  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-8">
      <FinishedTimelineStrip slide="dispute" />

      <div className="grid min-h-0 flex-1 grid-cols-[220px_1fr] gap-10">
        <div className="flex flex-col border-r border-white/10 pr-8">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
            12c
          </div>
          <h2
            className="mt-5 text-[36px] font-semibold text-white"
            style={{ lineHeight: "38px", letterSpacing: "-1.8px" }}
          >
            Dispute the Entire Order
          </h2>
          <div className="mt-auto flex items-center gap-2">
            <span
              className="inline-block h-[6px] w-[6px] rounded-full bg-fuchsia-400"
              style={{ boxShadow: "0 0 8px rgba(232,121,249,0.6)" }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-400">
              saga
            </span>
          </div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
            <span className="font-mono text-[12px] text-zinc-500">placeOrder.ts</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-400/80">
              use workflow
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-10 py-8">
            <CodeBlock code={DISPUTE_CODE} lang="ts" textClass="text-[30px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
