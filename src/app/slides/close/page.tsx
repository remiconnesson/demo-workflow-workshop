import { WorkflowMark } from "../_components/workflow-mark";

const VERBS = [
  {
    label: "RETRY",
    className:
      "border-sky-400/35 bg-sky-500/10 text-sky-300 shadow-[0_0_36px_rgba(56,189,248,0.12)]",
  },
  {
    label: "SUSPEND",
    className:
      "border-amber-400/35 bg-amber-500/10 text-amber-300 shadow-[0_0_36px_rgba(251,191,36,0.12)]",
  },
  {
    label: "ROLLBACK",
    className:
      "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-300 shadow-[0_0_36px_rgba(232,121,249,0.12)]",
  },
] as const;

export default function CloseSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1280px] flex-col items-center justify-center px-20 text-center">
      <div className="flex flex-col items-center gap-12">
        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-10 rounded-full bg-white/[0.035] blur-3xl"
          />
          <WorkflowMark size={104} className="relative text-white" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          {VERBS.map((verb) => (
            <span
              key={verb.label}
              className={`rounded-full border px-6 py-3 font-mono text-2xl font-semibold uppercase leading-none tracking-[0.18em] ${verb.className}`}
            >
              {verb.label}
            </span>
          ))}
        </div>

        <div className="flex flex-col items-center gap-6">
          <h1 className="text-8xl font-semibold leading-[0.95] tracking-tight text-white">
            Ship it tonight
          </h1>
          <p className="max-w-4xl text-4xl leading-tight text-zinc-300">
            Workflows and agents that finish what they start.
          </p>
        </div>

        <div className="mt-6 rounded-2xl border border-white/10 bg-zinc-950/70 px-8 py-5">
          <p className="font-mono text-3xl text-white">workflow-sdk.dev</p>
        </div>
      </div>
    </div>
  );
}
