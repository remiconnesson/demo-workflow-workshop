import { CodeBlock } from "../_components/code-block";
import { ObservableCallout } from "../_components/observable-callout";
import { PLACE_ORDER_SETUP } from "../_components/place-order-code";

const RISK_GROUPS = [
  {
    property: "Stable",
    tone: "sky",
    items: [
      { line: "03", label: "Invalid input" },
      { line: "05", label: "Double charge" },
      { line: "13", label: "Crash before receipts" },
    ],
  },
  {
    property: "Suspendable",
    tone: "amber",
    items: [
      { line: "07", label: "Restaurant timeout" },
      { line: "09", label: "No driver" },
    ],
  },
  {
    property: "Undoable",
    tone: "fuchsia",
    items: [{ line: "11", label: "Driver cancellation" }],
  },
] as const;

const RISK_TONE = {
  sky: {
    card: "border-sky-400/25 bg-sky-500/[0.06] shadow-[0_0_42px_rgba(56,189,248,0.10)]",
    dot: "bg-sky-400 shadow-[0_0_18px_rgba(56,189,248,0.55)]",
    label: "text-sky-300",
    chip: "border-sky-400/20 bg-sky-500/[0.07] text-sky-100",
  },
  amber: {
    card: "border-amber-400/25 bg-amber-500/[0.06] shadow-[0_0_42px_rgba(251,191,36,0.10)]",
    dot: "bg-amber-400 shadow-[0_0_18px_rgba(251,191,36,0.55)]",
    label: "text-amber-300",
    chip: "border-amber-400/20 bg-amber-500/[0.07] text-amber-100",
  },
  fuchsia: {
    card: "border-fuchsia-400/25 bg-fuchsia-500/[0.06] shadow-[0_0_42px_rgba(232,121,249,0.10)]",
    dot: "bg-fuchsia-400 shadow-[0_0_18px_rgba(232,121,249,0.55)]",
    label: "text-fuchsia-300",
    chip: "border-fuchsia-400/20 bg-fuchsia-500/[0.07] text-fuchsia-100",
  },
} as const;

const SETUP_RISK_HIGHLIGHT_CLASS = [
  "[&_.code-hl]:transition-all",
  "[&_.code-hl]:duration-300",
  // Retry family — invalid input, double charge, crash before receipts
  "[&_.code-line-3.code-hl]:!bg-sky-500/10",
  "[&_.code-line-3.code-hl]:!ring-1",
  "[&_.code-line-3.code-hl]:!ring-sky-400/30",
  "[&_.code-line-5.code-hl]:!bg-sky-500/10",
  "[&_.code-line-5.code-hl]:!ring-1",
  "[&_.code-line-5.code-hl]:!ring-sky-400/30",
  "[&_.code-line-13.code-hl]:!bg-sky-500/10",
  "[&_.code-line-13.code-hl]:!ring-1",
  "[&_.code-line-13.code-hl]:!ring-sky-400/30",
  // Suspend family — restaurant timeout, no driver
  "[&_.code-line-7.code-hl]:!bg-amber-500/10",
  "[&_.code-line-7.code-hl]:!ring-1",
  "[&_.code-line-7.code-hl]:!ring-amber-400/30",
  "[&_.code-line-9.code-hl]:!bg-amber-500/10",
  "[&_.code-line-9.code-hl]:!ring-1",
  "[&_.code-line-9.code-hl]:!ring-amber-400/30",
  // Rollback family — driver cancellation
  "[&_.code-line-11.code-hl]:!bg-fuchsia-500/10",
  "[&_.code-line-11.code-hl]:!ring-1",
  "[&_.code-line-11.code-hl]:!ring-fuchsia-400/30",
].join(" ");

export default async function TheSetupSlide() {
  return (
    <div className="mx-auto grid h-full w-full max-w-[1580px] content-center gap-8 px-14 py-16">
      <header className="max-w-[1180px]">
        <p className="font-mono text-lg font-semibold uppercase tracking-[0.24em] text-zinc-600">
          Starting point
        </p>
        <h2 className="mt-3 text-6xl font-semibold leading-[1.05] tracking-tight">
          Wouldn&apos;t it be nice
          <span className="text-zinc-500"> if it was this simple?</span>
        </h2>
      </header>

      <div className="grid min-h-0 grid-cols-[minmax(0,1fr)_430px] items-stretch gap-8">
        <div
          className={`flex min-h-0 flex-col gap-4`}
        >
          <div
            className={`flex-1 rounded-2xl border border-white/10 bg-zinc-950 p-10 ${SETUP_RISK_HIGHLIGHT_CLASS}`}
          >
            <CodeBlock
              code={PLACE_ORDER_SETUP}
              lang="ts"
              textClass="text-[26px]"
              highlightLines={{
                3: "What if the input is **invalid** but the next step already ran?",
                5: "What if this **fails halfway**? The customer gets **charged twice**.",
                7: "What if the restaurant takes **10 minutes**? This function **times out**.",
                9: "What if **no drivers** are available? The order is stuck **forever**.",
                11: "What if the driver **cancels**? Who rolls back the restaurant?",
                13: "What if the server **crashes** here? The customer never gets receipts.",
              }}
            />
          </div>
          <ObservableCallout />
        </div>

        <aside className="flex min-h-0 flex-col justify-center rounded-2xl border border-white/10 bg-zinc-950 p-7">
          <p className="font-mono text-lg font-semibold uppercase tracking-[0.24em] text-zinc-500">
            Six ways this breaks
          </p>
          <div className="mt-6 flex flex-col gap-4">
            {RISK_GROUPS.map((group) => {
              const tone = RISK_TONE[group.tone];
              return (
                <section
                  key={group.property}
                  className={`rounded-2xl border p-5 ${tone.card}`}
                >
                  <div className="flex items-center gap-3">
                    <span
                      aria-hidden
                      className={`h-3 w-3 rounded-full ${tone.dot}`}
                    />
                    <p
                      className={`font-mono text-[22px] font-semibold leading-none tracking-tight ${tone.label}`}
                    >
                      {group.property}
                    </p>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {group.items.map((item) => (
                      <span
                        key={`${group.property}-${item.line}`}
                        className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-2 text-lg font-semibold leading-none ${tone.chip}`}
                      >
                        <span className="font-mono text-sm tabular-nums opacity-55">
                          {item.line}
                        </span>
                        {item.label}
                      </span>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}
