import { getRun } from "workflow/api";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ runId: string }> },
) {
  const { runId } = await params;
  const run = getRun(runId);
  const source = run.getReadable();

  // The workflow stream contains structured objects. Encode each to
  // newline-delimited JSON bytes so it can be sent over HTTP.
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
    },
  });
}
