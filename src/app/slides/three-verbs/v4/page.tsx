import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: "400",
});

const items = [
  {
    verb: "RETRY",
    description: "When a step fails, try again without duplicating work.",
    verbColor: "text-sky-400",
  },
  {
    verb: "SUSPEND",
    description: "Pause for hours or days without losing progress.",
    verbColor: "text-amber-400",
  },
  {
    verb: "ROLLBACK",
    description: "When something breaks, undo everything that already happened.",
    verbColor: "text-fuchsia-400",
  },
];

export default function Page() {
  return (
    <main className="flex h-full w-full flex-col gap-20 p-24 lg:p-32">
      <h1 className="max-w-3xl text-6xl font-medium leading-tight tracking-tighter">
        Reliable software must be able to
      </h1>
      <div className="flex flex-col border-t border-white/5">
        {items.map((item, index) => (
          <div
            key={item.verb}
            className="flex w-full items-baseline gap-10 border-b border-white/5 py-10"
          >
            <span className="text-4xl font-bold text-zinc-700">
              0{index + 1}
            </span>
            <span
              className={`${geistMono.className} text-4xl ${item.verbColor}`}
            >
              {item.verb}
            </span>
            <p className="ml-auto max-w-lg text-right text-2xl text-zinc-400">
              {item.description}
            </p>
          </div>
        ))}
      </div>
    </main>
  );
}
