import { CodeBlock } from "../_components/code-block";
import { PLACE_ORDER_DURABLE } from "../_components/place-order-code";

const POSITIVE_HIGHLIGHT_CLASS = [
  "[&_.code-hl]:!bg-emerald-500/10",
  "[&_.code-hl]:!ring-1",
  "[&_.code-hl]:!ring-emerald-400/25",
  "[&_.code-hl]:!shadow-[0_0_26px_rgba(52,211,153,0.14)]",
  "[&_.code-hl-tip]:!border-emerald-400/40",
  "[&_.code-hl-tip]:!bg-emerald-950/95",
  "[&_.code-hl-tip]:!text-emerald-100",
  "[&_.code-hl-tip-eyebrow]:!text-emerald-300",
  "[&_.code-hl-keyword]:!text-emerald-200",
].join(" ");

export default async function ItIsThatEasySlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col justify-center gap-10 px-20">
      <div>
        <h2 className="mt-3 text-6xl font-semibold tracking-tight">
          It is that easy.
          <span className="text-zinc-500"> Same shape. Durable underneath.</span>
        </h2>
      </div>

      <div className={`rounded-2xl border border-white/10 bg-zinc-950 p-10 ${POSITIVE_HIGHLIGHT_CLASS}`}>
        <CodeBlock
          code={PLACE_ORDER_DURABLE}
          lang="ts"
          textClass="text-[26px]"
          highlightLines={{
            5: "**step**: result replays on retry; invalid input stops before charge",
            7: "**idempotency**: stepId keys Stripe; retry returns original charge",
            9: "**hook/webhook**: workflow parks; restaurant tap resumes this await",
            11: "**sleep+race**: no driver times out cleanly; retry or unwind",
            13: "**compensation**: driver cancel throws; saga unwinds restaurant first",
            15: "**replay**: event log resumes after crash; receipts still send",
          }}
        />
      </div>
    </div>
  );
}
