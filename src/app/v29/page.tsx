"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

type MenuItem = OrderItem & { desc: string };

const MENU: MenuItem[] = [
  { id: "deployer", name: "The Deployer", desc: "Classic glazed · vanilla", price: 4.0, qty: 0 },
  { id: "edge", name: "Edge Runtime", desc: "Powdered sugar · fast", price: 4.5, qty: 0 },
  { id: "cold", name: "Cold Start", desc: "Frozen icing · crisp", price: 5.0, qty: 0 },
  { id: "hot", name: "Hot Module", desc: "Molten cinnamon core", price: 4.5, qty: 0 },
  { id: "isr", name: "ISR Glaze", desc: "Revalidates on taste", price: 5.5, qty: 0 },
];

type StepState = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

const STEPS: { id: string; label: string; sub: string }[] = [
  { id: "validateOrder", label: "Validate order", sub: "Schema & stock" },
  { id: "chargePayment", label: "Charge payment", sub: "Stripe authorize" },
  { id: "notifyRestaurant", label: "Notify bakery", sub: "Await accept" },
  { id: "assignDriver", label: "Assign courier", sub: "Dispatch" },
  { id: "trackDelivery", label: "Track delivery", sub: "Live ETA" },
  { id: "sendReceipt", label: "Send receipt", sub: "Email + SMS" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "No failure (happy path)" },
  { value: "validateOrder", label: "Fail at validateOrder" },
  { value: "chargePayment", label: "Fail at chargePayment" },
  { value: "notifyRestaurant", label: "Fail at notifyRestaurant" },
  { value: "assignDriver", label: "Fail at assignDriver" },
  { value: "trackDelivery", label: "Fail at trackDelivery" },
  { value: "sendReceipt", label: "Fail at sendReceipt" },
];

function TriangleMark({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size * 0.9} viewBox="0 0 24 22" className={className} aria-hidden>
      <path d="M12 0 L24 22 L0 22 Z" fill="currentColor" />
    </svg>
  );
}

function formatEventLine(e: OrderEvent): { kind: string; msg: string } {
  switch (e.type) {
    case "step_running":
      return { kind: "RUN", msg: `${e.step} · ${e.label}` };
    case "step_succeeded":
      return { kind: "OK ", msg: `${e.step}${e.detail ? ` · ${e.detail}` : ""}` };
    case "step_failed":
      return { kind: "ERR", msg: `${e.step} · ${e.error}` };
    case "step_skipped":
      return { kind: "SKP", msg: `${e.step}` };
    case "waiting_for_hook":
      return { kind: "WAI", msg: `${e.step} · awaiting ${e.token}` };
    case "hook_resolved":
      return { kind: "HOK", msg: `${e.step}${e.detail ? ` · ${e.detail}` : ""}` };
    case "compensation_pushed":
      return { kind: "CMP", msg: `pushed ${e.action} (for ${e.forStep})` };
    case "compensating":
      return { kind: "CMP", msg: `running ${e.action}` };
    case "compensated":
      return { kind: "CMP", msg: `done ${e.action}` };
    case "log":
      return { kind: "LOG", msg: e.message };
    case "done":
      return { kind: "END", msg: `${e.status} · ${e.orderId}` };
  }
}

function kindColor(kind: string) {
  switch (kind) {
    case "OK ":
      return "text-emerald-400";
    case "ERR":
      return "text-red-400";
    case "WAI":
    case "HOK":
      return "text-amber-400";
    case "CMP":
      return "text-fuchsia-400";
    case "RUN":
      return "text-sky-400";
    case "END":
      return "text-white";
    default:
      return "text-zinc-500";
  }
}

export default function V29Page() {
  const [cart, setCart] = useState<MenuItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "deployer" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [address, setAddress] = useState("440 N Wolfe Rd, Sunnyvale");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);

  const [running, setRunning] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepState, setStepState] = useState<Record<string, StepState>>({});
  const [compensations, setCompensations] = useState<string[]>([]);
  const [doneStatus, setDoneStatus] = useState<"completed" | "rolled_back" | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [waitingOn, setWaitingOn] = useState<string | null>(null);

  const autoAckRef = useRef(autoAck);
  autoAckRef.current = autoAck;
  const orderIdRef = useRef<string | null>(null);
  const feedRef = useRef<HTMLDivElement>(null);

  // live elapsed ticker
  useEffect(() => {
    if (!startedAt || doneStatus) return;
    const t = setInterval(() => setElapsed(Date.now() - startedAt), 100);
    return () => clearInterval(t);
  }, [startedAt, doneStatus]);

  // event feed autoscroll
  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" });
  }, [events]);

  const cartItems = cart.filter((i) => i.qty > 0);
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const fee = cartItems.length > 0 ? 2.0 : 0;
  const total = subtotal + fee;

  const inc = (id: string) =>
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: i.qty + 1 } : i)));
  const dec = (id: string) =>
    setCart((c) =>
      c.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty - 1) } : i)),
    );

  const resume = useCallback(
    async (
      kind: "restaurant-accept" | "driver-accept" | "delivered",
      body: Record<string, unknown> = {},
    ) => {
      const id = orderIdRef.current;
      if (!id) return;
      await fetch(`/api/orders/${id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...body }),
      });
    },
    [],
  );

  const reset = () => {
    setRunning(false);
    setOrderId(null);
    setRunId(null);
    setEvents([]);
    setStepState({});
    setCompensations([]);
    setDoneStatus(null);
    setStartedAt(null);
    setElapsed(0);
    setWaitingOn(null);
    orderIdRef.current = null;
  };

  const placeOrder = async () => {
    if (running) return;
    reset();
    setRunning(true);
    setStartedAt(Date.now());

    const input: OrderInput = {
      orderId: `ord_${Math.random().toString(36).slice(2, 10)}`,
      customerName,
      address,
      items: cartItems.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
      failAt,
      autoAck,
    };

    const res = await fetch("/api/orders/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const { runId: rid, orderId: oid } = (await res.json()) as {
      runId: string;
      orderId: string;
    };
    setRunId(rid);
    setOrderId(oid);
    orderIdRef.current = oid;

    const stream = await fetch(`/api/runs/${rid}/stream`);
    if (!stream.body) return;
    const reader = stream.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        const ev = JSON.parse(line) as OrderEvent;
        setEvents((prev) => [...prev, ev]);

        switch (ev.type) {
          case "step_running":
            setStepState((s) => ({ ...s, [ev.step]: "running" }));
            break;
          case "step_succeeded":
            setStepState((s) => ({ ...s, [ev.step]: "success" }));
            setWaitingOn((w) => (w === ev.step ? null : w));
            break;
          case "step_failed":
            setStepState((s) => ({ ...s, [ev.step]: "failed" }));
            break;
          case "step_skipped":
            setStepState((s) => ({ ...s, [ev.step]: "skipped" }));
            break;
          case "waiting_for_hook": {
            setStepState((s) => ({ ...s, [ev.step]: "waiting" }));
            setWaitingOn(ev.step);
            if (autoAckRef.current) {
              const kind =
                ev.step === "notifyRestaurant"
                  ? "restaurant-accept"
                  : ev.step === "assignDriver"
                    ? "driver-accept"
                    : "delivered";
              setTimeout(() => {
                void resume(kind, kind === "delivered" ? {} : { accepted: true });
              }, 800);
            }
            break;
          }
          case "hook_resolved":
            setWaitingOn((w) => (w === ev.step ? null : w));
            break;
          case "compensation_pushed":
            setCompensations((c) => [...c, ev.action]);
            break;
          case "done":
            setDoneStatus(ev.status);
            setRunning(false);
            setWaitingOn(null);
            break;
        }
      }
    }
  };

  const phoneView: "menu" | "tracking" = orderId ? "tracking" : "menu";

  // visual helpers
  const statusChip = () => {
    if (doneStatus === "completed")
      return { label: "Ready", dot: "bg-emerald-500", text: "text-emerald-400" };
    if (doneStatus === "rolled_back")
      return { label: "Rolled back", dot: "bg-red-500", text: "text-red-400" };
    if (running) return { label: "Building", dot: "bg-amber-400 animate-pulse", text: "text-amber-300" };
    return { label: "Idle", dot: "bg-zinc-600", text: "text-zinc-400" };
  };
  const chip = statusChip();

  const fmtElapsed = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const dec = Math.floor((ms % 1000) / 100);
    return `${s}.${dec}s`;
  };

  return (
    <div className={`min-h-screen bg-black text-white ${geist.className}`}>
      {/* ──────────────────────────── TOP BAR ──────────────────────────── */}
      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/80 backdrop-blur">
        <div className="flex h-20 items-center gap-10 px-12">
          <div className="flex items-center gap-4">
            <TriangleMark size={28} className="text-white" />
            <span className="text-2xl font-semibold tracking-tight">triangle-donuts</span>
            <span className="text-xl text-zinc-600">/</span>
            <span className="text-xl text-zinc-400">orders</span>
            {orderId && (
              <>
                <span className="text-xl text-zinc-600">/</span>
                <span className={`text-xl text-zinc-200 ${geistMono.className}`}>{orderId}</span>
              </>
            )}
          </div>
          <div className="ml-auto flex items-center gap-6">
            <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-5 py-2">
              <span className={`h-3 w-3 rounded-full ${chip.dot}`} />
              <span className={`text-lg font-medium ${chip.text}`}>{chip.label}</span>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-5 py-2 text-lg text-zinc-300 lg:flex">
              <span className="text-zinc-500">branch</span>
              <span className={geistMono.className}>main</span>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-gradient-to-br from-white to-zinc-400 text-xl font-semibold text-black">
              A
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1920px] flex-col gap-16 p-12 xl:flex-row xl:items-start">
        {/* ──────────────────────────── LEFT: PHONE ──────────────────────────── */}
        <div className="flex shrink-0 justify-center xl:sticky xl:top-28">
          <div className="relative h-[1120px] w-[560px] overflow-hidden rounded-[56px] border-[14px] border-zinc-900 bg-white text-black shadow-[0_60px_120px_-20px_rgba(0,0,0,0.8)]">
            {/* dynamic island */}
            <div className="absolute left-1/2 top-3 z-20 h-9 w-48 -translate-x-1/2 rounded-full bg-black" />

            {/* status bar */}
            <div className="flex h-16 items-center justify-between px-10 pt-4 text-lg font-medium">
              <span>9:41</span>
              <span className="flex items-center gap-2">
                <span>●●●●</span>
                <span>100%</span>
              </span>
            </div>

            {phoneView === "menu" && (
              <div className="flex h-[calc(100%-4rem)] flex-col">
                <div className="flex items-center gap-3 border-b border-zinc-100 px-10 py-6">
                  <TriangleMark size={26} className="text-black" />
                  <span className="text-2xl font-semibold tracking-tight">Triangle Donuts</span>
                </div>

                <div className="flex-1 overflow-y-auto px-10 py-8">
                  <h2 className="mb-2 text-4xl font-semibold tracking-tight">Fresh today</h2>
                  <p className="mb-8 text-xl text-zinc-500">Built at the edge. Delivered warm.</p>

                  <div className="flex flex-col divide-y divide-zinc-100">
                    {cart.map((item) => (
                      <div key={item.id} className="flex items-center justify-between py-6">
                        <div className="flex-1 pr-6">
                          <div className="text-2xl font-semibold">{item.name}</div>
                          <div className="mt-1 text-lg text-zinc-500">{item.desc}</div>
                          <div className="mt-2 text-xl font-medium text-zinc-900">
                            ${item.price.toFixed(2)}
                          </div>
                        </div>
                        {item.qty === 0 ? (
                          <button
                            onClick={() => inc(item.id)}
                            className="h-14 w-14 rounded-full border border-zinc-200 text-3xl font-light transition-colors hover:border-black hover:bg-black hover:text-white"
                            aria-label={`add ${item.name}`}
                          >
                            +
                          </button>
                        ) : (
                          <div className="flex items-center gap-4 rounded-full border border-zinc-200 px-3 py-1">
                            <button
                              onClick={() => dec(item.id)}
                              className="h-10 w-10 text-2xl font-light"
                            >
                              −
                            </button>
                            <span className="w-6 text-center text-xl font-semibold">
                              {item.qty}
                            </span>
                            <button
                              onClick={() => inc(item.id)}
                              className="h-10 w-10 text-2xl font-light"
                            >
                              +
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="mt-10 flex flex-col gap-4">
                    <label className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Name
                    </label>
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-xl outline-none focus:border-black"
                    />
                    <label className="mt-2 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                      Deliver to
                    </label>
                    <input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      className="rounded-xl border border-zinc-200 bg-zinc-50 px-5 py-4 text-xl outline-none focus:border-black"
                    />
                  </div>
                </div>

                <div className="border-t border-zinc-100 bg-white px-10 pb-12 pt-6">
                  <div className="mb-4 flex items-baseline justify-between text-xl">
                    <span className="text-zinc-500">
                      Subtotal · {cartItems.reduce((s, i) => s + i.qty, 0)} items
                    </span>
                    <span className="font-semibold">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="mb-6 flex items-baseline justify-between text-xl">
                    <span className="text-zinc-500">Delivery</span>
                    <span className="font-semibold">${fee.toFixed(2)}</span>
                  </div>
                  <button
                    onClick={placeOrder}
                    disabled={cartItems.length === 0 || running}
                    className="flex w-full items-center justify-between rounded-2xl bg-black px-8 py-6 text-2xl font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40"
                  >
                    <span>Place order</span>
                    <span>${total.toFixed(2)}</span>
                  </button>
                </div>
              </div>
            )}

            {phoneView === "tracking" && (
              <div className="flex h-[calc(100%-4rem)] flex-col">
                <div className="flex items-center gap-3 border-b border-zinc-100 px-10 py-6">
                  <TriangleMark size={26} className="text-black" />
                  <span className="text-2xl font-semibold tracking-tight">Your order</span>
                </div>

                <div className="flex-1 overflow-y-auto px-10 py-8">
                  <div className="mb-2 text-lg font-medium uppercase tracking-[0.2em] text-zinc-500">
                    {doneStatus === "completed"
                      ? "Delivered"
                      : doneStatus === "rolled_back"
                        ? "Refunded"
                        : "In progress"}
                  </div>
                  <h2 className="mb-2 text-5xl font-semibold leading-none tracking-tight">
                    {doneStatus === "completed"
                      ? "Enjoy your donuts."
                      : doneStatus === "rolled_back"
                        ? "Something went wrong."
                        : "Heading your way"}
                  </h2>
                  <p className={`text-xl text-zinc-500 ${geistMono.className}`}>{orderId}</p>

                  <div className="mt-10 flex flex-col gap-0">
                    {STEPS.map((s, i) => {
                      const state = stepState[s.id] ?? "pending";
                      const isLast = i === STEPS.length - 1;
                      const dotBase =
                        "h-14 w-14 shrink-0 rounded-full border-2 flex items-center justify-center text-xl font-semibold";
                      const dot =
                        state === "success"
                          ? "border-black bg-black text-white"
                          : state === "running"
                            ? "border-black bg-white text-black animate-pulse"
                            : state === "waiting"
                              ? "border-amber-500 bg-amber-50 text-amber-600"
                              : state === "failed"
                                ? "border-red-500 bg-red-50 text-red-600"
                                : state === "skipped"
                                  ? "border-zinc-200 bg-zinc-50 text-zinc-400"
                                  : "border-zinc-200 bg-white text-zinc-400";
                      const line =
                        state === "success" ? "bg-black" : "bg-zinc-200";
                      return (
                        <div key={s.id} className="flex items-start gap-6">
                          <div className="flex flex-col items-center">
                            <div className={`${dotBase} ${dot}`}>
                              {state === "success" ? "✓" : state === "failed" ? "!" : i + 1}
                            </div>
                            {!isLast && <div className={`w-[2px] flex-1 min-h-[56px] ${line}`} />}
                          </div>
                          <div className="flex-1 pb-10 pt-3">
                            <div className="text-2xl font-semibold">{s.label}</div>
                            <div className="mt-1 text-lg text-zinc-500">{s.sub}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-zinc-100 bg-white px-10 pb-12 pt-6">
                  <button
                    onClick={reset}
                    className="w-full rounded-2xl border border-zinc-200 bg-white px-8 py-5 text-xl font-semibold text-zinc-700 transition-colors hover:border-black hover:text-black"
                  >
                    Place another order
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ──────────────────────────── RIGHT: DASHBOARD ──────────────────────────── */}
        <div className="flex-1 space-y-10">
          {/* deployment-card-style header */}
          <section className="rounded-2xl border border-white/10 bg-zinc-950 p-10">
            <div className="flex flex-wrap items-start justify-between gap-8">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Current run
                </div>
                <h1 className="mt-3 text-6xl font-semibold tracking-tight">
                  {doneStatus === "completed"
                    ? "Delivered"
                    : doneStatus === "rolled_back"
                      ? "Rolled back"
                      : running
                        ? "Orchestrating…"
                        : "Ready to dispatch"}
                </h1>
                <div className={`mt-4 flex items-center gap-6 text-xl text-zinc-400 ${geistMono.className}`}>
                  <span>{orderId ?? "—"}</span>
                  <span className="text-zinc-700">•</span>
                  <span>run {runId ?? "—"}</span>
                </div>
              </div>
              <div className="flex items-center gap-10">
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">Elapsed</div>
                  <div className={`mt-2 text-4xl font-semibold ${geistMono.className}`}>
                    {fmtElapsed(elapsed)}
                  </div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">Steps</div>
                  <div className={`mt-2 text-4xl font-semibold ${geistMono.className}`}>
                    {Object.values(stepState).filter((s) => s === "success").length}/{STEPS.length}
                  </div>
                </div>
                <div>
                  <div className="text-sm uppercase tracking-[0.2em] text-zinc-500">Comps</div>
                  <div className={`mt-2 text-4xl font-semibold ${compensations.length ? "text-fuchsia-400" : ""} ${geistMono.className}`}>
                    {compensations.length}
                  </div>
                </div>
              </div>
            </div>

            {/* horizontal step timeline */}
            <div className="mt-12 overflow-x-auto pb-2">
              <div className="relative flex min-w-max items-start gap-0">
                {STEPS.map((s, i) => {
                  const state = stepState[s.id] ?? "pending";
                  const isLast = i === STEPS.length - 1;

                  const nodeBase =
                    "relative z-10 flex h-[96px] w-[96px] items-center justify-center rounded-full border-2 text-3xl font-semibold transition-colors";
                  const nodeStyle =
                    state === "success"
                      ? "bg-white border-white text-black"
                      : state === "running"
                        ? "border-sky-400 text-sky-300"
                        : state === "waiting"
                          ? "border-amber-400 text-amber-300"
                          : state === "failed"
                            ? "border-red-500 bg-red-500/10 text-red-400"
                            : state === "skipped"
                              ? "border-zinc-800 bg-zinc-900 text-zinc-600"
                              : "border-white/15 text-zinc-600";

                  const lineColor =
                    state === "success" ? "bg-white" : "bg-white/10";

                  return (
                    <div key={s.id} className="flex min-w-[180px] flex-col items-center">
                      <div className="flex w-full items-center">
                        <div className={`h-[2px] flex-1 ${i === 0 ? "opacity-0" : lineColor}`} />
                        <div className={`${nodeBase} ${nodeStyle}`}>
                          {state === "success" ? (
                            <TriangleMark size={32} className="text-black" />
                          ) : state === "failed" ? (
                            "!"
                          ) : state === "running" ? (
                            <span className="animate-pulse">●</span>
                          ) : state === "waiting" ? (
                            "II"
                          ) : (
                            i + 1
                          )}
                        </div>
                        <div className={`h-[2px] flex-1 ${isLast ? "opacity-0" : lineColor}`} />
                      </div>
                      <div className="mt-5 w-full px-2 text-center">
                        <div className="text-xl font-semibold tracking-tight">{s.label}</div>
                        <div className={`mt-1 text-base uppercase tracking-wider ${geistMono.className} text-zinc-500`}>
                          {state}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {/* controls row */}
          <section className="grid gap-8 lg:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-10">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Scenario
              </div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight">Simulate failure</h3>
              <p className="mt-2 text-lg text-zinc-500">
                Force the saga to fail at a specific step to watch compensations run in reverse.
              </p>
              <select
                value={failAt ?? ""}
                onChange={(e) =>
                  setFailAt((e.target.value as FailStep) || null)
                }
                className={`mt-6 w-full rounded-xl border border-white/10 bg-black px-6 py-5 text-xl focus:border-white focus:outline-none ${geistMono.className}`}
              >
                {FAIL_OPTIONS.map((opt) => (
                  <option key={String(opt.value)} value={opt.value ?? ""}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-2xl border border-white/10 bg-zinc-950 p-10">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                Hooks
              </div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight">Auto-resume</h3>
              <p className="mt-2 text-lg text-zinc-500">
                When enabled, paused steps auto-acknowledge after 800ms so the run completes end-to-end.
              </p>
              <label className="mt-6 flex cursor-pointer items-center justify-between rounded-xl border border-white/10 bg-black px-6 py-5">
                <span className="text-xl">Automatic hook resolution</span>
                <span
                  className={`relative inline-flex h-8 w-16 items-center rounded-full transition-colors ${
                    autoAck ? "bg-white" : "bg-zinc-700"
                  }`}
                >
                  <span
                    className={`inline-block h-6 w-6 transform rounded-full bg-black transition-transform ${
                      autoAck ? "translate-x-9" : "translate-x-1"
                    }`}
                  />
                </span>
                <input
                  type="checkbox"
                  className="hidden"
                  checked={autoAck}
                  onChange={(e) => setAutoAck(e.target.checked)}
                />
              </label>

              {/* manual hook controls — visible when waiting & autoAck off */}
              {waitingOn && !autoAck && (
                <div className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/5 p-6">
                  <div className="text-sm font-semibold uppercase tracking-[0.2em] text-amber-300">
                    Awaiting manual resolution
                  </div>
                  <div className="mt-2 text-2xl font-semibold">{waitingOn}</div>
                  <div className="mt-5 flex flex-wrap gap-4">
                    {waitingOn === "notifyRestaurant" && (
                      <>
                        <button
                          onClick={() => resume("restaurant-accept", { accepted: true })}
                          className="rounded-xl bg-white px-6 py-4 text-lg font-semibold text-black hover:opacity-90"
                        >
                          Restaurant accept
                        </button>
                        <button
                          onClick={() =>
                            resume("restaurant-accept", { accepted: false, reason: "closed" })
                          }
                          className="rounded-xl border border-red-500/40 px-6 py-4 text-lg font-semibold text-red-400 hover:bg-red-500/10"
                        >
                          Restaurant reject
                        </button>
                      </>
                    )}
                    {waitingOn === "assignDriver" && (
                      <>
                        <button
                          onClick={() => resume("driver-accept", { accepted: true })}
                          className="rounded-xl bg-white px-6 py-4 text-lg font-semibold text-black hover:opacity-90"
                        >
                          Driver accept
                        </button>
                        <button
                          onClick={() =>
                            resume("driver-accept", { accepted: false, reason: "no drivers" })
                          }
                          className="rounded-xl border border-red-500/40 px-6 py-4 text-lg font-semibold text-red-400 hover:bg-red-500/10"
                        >
                          Driver reject
                        </button>
                      </>
                    )}
                    {waitingOn === "trackDelivery" && (
                      <button
                        onClick={() => resume("delivered")}
                        className="rounded-xl bg-white px-6 py-4 text-lg font-semibold text-black hover:opacity-90"
                      >
                        Mark delivered
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </section>

          {/* event feed */}
          <section className="rounded-2xl border border-white/10 bg-zinc-950">
            <div className="flex items-center justify-between border-b border-white/10 px-10 py-6">
              <div>
                <div className="text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
                  Logs
                </div>
                <h3 className="mt-2 text-2xl font-semibold tracking-tight">Event stream</h3>
              </div>
              <div className={`text-lg text-zinc-500 ${geistMono.className}`}>
                {events.length} events
              </div>
            </div>
            <div
              ref={feedRef}
              className={`max-h-[520px] min-h-[260px] overflow-y-auto px-10 py-6 ${geistMono.className} text-lg leading-relaxed`}
            >
              {events.length === 0 ? (
                <div className="py-8 text-xl text-zinc-600">
                  No events yet. Place an order from the phone to start the saga.
                </div>
              ) : (
                events.map((e, i) => {
                  const { kind, msg } = formatEventLine(e);
                  const t = new Date().toISOString().substring(11, 19);
                  return (
                    <div
                      key={i}
                      className="flex items-start gap-6 border-b border-white/5 py-3 last:border-0"
                    >
                      <span className="shrink-0 text-zinc-600">{t}</span>
                      <span className={`shrink-0 font-semibold ${kindColor(kind)}`}>{kind}</span>
                      <span className="flex-1 text-zinc-200">{msg}</span>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          {/* compensations */}
          {compensations.length > 0 && (
            <section className="rounded-2xl border border-fuchsia-500/20 bg-fuchsia-500/5 p-10">
              <div className="text-sm font-semibold uppercase tracking-[0.2em] text-fuchsia-300">
                Compensations
              </div>
              <h3 className="mt-3 text-3xl font-semibold tracking-tight">
                Rollback executed in reverse order
              </h3>
              <div className="mt-6 flex flex-wrap gap-4">
                {compensations.map((c, i) => (
                  <span
                    key={i}
                    className={`rounded-full border border-fuchsia-400/40 bg-black px-6 py-3 text-xl ${geistMono.className}`}
                  >
                    {i + 1}. {c}
                  </span>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
