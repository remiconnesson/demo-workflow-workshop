import { TriangleMark } from "../_components/triangle-mark";

export default function CompensationTimelineSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Compensation Timeline
      </div>
      <h2 className="text-5xl font-semibold tracking-tight">
        What the audience just saw
      </h2>

      {/* Full-width timeline recreation from the demo */}
      <div className="mt-6 w-full max-w-5xl">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-10">
          {/* Timeline nodes — matching the demo exactly */}
          <div className="flex items-center justify-between">
            {[
              { label: "Validate", state: "success" as const },
              { label: "Charge", state: "success" as const },
              { label: "Restaurant", state: "success" as const },
              { label: "Driver", state: "failed" as const },
              { label: "Delivery", state: "skipped" as const },
              { label: "Receipt", state: "skipped" as const },
            ].map((step, i, arr) => {
              const nodeStyle =
                step.state === "success"
                  ? "bg-white border-white text-black"
                  : step.state === "failed"
                    ? "border-red-500 bg-red-500/10 text-red-400"
                    : "border-zinc-800 bg-zinc-900 text-zinc-600";
              const lineColor =
                step.state === "success" ? "bg-white" : "bg-white/10";
              const isLast = i === arr.length - 1;

              return (
                <div key={step.label} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <div className={`h-[2px] flex-1 ${i === 0 ? "opacity-0" : lineColor}`} />
                    <div className={`flex h-16 w-16 items-center justify-center rounded-full border-2 text-xl font-semibold ${nodeStyle}`}>
                      {step.state === "success" ? (
                        <TriangleMark size={22} className="text-black" />
                      ) : step.state === "failed" ? (
                        "!"
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className={`h-[2px] flex-1 ${isLast ? "opacity-0" : lineColor}`} />
                  </div>
                  <div className="mt-3 text-center">
                    <div className="text-lg font-semibold">{step.label}</div>
                    <div className="mt-0.5 font-mono text-sm uppercase text-zinc-500">
                      {step.state}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Compensation arrows going backward */}
          <div className="relative mt-10 flex items-center justify-between px-8">
            {/* Arrow line */}
            <div className="absolute left-[12%] right-[55%] top-1/2 h-[2px] -translate-y-1/2 bg-fuchsia-400/40" />
            {/* Arrow head */}
            <div className="absolute left-[12%] top-1/2 -translate-y-1/2 -translate-x-1">
              <svg width="12" height="12" viewBox="0 0 12 12" className="text-fuchsia-400">
                <path d="M12 6 L0 0 L0 12 Z" fill="currentColor" />
              </svg>
            </div>

            {/* Compensation pills — matching the demo's fuchsia section */}
            <div className="flex w-full items-center justify-center gap-4">
              <span className="rounded-full border border-fuchsia-400/40 bg-black px-5 py-2 font-mono text-lg">
                <span className="text-fuchsia-300">3.</span> releaseDriver
              </span>
              <span className="text-fuchsia-400">&rarr;</span>
              <span className="rounded-full border border-fuchsia-400/40 bg-black px-5 py-2 font-mono text-lg">
                <span className="text-fuchsia-300">2.</span> cancelRestaurant
              </span>
              <span className="text-fuchsia-400">&rarr;</span>
              <span className="rounded-full border border-fuchsia-400/40 bg-black px-5 py-2 font-mono text-lg">
                <span className="text-fuchsia-300">1.</span> refundPayment
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Annotation */}
      <div className="max-w-3xl text-center">
        <p className="text-xl text-zinc-400">
          Driver assignment failed at step 4. The compensation stack unwinds in reverse:
          release the driver, cancel the restaurant, refund the payment.
          <span className="text-fuchsia-300"> Every pill you see in the demo is one of these compensations.</span>
        </p>
      </div>
    </div>
  );
}
