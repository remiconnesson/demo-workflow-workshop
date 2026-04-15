import { CodeBlock } from "../../_components/code-block";
import { FinishedTimelineStrip } from "../../_components/finished-timeline-strip";
import { DISPUTE_CODE } from "../_shared";

// v1 — Geist split, minimal rail. Title + dot only. Code is the hero.
export default function V1() {
  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-8">
      <FinishedTimelineStrip slide="failure-driver-refuses" />

      <div className="grid min-h-0 flex-1 grid-cols-[260px_1fr] gap-12">
        <div className="flex flex-col">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
            12c / workflow
          </div>
          <h2
            className="mt-6 text-[44px] font-semibold text-white"
            style={{ lineHeight: "46px", letterSpacing: "-2.2px" }}
          >
            Dispute the Entire Order
          </h2>
          <div className="mt-auto flex items-center gap-2">
            <span
              className="inline-block h-[7px] w-[7px] rounded-full bg-fuchsia-400"
              style={{ boxShadow: "0 0 10px rgba(232,121,249,0.6)" }}
            />
            <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-zinc-400">
              post-delivery dispute
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
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            <CodeBlock code={DISPUTE_CODE} lang="ts" textClass="text-[28px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
