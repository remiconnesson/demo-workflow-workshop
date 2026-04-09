import { TriangleMark } from "../_components/triangle-mark";

export default function CloseSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <TriangleMark size={64} className="text-white" />

      <h1 className="text-7xl font-semibold tracking-tight">
        Ship it tonight
      </h1>

      <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-6 py-3 font-mono text-xl text-emerald-400">
          &quot;use workflow&quot;
        </span>
        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/5 px-6 py-3 font-mono text-xl text-emerald-400">
          &quot;use step&quot;
        </span>
        <span className="rounded-full border border-amber-500/30 bg-amber-500/5 px-6 py-3 font-mono text-xl text-amber-400">
          createHook
        </span>
        <span className="rounded-full border border-sky-500/30 bg-sky-500/5 px-6 py-3 font-mono text-xl text-sky-400">
          getWritable
        </span>
        <span className="rounded-full border border-fuchsia-500/30 bg-fuchsia-500/5 px-6 py-3 font-mono text-xl text-fuchsia-400">
          Saga compensation
        </span>
      </div>

      <p className="mt-12 font-mono text-3xl text-zinc-400">
        vercel.com/docs/workflow
      </p>

      <p className="mt-16 text-xl text-zinc-600">
        Press <span className="font-mono">d</span> to return to demo
      </p>
    </div>
  );
}
