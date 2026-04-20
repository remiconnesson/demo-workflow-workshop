import { WorkflowMark } from "../_components/workflow-mark";

const PROPERTIES = [
  {
    label: "STABLE",
    className:
      "border-sky-400/35 bg-sky-500/10 text-sky-300 shadow-[0_0_36px_rgba(56,189,248,0.12)]",
  },
  {
    label: "SUSPENDABLE",
    className:
      "border-amber-400/35 bg-amber-500/10 text-amber-300 shadow-[0_0_36px_rgba(251,191,36,0.12)]",
  },
  {
    label: "UNDOABLE",
    className:
      "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-300 shadow-[0_0_36px_rgba(232,121,249,0.12)]",
  },
] as const;

export default function CloseSlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col items-center justify-center px-20 text-center">
      <div className="flex flex-col items-center gap-8">
        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-8 rounded-full bg-white/[0.035] blur-3xl"
          />
          <WorkflowMark size={72} className="relative text-white" />
        </div>

        <div className="flex flex-wrap items-center justify-center gap-4">
          {PROPERTIES.map((property) => (
            <span
              key={property.label}
              className={`rounded-full border px-6 py-3 font-mono text-[24px] font-semibold uppercase leading-none tracking-[0.12em] ${property.className}`}
            >
              {property.label}
            </span>
          ))}
        </div>

        <div className="flex flex-col items-center gap-3">
          <h1 className="text-7xl font-semibold leading-[0.95] tracking-tight text-white">
            Ship it tonight
          </h1>
          <p className="max-w-4xl text-3xl leading-tight text-zinc-300">
            Workflows and agents that finish what they start.
          </p>
        </div>

        <div className="flex flex-col items-center gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-emerald-300/70">
            Install the skill
          </p>
          <div className="w-full max-w-[1500px] rounded-3xl border border-emerald-400/30 bg-emerald-500/10 px-10 py-7 shadow-[0_0_48px_rgba(52,211,153,0.12)]">
            <p className="whitespace-nowrap font-mono text-[30px] leading-tight text-emerald-200">
              npx skills add https://github.com/vercel/workflow --skill workflow-init
            </p>
          </div>
          <p className="max-w-3xl text-xl leading-snug text-zinc-400">
            Point it at your repo. Make one workflow stable, suspendable, or undoable tonight.
          </p>
        </div>

        <div className="rounded-2xl border border-white/10 bg-zinc-950/70 px-6 py-3">
          <p className="font-mono text-lg text-zinc-400">workflow-sdk.dev</p>
        </div>
      </div>
    </div>
  );
}
