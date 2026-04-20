import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = getRun(runId);
  const startIndexParam = new URL(request.url).searchParams.get("startIndex");
  const startIndex = startIndexParam !== null ? Number(startIndexParam) : NaN;
  const source = Number.isFinite(startIndex)
    ? run.getReadable({ startIndex })
    : run.getReadable();

  const tailIndex = await source.getTailIndex();

  const encoder = new TextEncoder();
  const ndjson = new TransformStream<unknown, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
    },
  });

  const body = source.pipeThrough(ndjson);

  return new Response(body, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
      "x-workflow-stream-tail-index": String(tailIndex),
    },
  });
}
