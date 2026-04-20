import { getRun } from "workflow/api";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const { searchParams } = new URL(request.url);

  const startIndexParam = searchParams.get("startIndex");
  const startIndex = startIndexParam
    ? parseInt(startIndexParam, 10)
    : undefined;

  const run = getRun(runId);
  const readable = run.getReadable({ startIndex });

  const encoder = new TextEncoder();
  const ndjson = new TransformStream<unknown, Uint8Array>({
    transform(chunk, controller) {
      controller.enqueue(encoder.encode(JSON.stringify(chunk) + "\n"));
    },
  });

  return new Response(readable.pipeThrough(ndjson), {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache, no-transform",
    },
  });
}
