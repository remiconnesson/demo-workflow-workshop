import { TriangleMark } from "../_components/triangle-mark";

export default function ReplaySlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
        Deterministic Replay
      </div>
      <h2 className="text-5xl font-semibold tracking-tight">
        How the runtime recovers
      </h2>

      {/* Timeline showing replay */}
      <div className="mt-4 w-full max-w-5xl">
        <div className="rounded-2xl border border-white/10 bg-zinc-950 p-10">
          <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-6">
            First run — server crashes after step 3
          </div>
          <div className="flex items-center justify-between">
            {[
              { label: "Validate", state: "replayed" },
              { label: "Charge", state: "replayed" },
              { label: "Restaurant", state: "replayed" },
              { label: "Driver", state: "crash" },
              { label: "Delivery", state: "pending" },
              { label: "Receipt", state: "pending" },
            ].map((step, i, arr) => {
              const style =
                step.state === "replayed"
                  ? "bg-emerald-500/10 border-emerald-400 text-emerald-300"
                  : step.state === "crash"
                    ? "border-red-500 bg-red-500/10 text-red-400"
                    : "border-zinc-800 text-zinc-600";
              const lineColor =
                step.state === "replayed" ? "bg-emerald-400/40" : "bg-white/10";
              return (
                <div key={step.label} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <div className={`h-[2px] flex-1 ${i === 0 ? "opacity-0" : lineColor}`} />
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-semibold ${style}`}>
                      {step.state === "replayed" ? (
                        <span className="text-sm">skip</span>
                      ) : step.state === "crash" ? (
                        "!"
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className={`h-[2px] flex-1 ${i === arr.length - 1 ? "opacity-0" : lineColor}`} />
                  </div>
                  <div className="mt-3 text-center text-base font-semibold">{step.label}</div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 flex items-center gap-3 text-lg text-red-400">
            <span className="font-mono">CRASH</span>
            <span className="text-zinc-600">— server restarts</span>
          </div>

          <div className="mt-6 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 mb-6">
            Restart — replay from event log
          </div>
          <div className="flex items-center justify-between">
            {[
              { label: "Validate", state: "skipped" },
              { label: "Charge", state: "skipped" },
              { label: "Restaurant", state: "skipped" },
              { label: "Driver", state: "running" },
              { label: "Delivery", state: "pending" },
              { label: "Receipt", state: "pending" },
            ].map((step, i, arr) => {
              const style =
                step.state === "skipped"
                  ? "bg-white border-white text-black"
                  : step.state === "running"
                    ? "border-sky-400 text-sky-300"
                    : "border-zinc-800 text-zinc-600";
              const lineColor =
                step.state === "skipped" ? "bg-white" : "bg-white/10";
              return (
                <div key={step.label} className="flex flex-1 flex-col items-center">
                  <div className="flex w-full items-center">
                    <div className={`h-[2px] flex-1 ${i === 0 ? "opacity-0" : lineColor}`} />
                    <div className={`flex h-14 w-14 items-center justify-center rounded-full border-2 text-lg font-semibold ${style}`}>
                      {step.state === "skipped" ? (
                        <TriangleMark size={18} className="text-black" />
                      ) : step.state === "running" ? (
                        <span className="animate-pulse">●</span>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <div className={`h-[2px] flex-1 ${i === arr.length - 1 ? "opacity-0" : lineColor}`} />
                  </div>
                  <div className="mt-3 text-center text-base font-semibold">{step.label}</div>
                  <div className="text-xs font-mono text-zinc-500 uppercase mt-0.5">
                    {step.state === "skipped" ? "cached" : step.state}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-xl text-zinc-400 max-w-3xl text-center">
        Steps 1-3 already completed — their results are in the event log. The runtime replays them instantly
        (no re-execution) and resumes at step 4. <span className="text-white">The customer is never double-charged.</span>
      </p>
    </div>
  );
}
