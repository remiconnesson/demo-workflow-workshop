import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400"],
});

export default function Page() {
  return (
    <main className="flex h-full w-full flex-col items-center justify-center gap-20 bg-black p-10 text-center">
      <h1 className="text-6xl font-medium tracking-tighter text-zinc-200">
        Reliable software must be able to
      </h1>

      <div className="flex w-full max-w-7xl flex-row items-start justify-center gap-10">
        <div className="flex flex-1 flex-col items-center gap-6">
          <div
            className={`flex items-center justify-center rounded-full border border-sky-500/30 bg-sky-500/5 px-10 py-4 ${geistMono.className}`}
          >
            <span className="text-3xl tracking-tighter text-sky-400">
              RETRY
            </span>
          </div>
          <p className="max-w-xs text-lg text-zinc-400">
            When a step fails, try again without duplicating work.
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center gap-6">
          <div
            className={`flex items-center justify-center rounded-full border border-amber-500/30 bg-amber-500/5 px-10 py-4 ${geistMono.className}`}
          >
            <span className="text-3xl tracking-tighter text-amber-400">
              SUSPEND
            </span>
          </div>
          <p className="max-w-xs text-lg text-zinc-400">
            Pause for hours or days without losing progress.
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center gap-6">
          <div
            className={`flex items-center justify-center rounded-full border border-fuchsia-500/30 bg-fuchsia-500/5 px-10 py-4 ${geistMono.className}`}
          >
            <span className="text-3xl tracking-tighter text-fuchsia-400">
              ROLLBACK
            </span>
          </div>
          <p className="max-w-xs text-lg text-zinc-400">
            When something breaks, undo everything that already happened.
          </p>
        </div>
      </div>
    </main>
  );
}
