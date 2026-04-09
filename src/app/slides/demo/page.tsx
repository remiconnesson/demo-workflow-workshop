import { TriangleMark } from "../_components/triangle-mark";

export default function DemoSlide() {
  return (
    <div className="flex h-full w-full items-center justify-center gap-20 px-20">
      {/* Left: mini phone mockup */}
      <div className="shrink-0">
        <div className="relative h-[560px] w-[280px] overflow-hidden rounded-[28px] border-[7px] border-zinc-800 bg-white text-black shadow-[0_30px_60px_-10px_rgba(0,0,0,0.8)]">
          {/* dynamic island */}
          <div className="absolute left-1/2 top-1.5 z-20 h-4 w-24 -translate-x-1/2 rounded-full bg-black" />
          {/* status bar */}
          <div className="flex h-8 items-center justify-between px-5 pt-2 text-xs font-medium">
            <span>9:41</span>
            <span>100%</span>
          </div>
          {/* header */}
          <div className="flex items-center gap-1.5 border-b border-zinc-100 px-5 py-3">
            <TriangleMark size={12} className="text-black" />
            <span className="text-sm font-semibold">Triangle Donuts</span>
          </div>
          {/* menu items */}
          <div className="px-5 py-3">
            <div className="text-lg font-semibold">Fresh today</div>
            <div className="mt-1 text-xs text-zinc-500">Built at the edge</div>
            <div className="mt-3 flex flex-col gap-2">
              {["The Deployer", "Edge Runtime", "Cold Start"].map((name) => (
                <div key={name} className="flex items-center justify-between py-1.5">
                  <div>
                    <div className="text-sm font-semibold">{name}</div>
                    <div className="text-xs text-zinc-400">$4.50</div>
                  </div>
                  <div className="flex h-6 w-6 items-center justify-center rounded-full border border-zinc-200 text-xs">
                    +
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* bottom button */}
          <div className="absolute bottom-4 left-5 right-5">
            <div className="flex items-center justify-between rounded-xl bg-black px-4 py-3 text-sm font-semibold text-white">
              <span>Place order</span>
              <span>$12.50</span>
            </div>
          </div>
        </div>
        <div className="mt-4 text-center text-lg text-zinc-500">Customer app</div>
      </div>

      {/* Right: explanation */}
      <div className="max-w-2xl">
        <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
          The Demo
        </div>
        <h2 className="mt-3 text-5xl font-semibold tracking-tight">
          Triangle Donuts
        </h2>
        <p className="mt-4 text-xl text-zinc-400">
          A food delivery saga — 6 steps, 3 hooks, and a compensation stack.
        </p>

        <div className="mt-10 flex flex-col gap-4">
          {[
            { num: "1", label: "Validate order", sub: "Schema & stock check", color: "border-white/15 text-zinc-600" },
            { num: "2", label: "Charge payment", sub: "Stripe with stepId idempotency", color: "border-white/15 text-zinc-600" },
            { num: "3", label: "Notify restaurant", sub: "Hook: wait for accept/reject", color: "border-amber-400/40 text-amber-300" },
            { num: "4", label: "Assign driver", sub: "Hook: accept with 2m timeout", color: "border-amber-400/40 text-amber-300" },
            { num: "5", label: "Track delivery", sub: "Hook: delivery confirmation", color: "border-amber-400/40 text-amber-300" },
            { num: "6", label: "Send receipt", sub: "Email + SMS", color: "border-white/15 text-zinc-600" },
          ].map((step) => (
            <div key={step.num} className="flex items-center gap-5">
              <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 text-xl font-semibold ${step.color}`}>
                {step.num}
              </div>
              <div>
                <div className="text-xl font-semibold">{step.label}</div>
                <div className="text-base text-zinc-500">{step.sub}</div>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-lg text-zinc-600">
          Steps 3, 4, and 5 pause the workflow with hooks — zero cost while waiting.
        </p>
      </div>
    </div>
  );
}
