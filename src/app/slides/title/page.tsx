import { TriangleMark } from "../_components/triangle-mark";

export default function TitleSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <TriangleMark size={80} className="text-white" />

      <h1 className="text-8xl font-semibold tracking-tight text-center">
        Vercel Workflow SDK
      </h1>

      <p className="text-3xl text-zinc-400 text-center max-w-3xl">
        Durable, resumable workflows for Next.js
      </p>

      <div className="mt-16 flex items-center gap-8">
        <span className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-mono text-xl text-zinc-400">
          &quot;use workflow&quot;
        </span>
        <span className="rounded-full border border-white/10 bg-white/5 px-6 py-3 font-mono text-xl text-zinc-400">
          &quot;use step&quot;
        </span>
      </div>

      <p className="mt-20 text-xl text-zinc-600 animate-pulse">
        Press &rarr; to begin
      </p>
    </div>
  );
}
