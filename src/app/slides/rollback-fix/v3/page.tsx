import { CodeBlock } from "../../_components/code-block";
import { FinishedTimelineStrip } from "../../_components/finished-timeline-strip";
import { DISPUTE_CODE } from "../_shared";

// v3 — Geist split with enumerated saga steps in the rail.
// Numbered list replaces the metadata grid; feels like documentation.
export default function V3() {
  return (
    <div className="flex h-full w-full flex-col gap-6 px-14 py-8">
      <FinishedTimelineStrip slide="rollback" />

      <div className="grid min-h-0 flex-1 grid-cols-[340px_1fr] gap-12">
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

          <ol className="mt-8 flex flex-col gap-4">
            <Step n="01" label="Open a dispute hook" detail="tokenized by orderId" />
            <Step n="02" label="Race hook vs 24h sleep" detail="whichever resolves first" />
            <Step n="03" label="Throw on disputed verdict" detail="saga unwinds in reverse" />
          </ol>

          <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-6">
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
          <div className="flex items-center border-b border-white/10 px-6 py-3">
            <span className="font-mono text-[12px] text-zinc-500">placeOrder.ts</span>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
            <CodeBlock code={DISPUTE_CODE} lang="ts" textClass="text-[26px]" />
          </div>
        </div>
      </div>
    </div>
  );
}

function Step({ n, label, detail }: { n: string; label: string; detail: string }) {
  return (
    <li className="flex gap-4">
      <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500 pt-1">
        {n}
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-[15px] font-medium text-zinc-100">{label}</span>
        <span className="font-mono text-[12px] text-zinc-500">{detail}</span>
      </div>
    </li>
  );
}
