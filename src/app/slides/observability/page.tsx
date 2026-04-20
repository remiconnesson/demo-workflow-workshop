import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
});

type Card = {
  eyebrow: string;
  command: string;
  lines: readonly string[];
  tone: {
    border: string;
    bg: string;
    pill: string;
    cmd: string;
  };
  isLog?: boolean;
};

const CARDS: readonly Card[] = [
  {
    eyebrow: "Human surface",
    command: "npx workflow web <run_id>",
    lines: [
      "Dashboard · timeline · streams",
      "Step history at a glance",
    ],
    tone: {
      border: "border-sky-400/25",
      bg: "bg-sky-500/[0.04]",
      pill: "border-sky-400/35 bg-sky-500/10 text-sky-300",
      cmd: "text-sky-200",
    },
  },
  {
    eyebrow: "Event log",
    command: "steps · hooks · sleeps · streams · compensations",
    lines: [
      "One durable record per run",
      "Replay, audit, debug — all from the same source",
    ],
    tone: {
      border: "border-emerald-400/25",
      bg: "bg-emerald-500/[0.04]",
      pill: "border-emerald-400/35 bg-emerald-500/10 text-emerald-300",
      cmd: "text-emerald-200",
    },
    isLog: true,
  },
  {
    eyebrow: "Agent surface",
    command: "npx workflow inspect run <run_id>",
    lines: [
      "LLM-readable output",
      "Paste into Claude or Cursor",
    ],
    tone: {
      border: "border-fuchsia-400/25",
      bg: "bg-fuchsia-500/[0.04]",
      pill: "border-fuchsia-400/35 bg-fuchsia-500/10 text-fuchsia-300",
      cmd: "text-fuchsia-200",
    },
  },
];

export default function ObservabilitySlide() {
  return (
    <div className="mx-auto flex h-full w-full max-w-[1600px] flex-col justify-center gap-12 px-20 py-20">
      <div className="flex flex-col items-center gap-6 text-center">
        <p
          className={`text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500 ${geistMono.className}`}
        >
          Same run, two consumers
        </p>
        <h2 className="text-8xl font-semibold tracking-tight">
          Every run is observable.
        </h2>
        <p className="max-w-5xl text-3xl leading-snug text-zinc-400">
          Humans inspect the timeline. Agents inspect the event log. Same run.
          Same truth.
        </p>
      </div>

      <div className="grid grid-cols-[1fr_0.8fr_1fr] gap-6">
        {CARDS.map((c) => (
          <section
            key={c.eyebrow}
            className={`flex min-h-[360px] flex-col gap-6 rounded-3xl border p-8 ${c.tone.border} ${c.tone.bg}`}
          >
            <span
              className={`self-start rounded-full border px-4 py-1.5 text-sm font-semibold uppercase tracking-[0.2em] ${c.tone.pill} ${geistMono.className}`}
            >
              {c.eyebrow}
            </span>

            {c.isLog ? (
              <ul className="flex flex-col gap-3 text-2xl leading-snug text-zinc-200">
                {c.command.split(" · ").map((token) => (
                  <li key={token} className="flex items-center gap-3">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400/70" />
                    <span className={geistMono.className}>{token}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p
                className={`truncate whitespace-nowrap font-mono text-[28px] leading-tight ${c.tone.cmd}`}
              >
                <span className="text-zinc-600">$ </span>
                {c.command}
              </p>
            )}

            <div className="mt-auto flex flex-col gap-1.5">
              {c.lines.map((line) => (
                <p key={line} className="text-lg leading-snug text-zinc-400">
                  {line}
                </p>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
