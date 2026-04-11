import { ORDER_STEPS, type OrderStepId } from "@/lib/order-contract";

type DemoStripProps = {
  marker: OrderStepId | OrderStepId[] | "span";
  label?: string;
};

export function DemoStrip({ marker, label }: DemoStripProps) {
  const markedIds: Set<OrderStepId> =
    marker === "span"
      ? new Set(ORDER_STEPS.map((s) => s.id))
      : new Set(Array.isArray(marker) ? marker : [marker]);

  return (
    <div className="rounded-xl border border-white/5 bg-zinc-950/40 px-6 py-4">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-zinc-600">
          The demo
        </div>
        {label ? (
          <div className="font-mono text-base text-amber-300/80">{label}</div>
        ) : null}
      </div>

      <div className="relative mt-3 grid grid-cols-6 gap-2">
        <div className="pointer-events-none absolute left-3 right-3 top-[10px] h-px bg-white/10" />
        {ORDER_STEPS.map((step) => {
          const isMarked = markedIds.has(step.id);
          return (
            <div key={step.id} className="relative flex flex-col items-center">
              <div
                className={`relative z-10 flex h-5 w-5 items-center justify-center rounded-full border-2 transition-all duration-500 ${
                  isMarked
                    ? "border-amber-300 bg-amber-300/20 shadow-[0_0_16px_rgba(252,211,77,0.45)]"
                    : "border-white/15 bg-zinc-950"
                }`}
              >
                <div
                  className={`h-1.5 w-1.5 rounded-full ${
                    isMarked ? "bg-amber-300" : "bg-zinc-700"
                  }`}
                />
              </div>
              <div
                className={`mt-2 text-center font-mono text-[11px] uppercase tracking-[0.12em] transition-colors duration-500 ${
                  isMarked ? "text-amber-200" : "text-zinc-600"
                }`}
              >
                {step.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
