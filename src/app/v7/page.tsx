"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IBM_Plex_Mono } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
  CompensationAction,
} from "@/workflows/place-order";

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const MENU: OrderItem[] = [
  { id: "pho", name: "BEEF PHO", price: 14.0, qty: 0 },
  { id: "banh", name: "BANH MI", price: 10.0, qty: 0 },
  { id: "spring", name: "SPRING ROLLS", price: 8.0, qty: 0 },
  { id: "boba", name: "TARO BOBA", price: 6.0, qty: 0 },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "VALIDATE_ORDER" },
  { key: "chargeCard", label: "CHARGE_PAYMENT" },
  { key: "pingRestaurant", label: "NOTIFY_RESTAURANT" },
  { key: "findDriver", label: "ASSIGN_DRIVER" },
  { key: "trackDelivery", label: "TRACK_DELIVERY" },
  { key: "sendReceipts", label: "SEND_RECEIPT" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "HAPPY_PATH" },
  { value: "validateOrder", label: "FAIL_VALIDATE" },
  { value: "chargeCard", label: "FAIL_PAYMENT" },
  { value: "pingRestaurant", label: "FAIL_RESTAURANT" },
  { value: "findDriver", label: "FAIL_DRIVER" },
  { value: "sendReceipts", label: "FAIL_RECEIPT" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

interface StepMetrics {
  start?: number;
  end?: number;
  elapsed?: number;
}

export default function BloombergTerminal() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "pho" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("ADA LOVELACE");
  const [address, setAddress] = useState("123 CUPCAKE LANE, SF");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<(OrderEvent & { ts: number })[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [stepMetrics, setStepMetrics] = useState<Record<string, StepMetrics>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<CompensationAction[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const tickerRef = useRef<HTMLDivElement>(null);
  const lastEventRef = useRef<HTMLDivElement>(null);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

  // Auto-scroll event ticker
  useEffect(() => {
    if (lastEventRef.current) {
      lastEventRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  // Timer for elapsed steps
  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (running) {
      interval = setInterval(() => {
        setStepMetrics((prev) => {
          const next = { ...prev };
          Object.keys(stepStatuses).forEach((step) => {
            if (stepStatuses[step] === "running" || stepStatuses[step] === "waiting") {
              const start = prev[step]?.start ?? Date.now();
              next[step] = { ...prev[step], start, elapsed: Date.now() - start };
            }
          });
          return next;
        });
      }, 50);
    }
    return () => clearInterval(interval);
  }, [running, stepStatuses]);

  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)),
    );

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setStepMetrics({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
    setRunning(false);
  };

  const placeOrder = useCallback(async () => {
    reset();
    setRunning(true);

    const orderId = `ORD-${Date.now().toString(36).toUpperCase()}`;
    setCurrentOrderId(orderId);

    const input: OrderInput = {
      orderId,
      customerName,
      address,
      items: cart.filter((i) => i.qty > 0),
      failAt,
      autoAck,
    };

    try {
      const startRes = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const { runId } = (await startRes.json()) as { runId: string };

      const controller = new AbortController();
      abortRef.current = controller;

      const res = await fetch(`/api/runs/${runId}/stream`, {
        signal: controller.signal,
      });
      if (!res.body) throw new Error("No stream body");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as OrderEvent;
            applyEvent(event, orderId);
          } catch (e) {
            console.error("JSON Parse Error", e);
          }
        }
      }
    } catch (e) {
      console.error("Stream Error", e);
    } finally {
      setRunning(false);
    }
  }, [cart, customerName, address, failAt, autoAck]);

  const applyEvent = (event: OrderEvent, orderId: string) => {
    const ts = Date.now();
    setEvents((ev) => [...ev, { ...event, ts }]);

    switch (event.type) {
      case "step_running":
        setStepStatuses((s) => ({ ...s, [event.step]: "running" }));
        setStepMetrics((m) => ({ ...m, [event.step]: { start: ts, elapsed: 0 } }));
        break;
      case "step_succeeded":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        setStepMetrics((m) => ({
          ...m,
          [event.step]: { ...m[event.step], end: ts, elapsed: ts - (m[event.step]?.start ?? ts) },
        }));
        break;
      case "step_failed":
        setStepStatuses((s) => ({ ...s, [event.step]: "failed" }));
        setStepMetrics((m) => ({
          ...m,
          [event.step]: { ...m[event.step], end: ts, elapsed: ts - (m[event.step]?.start ?? ts) },
        }));
        break;
      case "step_skipped":
        setStepStatuses((s) => ({ ...s, [event.step]: "skipped" }));
        break;
      case "waiting_for_hook":
        setStepStatuses((s) => ({ ...s, [event.step]: "waiting" }));
        if (autoAck) {
          const kind =
            event.step === "pingRestaurant"
              ? ("restaurant-accept" as const)
              : event.step === "findDriver"
                ? ("driver-accept" as const)
                : ("delivered" as const);
          setTimeout(() => {
            void resumeOrder(orderId, kind, kind === "delivered" ? {} : { accepted: true });
          }, 800);
        }
        break;
      case "hook_resolved":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        setStepMetrics((m) => ({
          ...m,
          [event.step]: { ...m[event.step], end: ts, elapsed: ts - (m[event.step]?.start ?? ts) },
        }));
        break;
      case "compensated":
        setCompensations((c) => [...c, event.action]);
        break;
      case "done":
        setResult(event.status);
        break;
    }
  };

  const resumeOrder = async (
    orderId: string,
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {},
  ) => {
    await fetch(`/api/orders/${orderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  return (
    <main
      className={`${mono.className} min-h-screen bg-black text-[#ffb000] p-1 flex flex-col gap-1 text-[13px] leading-tight selection:bg-[#ffb000] selection:text-black`}
    >
      {/* TOP TICKER TAPE */}
      <div className="border border-[#22d3ee] h-8 flex items-center overflow-hidden bg-[#000] relative">
        <div className="absolute left-0 bg-black z-10 px-2 border-r border-[#22d3ee] font-bold text-[#00ff88]">
          LIVE_FEED
        </div>
        <div className="flex whitespace-nowrap animate-[scroll_30s_linear_infinite] pl-[100%]">
          {events.length > 0 ? (
            events.map((e, i) => (
              <span key={i} className="mx-4 flex gap-2">
                <span className="text-[#22d3ee]">[{new Date(e.ts).toLocaleTimeString()}]</span>
                <span className={getEventColor(e.type)}>{e.type.toUpperCase()}</span>
                <span className="text-zinc-400">{summarizeEvent(e)}</span>
                <span className="text-[#ffb000]">|</span>
              </span>
            ))
          ) : (
            <span className="mx-4 text-zinc-600 italic">AWAITING SYSTEM START...</span>
          )}
        </div>
      </div>

      <div className="flex-1 grid grid-cols-12 gap-1 overflow-hidden">
        {/* LEFT: ORDER CONFIG */}
        <div className="col-span-3 border border-[#22d3ee] flex flex-col bg-[#000]">
          <div className="bg-[#22d3ee] text-black px-2 py-0.5 font-bold uppercase tracking-wider">
            Order_Configuration
          </div>
          <div className="p-3 flex flex-col gap-4 overflow-y-auto">
            <section>
              <div className="text-zinc-500 mb-1 border-b border-zinc-800 pb-0.5">MENU_ITEMS</div>
              <div className="space-y-1">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center group">
                    <div className="flex-1">
                      <div className="text-[#00ff88]">{item.name}</div>
                      <div className="text-[10px] text-zinc-500">${item.price.toFixed(2)}</div>
                    </div>
                    <div className="flex items-center gap-2 border border-zinc-800 px-1">
                      <button onClick={() => updateQty(item.id, -1)} className="hover:text-white">-</button>
                      <span className="w-4 text-center text-white">{item.qty}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="hover:text-white">+</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-2 pt-1 border-t border-zinc-800 flex justify-between font-bold text-[#00ff88]">
                <span>TOTAL_EST</span>
                <span>${total.toFixed(2)}</span>
              </div>
            </section>

            <section className="space-y-3">
              <div>
                <div className="text-zinc-500 mb-0.5 uppercase text-[10px]">Customer_Name</div>
                <input
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value.toUpperCase())}
                  className="w-full bg-black border border-zinc-700 px-2 py-1 outline-none focus:border-[#ffb000] text-white"
                />
              </div>
              <div>
                <div className="text-zinc-500 mb-0.5 uppercase text-[10px]">Delivery_Addr</div>
                <input
                  value={address}
                  onChange={(e) => setAddress(e.target.value.toUpperCase())}
                  className="w-full bg-black border border-zinc-700 px-2 py-1 outline-none focus:border-[#ffb000] text-white"
                />
              </div>
              <div>
                <div className="text-zinc-500 mb-0.5 uppercase text-[10px]">Execution_Scenario</div>
                <select
                  value={failAt ?? "null"}
                  onChange={(e) => setFailAt(e.target.value === "null" ? null : (e.target.value as FailStep))}
                  className="w-full bg-black border border-zinc-700 px-2 py-1 outline-none focus:border-[#ffb000] text-[#ffb000] appearance-none"
                >
                  {FAIL_OPTIONS.map((opt) => (
                    <option key={String(opt.value)} value={opt.value ?? "null"}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={autoAck}
                  onChange={(e) => setAutoAck(e.target.checked)}
                  className="accent-[#ffb000]"
                />
                <span className="text-[10px] text-zinc-400 group-hover:text-[#ffb000]">AUTO_ACK_HOOKS</span>
              </label>
            </section>

            <div className="mt-auto flex flex-col gap-1">
              <button
                onClick={placeOrder}
                disabled={running || total === 0}
                className="w-full bg-[#00ff88] text-black font-bold py-2 hover:bg-[#00cc6e] disabled:opacity-30 disabled:cursor-not-allowed uppercase transition-colors"
              >
                {running ? "Executing_Saga..." : "Submit_Order"}
              </button>
              <button
                onClick={reset}
                className="w-full border border-zinc-700 py-1 text-zinc-500 hover:text-white hover:border-white uppercase text-[11px] transition-colors"
              >
                Reset_Terminal
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT AREA */}
        <div className="col-span-9 grid grid-rows-12 gap-1">
          {/* TOP: SAGA PIPELINE */}
          <div className="row-span-5 border border-[#22d3ee] flex flex-col bg-[#000]">
            <div className="bg-[#22d3ee] text-black px-2 py-0.5 font-bold flex justify-between uppercase">
              <span>Saga_Pipeline_Status</span>
              {result && (
                <span className={result === "completed" ? "text-[#004d00]" : "text-[#4d0000]"}>
                  STATUS: {result.toUpperCase()}
                </span>
              )}
            </div>
            <div className="flex-1 p-2 overflow-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="text-zinc-500 border-b border-zinc-800 text-[10px]">
                    <th className="pb-1 font-normal">TIME</th>
                    <th className="pb-1 font-normal">SAGA_STEP</th>
                    <th className="pb-1 font-normal text-center w-24">STATUS</th>
                    <th className="pb-1 font-normal text-right">DUR_MS</th>
                    <th className="pb-1 font-normal pl-4">PERF_METRIC</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900">
                  {STEPS.map((step) => {
                    const status = stepStatuses[step.key] ?? "pending";
                    const metric = stepMetrics[step.key];
                    return (
                      <tr key={step.key} className="group">
                        <td className="py-2 text-zinc-600 font-mono tabular-nums">
                          {metric?.start ? new Date(metric.start).toLocaleTimeString([], { hour12: false }) : "--:--:--"}
                        </td>
                        <td className={`py-2 font-bold ${status === "pending" ? "text-zinc-800" : "text-white"}`}>
                          {step.label}
                        </td>
                        <td className="py-2 text-center">
                          <span className={`px-2 py-0.5 text-[10px] inline-block w-full border ${getStatusStyle(status)}`}>
                            {status.toUpperCase()}
                          </span>
                        </td>
                        <td className="py-2 text-right font-mono tabular-nums text-[#00ff88]">
                          {metric?.elapsed ? `${metric.elapsed}ms` : "0ms"}
                        </td>
                        <td className="py-2 pl-4">
                          <div className="w-full h-4 bg-zinc-900 relative">
                            {metric?.elapsed && (
                              <div
                                className={`h-full transition-all duration-300 ${status === 'failed' ? 'bg-red-900' : 'bg-[#00ff88]/20 border-r border-[#00ff88]'}`}
                                style={{ width: `${Math.min(100, (metric.elapsed / 2000) * 100)}%` }}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* MIDDLE: EVENT TICKER */}
          <div className="row-span-4 border border-[#22d3ee] flex flex-col bg-[#000]">
            <div className="bg-[#22d3ee] text-black px-2 py-0.5 font-bold uppercase">
              Event_Ticker_Stream
            </div>
            <div ref={tickerRef} className="flex-1 p-2 overflow-y-auto font-mono text-[11px] space-y-0.5 bg-zinc-950/50">
              {events.length === 0 ? (
                <div className="text-zinc-800 italic">SYSTEM_IDLE: AWAITING_EVENTS</div>
              ) : (
                events.map((e, i) => (
                  <div key={i} ref={i === events.length - 1 ? lastEventRef : null} className="flex gap-2 group">
                    <span className="text-zinc-600 tabular-nums">[{new Date(e.ts).toLocaleTimeString()}]</span>
                    <span className={`w-32 inline-block shrink-0 ${getEventColor(e.type)}`}>{e.type.toUpperCase()}</span>
                    <span className="text-zinc-300">{summarizeEvent(e)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* BOTTOM: METRICS & CONTROLS */}
          <div className="row-span-3 grid grid-cols-2 gap-1">
            <div className="border border-[#22d3ee] flex flex-col bg-[#000]">
              <div className="bg-[#22d3ee] text-black px-2 py-0.5 font-bold uppercase">
                Manual_Hook_Controls
              </div>
              <div className="p-2 grid grid-cols-2 gap-1">
                <HookButton disabled={!currentOrderId} onClick={() => resumeOrder(currentOrderId!, "restaurant-accept", { accepted: true })}>
                  REST_ACK:ACCEPT
                </HookButton>
                <HookButton disabled={!currentOrderId} danger onClick={() => resumeOrder(currentOrderId!, "restaurant-accept", { accepted: false, reason: "86'D" })}>
                  REST_ACK:REJECT
                </HookButton>
                <HookButton disabled={!currentOrderId} onClick={() => resumeOrder(currentOrderId!, "driver-accept", { accepted: true })}>
                  DRV_ACK:ACCEPT
                </HookButton>
                <HookButton disabled={!currentOrderId} danger onClick={() => resumeOrder(currentOrderId!, "driver-accept", { accepted: false })}>
                  DRV_ACK:DECLINE
                </HookButton>
                <HookButton disabled={!currentOrderId} className="col-span-2" onClick={() => resumeOrder(currentOrderId!, "delivered")}>
                  MARK_DELIVERED
                </HookButton>
              </div>
            </div>
            <div className="border border-[#22d3ee] flex flex-col bg-[#000]">
              <div className="bg-[#22d3ee] text-black px-2 py-0.5 font-bold uppercase">
                Metrics_&_Compensations
              </div>
              <div className="p-2 flex-1 overflow-auto">
                {compensations.length > 0 ? (
                  <div className="space-y-1">
                    <div className="text-red-500 font-bold border-b border-red-900/50 pb-1 mb-1 uppercase">Rolled_Back_Actions</div>
                    {compensations.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-red-400">
                        <span className="text-[10px]">▼</span>
                        <span className="flex-1">{c.toUpperCase()}</span>
                        <span className="text-zinc-600">EXECUTED</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-zinc-700">
                    <div className="text-[20px] font-bold opacity-20">NO_DATA</div>
                    <div className="text-[10px]">CLEAN_EXECUTION_STATE</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style jsx global>{`
        @keyframes scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-100%); }
        }
        ::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }
        ::-webkit-scrollbar-track {
          background: #000;
        }
        ::-webkit-scrollbar-thumb {
          background: #22d3ee;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #ffb000;
        }
      `}</style>
    </main>
  );
}

function getEventColor(type: OrderEvent["type"]): string {
  switch (type) {
    case "step_failed":
    case "compensating":
      return "text-red-500";
    case "step_succeeded":
    case "hook_resolved":
    case "compensated":
      return "text-[#00ff88]";
    case "waiting_for_hook":
      return "text-[#ffb000]";
    case "done":
      return "text-[#22d3ee]";
    default:
      return "text-zinc-500";
  }
}

function getStatusStyle(s: StepStatus): string {
  switch (s) {
    case "running":
      return "bg-blue-900/30 border-blue-500 text-blue-400 animate-pulse";
    case "waiting":
      return "bg-amber-900/30 border-amber-500 text-amber-400 animate-pulse";
    case "success":
      return "bg-green-900/30 border-green-500 text-green-400";
    case "failed":
      return "bg-red-900/30 border-red-500 text-red-400";
    case "skipped":
      return "bg-zinc-900/30 border-zinc-700 text-zinc-600";
    default:
      return "bg-transparent border-zinc-800 text-zinc-800";
  }
}

function summarizeEvent(e: OrderEvent): string {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `${e.label}${"detail" in e && e.detail ? ` > ${e.detail}` : ""}${
        "error" in e && e.error ? ` ! ${e.error}` : ""
      }`;
    case "waiting_for_hook":
      return `PAUSED_FOR_USER_ACTION: ${e.label}`;
    case "hook_resolved":
      return `RESUMED: ${e.detail ?? e.token}`;
    case "compensation_pushed":
      return `PUSHED_UNDO: ${e.action} (FOR ${e.forStep})`;
    case "compensating":
      return `ROLLING_BACK: ${e.action}`;
    case "compensated":
      return `REVERTED: ${e.action}`;
    case "log":
      return e.message;
    case "done":
      return `FINAL_RESULT: ${e.status.toUpperCase()} ID:${e.orderId}`;
    default:
      return "";
  }
}

function HookButton({
  children,
  onClick,
  disabled,
  danger,
  className = "",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  className?: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`border text-[10px] font-bold py-1 px-2 transition-colors disabled:opacity-20 disabled:cursor-not-allowed ${
        danger
          ? "border-red-900 text-red-500 hover:bg-red-500 hover:text-black"
          : "border-[#00ff88] text-[#00ff88] hover:bg-[#00ff88] hover:text-black"
      } ${className}`}
    >
      {children}
    </button>
  );
}
