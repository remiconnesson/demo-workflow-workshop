import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
});

type Row = {
  eyebrow: string;
  command: string;
  description: string;
  tone: {
    border: string;
    pill: string;
    cmd: string;
  };
};

const ROWS: readonly Row[] = [
  {
    eyebrow: "Humans",
    command: "npx workflow web <run_id>",
    description: "Dashboard · timeline · streams",
    tone: {
      border: "border-sky-400/25",
      pill: "border-sky-400/35 bg-sky-500/10 text-sky-300",
      cmd: "text-sky-300",
    },
  },
  {
    eyebrow: "Agents",
    command: "npx workflow inspect run <run_id>",
    description: "LLM-readable output, paste into Claude or Cursor",
    tone: {
      border: "border-fuchsia-400/25",
      pill: "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-300",
      cmd: "text-fuchsia-300",
    },
  },
];

export default function ObservabilitySlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col justify-center gap-12 px-10 pt-20 pb-12">
      <div className="flex flex-col items-center gap-4 text-center">
        <h2 className="text-7xl font-semibold tracking-tight">
          Every run is observable.
        </h2>
        <p className="max-w-5xl text-2xl leading-snug text-zinc-400">
          Humans inspect the timeline. Agents inspect the event log.
        </p>
      </div>

      <div className="flex flex-col gap-6">
        {ROWS.map((r) => (
          <div
            key={r.eyebrow}
            className={`flex items-center gap-10 rounded-2xl border bg-zinc-950 px-10 py-8 ${r.tone.border}`}
          >
            <div className="flex w-[240px] shrink-0 flex-col gap-3">
              <span
                className={`self-start rounded-full border px-5 py-2 text-base font-semibold uppercase tracking-[0.2em] ${r.tone.pill} ${geistMono.className}`}
              >
                {r.eyebrow}
              </span>
              <p className="text-lg leading-snug text-zinc-500">
                {r.description}
              </p>
            </div>

            <div className="min-w-0 flex-1 rounded-xl border border-white/10 bg-black px-8 py-5">
              <p
                className={`text-2xl leading-tight ${r.tone.cmd} ${geistMono.className}`}
              >
                <span className="text-zinc-600">$ </span>
                {r.command}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
