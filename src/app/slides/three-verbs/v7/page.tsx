import { Geist_Mono } from "next/font/google";

const geistMono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
});

export default function Page() {
  return (
    <main className="flex h-full w-full flex-col items-center justify-center bg-black p-10 text-white">
      <div className="flex w-full max-w-screen-xl flex-col items-start">
        <h1 className="mb-16 text-6xl font-bold tracking-tight">
          Reliable software must be able to
        </h1>

        <div className="flex flex-col gap-8 text-4xl leading-tight text-zinc-400">
          <p>
            ...
            <span
              className={`${geistMono.className} mx-4 font-bold text-sky-400`}
            >
              RETRY
            </span>{" "}
            — when a step fails, try again without duplicating work.
          </p>
          <p className="self-center">
            ...
            <span
              className={`${geistMono.className} mx-4 font-bold text-amber-400`}
            >
              SUSPEND
            </span>{" "}
            — pause for hours or days without losing progress.
          </p>
          <p className="self-end">
            ...
            <span
              className={`${geistMono.className} mx-4 font-bold text-fuchsia-400`}
            >
              ROLLBACK
            </span>{" "}
            — when something breaks, undo everything that already happened.
          </p>
        </div>
      </div>
    </main>
  );
}
