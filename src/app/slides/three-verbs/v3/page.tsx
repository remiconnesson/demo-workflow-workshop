import { Geist_Mono } from "next/font/google";

const geist_mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export default function Page() {
  return (
    <div className="flex h-full w-full items-center justify-center p-10">
      <div className="flex w-full max-w-screen-2xl items-start justify-center gap-10">
        <div className="flex flex-1 flex-col items-center gap-6 text-center">
          <div
            className={`${geist_mono.className} text-7xl font-bold text-sky-400`}
          >
            RETRY
          </div>
          <div className="h-px w-full bg-sky-400/50" />
          <p className="max-w-sm text-2xl text-zinc-300">
            When a step fails, try again without duplicating work.
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center gap-6 text-center">
          <div
            className={`${geist_mono.className} text-7xl font-bold text-amber-400`}
          >
            SUSPEND
          </div>
          <div className="h-px w-full bg-amber-400/50" />
          <p className="max-w-sm text-2xl text-zinc-300">
            Pause for hours or days without losing progress.
          </p>
        </div>

        <div className="flex flex-1 flex-col items-center gap-6 text-center">
          <div
            className={`${geist_mono.className} text-7xl font-bold text-fuchsia-400`}
          >
            ROLLBACK
          </div>
          <div className="h-px w-full bg-fuchsia-400/50" />
          <p className="max-w-sm text-2xl text-zinc-300">
            When something breaks, undo everything that already happened.
          </p>
        </div>
      </div>
    </div>
  );
}
