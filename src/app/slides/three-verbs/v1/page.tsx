import { Geist_Mono } from "next/font/google";

const geist_mono = Geist_Mono({
  subsets: ["latin"],
});

const items = [
  {
    verb: "RETRY",
    description: "When a step fails, try again without duplicating work.",
    verbClassName: "text-sky-400",
    cardClassName: "border-sky-500/30 bg-sky-500/5",
  },
  {
    verb: "SUSPEND",
    description: "Pause for hours or days without losing progress.",
    verbClassName: "text-amber-400",
    cardClassName: "border-amber-500/30 bg-amber-500/5",
  },
  {
    verb: "ROLLBACK",
    description: "When something breaks, undo everything that already happened.",
    verbClassName: "text-fuchsia-400",
    cardClassName: "border-fuchsia-500/30 bg-fuchsia-500/5",
  },
];

export default function Page() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-16">
      <h1 className="max-w-5xl text-center text-6xl font-light leading-tight">
        Reliable software must be able to{" "}
        <span className={`${geist_mono.className} ${items[0].verbClassName}`}>
          {items[0].verb}
        </span>
        ,{" "}
        <span className={`${geist_mono.className} ${items[1].verbClassName}`}>
          {items[1].verb}
        </span>
        , and{" "}
        <span className={`${geist_mono.className} ${items[2].verbClassName}`}>
          {items[2].verb}
        </span>
      </h1>

      <div className="grid w-full max-w-7xl grid-cols-3 gap-10">
        {items.map((item) => (
          <div
            key={item.verb}
            className={`flex items-center justify-center rounded-2xl border bg-zinc-950 p-10 ${item.cardClassName}`}
          >
            <p className="text-center text-xl text-zinc-300">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
