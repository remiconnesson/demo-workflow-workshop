import { WorkflowMark } from "../_components/workflow-mark";

const RECAP_PILLS = [
  { label: "durable", tone: "emerald" },
  { label: "idempotent", tone: "emerald" },
  { label: "hooks", tone: "amber" },
  { label: "timeouts", tone: "amber" },
  { label: "sleep", tone: "amber" },
  { label: "saga", tone: "fuchsia" },
  { label: "streaming", tone: "sky" },
  { label: "parallel", tone: "sky" },
  { label: "wake-up", tone: "amber" },
  { label: "agents", tone: "sky" },
] as const;

const TONE_CLASSES: Record<(typeof RECAP_PILLS)[number]["tone"], string> = {
  emerald: "border-emerald-500/30 bg-emerald-500/5 text-emerald-300",
  amber: "border-amber-500/30 bg-amber-500/5 text-amber-300",
  fuchsia: "border-fuchsia-500/30 bg-fuchsia-500/5 text-fuchsia-300",
  sky: "border-sky-500/30 bg-sky-500/5 text-sky-300",
};

export default function CloseSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <WorkflowMark size={64} className="text-white" />

      <h1 className="text-7xl font-semibold tracking-tight text-center">
        Ship it tonight
      </h1>

      <div className="mt-4 flex max-w-5xl flex-wrap items-center justify-center gap-3">
        {RECAP_PILLS.map((pill) => (
          <span
            key={pill.label}
            className={`rounded-full border px-5 py-2 font-mono text-lg ${TONE_CLASSES[pill.tone]}`}
          >
            {pill.label}
          </span>
        ))}
      </div>

      <p className="mt-8 font-mono text-2xl text-zinc-500">
        npm i workflow
      </p>
      <p className="font-mono text-3xl text-zinc-300">useworkflow.dev</p>

      <p className="mt-12 text-xl text-zinc-600">
        Press <span className="font-mono">d</span> to return to demo
      </p>
    </div>
  );
}
