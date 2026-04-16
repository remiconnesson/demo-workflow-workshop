import { WorkflowMark } from "../_components/workflow-mark";

export default function CloseSlide() {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-10 px-20">
      <WorkflowMark size={64} className="text-white" />

      <h1 className="text-7xl font-semibold tracking-tight text-center">
        Ship it tonight
      </h1>

      <p className="mt-8 font-mono text-3xl text-zinc-300">workflow-sdk.dev</p>
    </div>
  );
}
