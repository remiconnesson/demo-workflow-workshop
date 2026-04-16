import { CodeBlock } from "../../_components/code-block";
import { FinishedTimelineStrip } from "../../_components/finished-timeline-strip";
import { DISPUTE_CODE } from "../_shared";

// v2 — Reversed split. Code on the left, Geist metadata panel on the right.
export default function V2() {
  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-8">
      <FinishedTimelineStrip slide="dispute" />

      <div className="grid min-h-0 flex-1 grid-cols-[1fr_320px] gap-12">
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

        <div className="flex flex-col">
          <div className="font-mono text-[11px] font-medium uppercase tracking-[0.24em] text-zinc-500">
            12c / workflow code
          </div>
          <h2
            className="mt-6 text-[44px] font-semibold text-white"
            style={{ lineHeight: "46px", letterSpacing: "-2.2px" }}
          >
            Dispute the Entire Order
          </h2>
          <div className="mt-6 flex items-center gap-2">
            <span
              className="inline-block h-[7px] w-[7px] rounded-full bg-fuchsia-400"
              style={{ boxShadow: "0 0 10px rgba(232,121,249,0.6)" }}
            />
            <span className="font-mono text-[12px] uppercase tracking-[0.22em] text-zinc-400">
              post-delivery
            </span>
          </div>
          <div className="mt-auto flex flex-col gap-3 border-t border-white/10 pt-6">
            <Meta k="Pattern" v="Saga" />
            <Meta k="Trigger" v="createHook" />
            <Meta k="Window" v="24h" />
            <Meta k="Resolve" v="Promise.race" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Meta({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
        {k}
      </span>
      <span className="font-mono text-[13px] text-zinc-200">{v}</span>
    </div>
  );
}
