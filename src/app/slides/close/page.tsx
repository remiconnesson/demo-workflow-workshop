import { WorkflowMark } from "../_components/workflow-mark";

export default function CloseSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 text-center">
      <div className="relative">
        <div
          aria-hidden
          className="absolute -inset-8 rounded-full bg-white/[0.035] blur-3xl"
        />
        <WorkflowMark size={72} className="relative text-white" />
      </div>
      <h1 className="text-8xl font-semibold tracking-tight text-white">
        Workflow SDK
      </h1>
      <p className="text-3xl text-zinc-400">Build reliable agents</p>
    </div>
  );
}
