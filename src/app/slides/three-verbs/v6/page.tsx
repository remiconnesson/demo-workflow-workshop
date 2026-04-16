import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: "variable",
});

export default function Page() {
  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden bg-black p-10 font-sans text-white">
      <h1 className="absolute left-10 top-10 text-xl text-zinc-500">
        Reliable software must be able to
      </h1>

      <div className="grid w-full max-w-screen-2xl grid-cols-3 items-end gap-x-10">
        {/* Verbs */}
        <div
          className={`${geistMono.className} text-center text-9xl font-bold text-sky-400`}
        >
          RETRY
        </div>
        <div
          className={`${geistMono.className} text-center text-9xl font-bold text-amber-400`}
        >
          SUSPEND
        </div>
        <div
          className={`${geistMono.className} text-center text-9xl font-bold text-fuchsia-400`}
        >
          ROLLBACK
        </div>

        {/* Descriptions */}
        <p className="mt-4 text-center text-lg text-zinc-400">
          When a step fails, try again without duplicating work.
        </p>
        <p className="mt-4 text-center text-lg text-zinc-400">
          Pause for hours or days without losing progress.
        </p>
        <p className="mt-4 text-center text-lg text-zinc-400">
          When something breaks, undo everything that already happened.
        </p>
      </div>
    </div>
  );
}
