import { CodeBlock } from "../../_components/code-block";
import { FinishedTimelineStrip } from "../../_components/finished-timeline-strip";
import { DISPUTE_CODE } from "../_shared";

// v4 — Headline band across the top, metadata/code split below.
// Gives the heading its own line; split panel handles supporting detail.
export default function V4() {
  return (
    <div className="flex h-full w-full flex-col gap-5 px-14 py-8">
      <FinishedTimelineStrip slide="dispute" />

      <div className="flex items-end justify-between border-b border-white/10 pb-5">
        <h2
          className="text-[56px] font-semibold text-white"
          style={{ lineHeight: "56px", letterSpacing: "-3.36px" }}
        >
          Dispute the Entire Order
        </h2>
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-[8px] w-[8px] rounded-full bg-fuchsia-400"
            style={{ boxShadow: "0 0 12px rgba(232,121,249,0.7)" }}
          />
          <span className="font-mono text-[12px] uppercase tracking-[0.24em] text-zinc-400">
            12c · post-delivery dispute
          </span>
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-[240px_1fr] gap-12">
        <div className="flex flex-col gap-3 pt-2">
          <Meta k="Pattern" v="Saga" />
          <Meta k="Trigger" v="createHook" />
          <Meta k="Window" v="24h" />
          <Meta k="Resolve" v="Promise.race" />
          <Meta k="Onthrow" v="unwind" />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-white/10 bg-[#0a0a0a]">
          <div className="flex items-center justify-between border-b border-white/10 px-6 py-3">
            <span className="font-mono text-[12px] text-zinc-500">placeOrder.ts</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-emerald-400/80">
              use workflow
            </span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            <CodeBlock code={DISPUTE_CODE} lang="ts" textClass="text-[26px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/5 pb-2">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {k}
      </span>
      <span className="font-mono text-[13px] text-zinc-200">{v}</span>
    </div>
  );
}
