import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Mocks — must come before route imports
// ---------------------------------------------------------------------------

function makeClosedStream() {
  return new ReadableStream({
    start(c) {
      c.close();
    },
  });
}

const mockGetReadable = vi.fn(() =>
  Object.assign(makeClosedStream(), {
    getTailIndex: vi.fn().mockResolvedValue(42),
  }),
);

vi.mock("workflow/api", () => ({
  start: vi.fn().mockResolvedValue({
    runId: "test-run-123",
    readable: makeClosedStream(),
  }),
  getRun: vi.fn(() => ({
    getReadable: mockGetReadable,
    status: Promise.resolve("running"),
  })),
  resumeHook: vi.fn(),
}));

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: ResponseInit) => Response.json(data, init),
  },
}));

vi.mock("@/workflows/place-order", () => ({
  placeOrderWorkflow: vi.fn(),
}));

vi.mock("@/workflows/observer-agent", () => ({
  observerAgentWorkflow: vi.fn(),
}));

vi.mock("@/workflows/analyst-agent", () => ({
  analystAgentWorkflow: vi.fn(),
}));

vi.mock("@/lib/latest-run-store", () => ({
  setLatestRunId: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("orders/start route", () => {
  it("returns HTTP 202 Accepted", async () => {
    const { POST } = await import(
      "@/app/api/orders/start/route"
    );
    const req = new Request("http://localhost/api/orders/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        orderId: "test-1",
        items: [{ name: "burger", price: 10 }],
      }),
    });
    const res = await POST(req);
    expect(res.status).toBe(202);
  });
});

describe("observer/start route", () => {
  it("returns HTTP 202 Accepted", async () => {
    const { POST } = await import(
      "@/app/api/agent/observer/start/route"
    );
    const res = await POST();
    expect(res.status).toBe(202);
  });
});

describe("analyst/chat route", () => {
  it("returns x-workflow-run-id header (not X-Run-Id)", async () => {
    const { POST } = await import(
      "@/app/api/agent/analyst/chat/route"
    );
    const req = new Request("http://localhost/api/agent/analyst/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [] }),
    });
    const res = await POST(req);
    expect(res.headers.get("x-workflow-run-id")).toBeTruthy();
    expect(res.headers.has("X-Run-Id")).toBe(false);
  });
});

describe("analyst/chat/[runId] reconnect route", () => {
  beforeEach(() => {
    mockGetReadable.mockClear();
  });

  it("passes startIndex query param to getReadable", async () => {
    const { GET } = await import(
      "@/app/api/agent/analyst/chat/[runId]/route"
    );
    const req = new Request(
      "http://localhost/api/agent/analyst/chat/run-1?startIndex=5",
    );
    await GET(req, { params: Promise.resolve({ runId: "run-1" }) });
    expect(mockGetReadable).toHaveBeenCalledWith(
      expect.objectContaining({ startIndex: 5 }),
    );
  });

  it("returns x-workflow-stream-tail-index header", async () => {
    const { GET } = await import(
      "@/app/api/agent/analyst/chat/[runId]/route"
    );
    const req = new Request(
      "http://localhost/api/agent/analyst/chat/run-1",
    );
    const res = await GET(req, {
      params: Promise.resolve({ runId: "run-1" }),
    });
    expect(res.headers.get("x-workflow-stream-tail-index")).toBe("42");
  });

  it("returns x-workflow-run-id header", async () => {
    const { GET } = await import(
      "@/app/api/agent/analyst/chat/[runId]/route"
    );
    const req = new Request(
      "http://localhost/api/agent/analyst/chat/run-1",
    );
    const res = await GET(req, {
      params: Promise.resolve({ runId: "run-1" }),
    });
    expect(res.headers.get("x-workflow-run-id")).toBe("run-1");
  });
});

describe("runs/[runId]/stream route", () => {
  it("returns x-workflow-stream-tail-index header", async () => {
    const { GET } = await import(
      "@/app/api/runs/[runId]/stream/route"
    );
    const req = new Request("http://localhost/api/runs/run-1/stream");
    const res = await GET(req, {
      params: Promise.resolve({ runId: "run-1" }),
    });
    expect(res.headers.get("x-workflow-stream-tail-index")).toBe("42");
  });
});
