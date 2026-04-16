import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
});

const reliableFeatures = [
  {
    verb: "RETRY",
    description: "When a step fails, try again without duplicating work.",
    className: "text-sky-400 border-sky-500/30 bg-sky-500/5",
  },
  {
    verb: "SUSPEND",
    description: "Pause for hours or days without losing progress.",
    className: "text-amber-400 border-amber-500/30 bg-amber-500/5",
  },
  {
    verb: "ROLLBACK",
    description: "When something breaks, undo everything that already happened.",
    className: "text-fuchsia-400 border-fuchsia-500/30 bg-fuchsia-500/5",
  },
];

export default function Page() {
  return (
    <div className="flex h-full w-full items-center p-24">
      <div className="flex w-1/2 items-center justify-start pr-24">
        <h1 className="text-7xl font-light tracking-tighter">
          Reliable software must be able to
        </h1>
      </div>

      <div className="flex w-1/2 flex-col justify-center gap-6">
        {reliableFeatures.map(({ verb, description, className }) => (
          <div
            key={verb}
            className={`flex items-baseline gap-x-5 rounded-2xl border p-6 ${className}`}
          >
            <span
              className={`${geistMono.className} text-xl font-medium`}
            >
              {verb}
            </span>
            <p className="text-lg text-zinc-400">{description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
