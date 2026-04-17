"use client";

import { useCallback, useMemo, useRef, useState, useEffect } from "react";
import { Fraunces, Inter } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const fraunces = Fraunces({ 
  subsets: ["latin"], 
  weight: ["400", "700", "900"],
  display: "swap" 
});
const inter = Inter({ 
  subsets: ["latin"], 
  display: "swap" 
});

const MENU: OrderItem[] = [
  { id: "pho", name: "Beef Phở", price: 14, qty: 0 },
  { id: "banh", name: "Bánh Mì", price: 10, qty: 0 },
  { id: "spring", name: "Spring Rolls (4)", price: 8, qty: 0 },
  { id: "boba", name: "Taro Boba", price: 6, qty: 0 },
];

const STEPS: { key: string; label: string; chapter: string }[] = [
  { key: "validateOrder", label: "Validate order", chapter: "01" },
  { key: "chargeCard", label: "Charge payment", chapter: "02" },
  { key: "pingRestaurant", label: "Notify restaurant", chapter: "03" },
  { key: "findDriver", label: "Assign driver", chapter: "04" },
  { key: "trackDelivery", label: "Track delivery", chapter: "05" },
  { key: "sendReceipts", label: "Send receipt", chapter: "06" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "The Perfect Run" },
  { value: "validateOrder", label: "Validation Fault" },
  { value: "chargeCard", label: "Payment Decline" },
  { value: "pingRestaurant", label: "Kitchen Exhaustion" },
  { value: "findDriver", label: "Courier Unavailability" },
  { value: "trackDelivery", label: "Missing Shipment" },
  { value: "sendReceipts", label: "Communications Failure" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function EditorialV2Page() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "pho" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Ada Lovelace");
  const [address, setAddress] = useState("123 Cupcake Lane, San Francisco");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const eventFeedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll event feed
  useEffect(() => {
    if (eventFeedRef.current) {
      eventFeedRef.current.scrollTop = eventFeedRef.current.scrollHeight;
    }
  }, [events]);

  const total = useMemo(
    () => cart.reduce((s, i) => s + i.price * i.qty, 0),
    [cart],
  );

  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) =>
        i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i,
      ),
    );

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
  };

  const applyEvent = (event: OrderEvent) => {
    setEvents((ev) => [...ev, event]);
    switch (event.type) {
      case "step_running":
        setStepStatuses((s) => ({ ...s, [event.step]: "running" }));
        break;
      case "step_succeeded":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        break;
      case "step_failed":
        setStepStatuses((s) => ({ ...s, [event.step]: "failed" }));
        break;
      case "step_skipped":
        setStepStatuses((s) => ({ ...s, [event.step]: "skipped" }));
        break;
      case "waiting_for_hook": {
        setStepStatuses((s) => ({ ...s, [event.step]: "waiting" }));
        if (autoAck) {
          const kind =
            event.step === "pingRestaurant"
              ? ("restaurant-accept" as const)
              : event.step === "findDriver"
                ? ("driver-accept" as const)
                : ("delivered" as const);
          setTimeout(() => {
            void resume(
              kind,
              kind === "delivered" ? {} : { accepted: true },
            );
          }, 800);
        }
        break;
      }
      case "hook_resolved":
        setStepStatuses((s) => ({ ...s, [event.step]: "success" }));
        break;
      case "compensated":
        setCompensations((c) => [...c, event.action]);
        break;
      case "done":
        setResult(event.status);
        break;
    }
  };

  const placeOrder = useCallback(async () => {
    reset();
    setRunning(true);

    const orderId = `ord_${Date.now().toString(36)}`;
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
      if (!res.body) {
        setRunning(false);
        return;
      }
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
            applyEvent(event);
          } catch {
            // ignore
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunning(false);
    }
  }, [cart, customerName, address, failAt, autoAck]);

  const resume = async (
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {},
  ) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  return (
    <main className={`min-h-screen bg-[#f6f3ea] text-black px-6 py-12 md:px-12 lg:px-24 ${inter.className}`}>
      {/* 12-Column Grid */}
      <div className="mx-auto max-w-7xl grid grid-cols-1 md:grid-cols-12 gap-y-16 md:gap-x-12">
        
        {/* HEADER SECTION */}
        <header className="md:col-span-12 border-b border-black pb-8 mb-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-3xl">
              <span className="uppercase text-[10px] tracking-[0.2em] font-bold mb-4 block opacity-60">The Delivery Saga — Issue No. 02</span>
              <h1 className={`text-6xl md:text-8xl font-black leading-[0.9] tracking-tighter ${fraunces.className}`}>
                <span className="inline-block relative">
                  <span className="text-9xl absolute -left-20 -top-4 opacity-10">V2</span>
                  The Mechanics of Consumption.
                </span>
              </h1>
            </div>
            <div className="text-right md:w-64 border-l border-black pl-6 hidden md:block">
              <p className="text-[11px] leading-relaxed uppercase tracking-widest font-bold">
                A study in transactional resilience and distributed state machines.
              </p>
            </div>
          </div>
        </header>

        {/* LEFT COLUMN: THE MENU & CONFIG (Marginalia style but on left) */}
        <aside className="md:col-span-3 space-y-12">
          <section className="border-t border-black pt-4">
            <h3 className={`text-2xl font-bold mb-6 italic ${fraunces.className}`}>The Selection</h3>
            <div className="space-y-6">
              {cart.map((item) => (
                <div key={item.id} className="group">
                  <div className="flex justify-between items-baseline mb-1">
                    <span className="font-bold text-sm tracking-tight">{item.name}</span>
                    <span className="text-xs opacity-40 italic">${item.price.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center gap-4 mt-2">
                    <button 
                      onClick={() => updateQty(item.id, -1)}
                      className="text-xs hover:bg-black hover:text-white px-2 py-0.5 border border-black/10 transition-all"
                    >—</button>
                    <span className="font-mono text-xs">{item.qty}</span>
                    <button 
                      onClick={() => updateQty(item.id, 1)}
                      className="text-xs hover:bg-black hover:text-white px-2 py-0.5 border border-black/10 transition-all"
                    >+</button>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-8 pt-4 border-t-2 border-black flex justify-between items-baseline">
              <span className="uppercase text-[10px] font-black tracking-widest">Total Valuation</span>
              <span className="text-xl font-black">${total.toFixed(2)}</span>
            </div>
          </section>

          <section className="border-t border-black pt-4">
            <h3 className={`text-2xl font-bold mb-6 italic ${fraunces.className}`}>Logistics</h3>
            <div className="space-y-4">
              <div>
                <label className="uppercase text-[9px] font-black tracking-widest mb-1 block opacity-60">Recipient</label>
                <input 
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full bg-transparent border-b border-black/20 focus:border-black outline-none py-1 text-sm font-bold"
                />
              </div>
              <div>
                <label className="uppercase text-[9px] font-black tracking-widest mb-1 block opacity-60">Destination</label>
                <input 
                  value={address}
                  onChange={e => setAddress(e.target.value)}
                  className="w-full bg-transparent border-b border-black/20 focus:border-black outline-none py-1 text-sm font-bold"
                />
              </div>
            </div>
          </section>

          <section className="border-t border-black pt-4">
            <h3 className={`text-2xl font-bold mb-6 italic ${fraunces.className}`}>The Scenario</h3>
            <div className="space-y-4">
              <select 
                value={failAt ?? "null"}
                onChange={e => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)}
                className="w-full bg-transparent border-b border-black/20 focus:border-black outline-none py-2 text-xs font-bold appearance-none cursor-pointer uppercase tracking-widest"
              >
                {FAIL_OPTIONS.map(opt => (
                  <option key={String(opt.value)} value={opt.value ?? "null"}>{opt.label}</option>
                ))}
              </select>
              <div className="flex items-start gap-3 pt-2">
                <input 
                  type="checkbox" 
                  id="autoAck"
                  checked={autoAck}
                  onChange={e => setAutoAck(e.target.checked)}
                  className="mt-1 accent-black"
                />
                <label htmlFor="autoAck" className="text-[11px] leading-tight font-medium uppercase tracking-wider opacity-60">
                  Enable automatic acknowledgement of distributed hooks.
                </label>
              </div>
            </div>
          </section>

          <div className="pt-8">
            <button 
              onClick={placeOrder}
              disabled={running || total === 0}
              className={`w-full py-4 text-sm font-black uppercase tracking-[0.3em] border-2 border-black transition-all ${
                running || total === 0 
                  ? 'opacity-30 cursor-not-allowed' 
                  : 'hover:bg-black hover:text-[#f6f3ea]'
              }`}
            >
              {running ? "Processing Saga..." : "Execute Transaction"}
            </button>
            {result && (
              <button 
                onClick={reset}
                className="w-full mt-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100"
              >
                Reset System State
              </button>
            )}
          </div>
        </aside>

        {/* MAIN COLUMN: THE SAGA (Chapter Headings) */}
        <section className="md:col-span-6 space-y-0 relative">
          <div className="absolute left-0 top-0 bottom-0 w-px bg-black opacity-10 hidden md:block" />
          
          <div className="md:pl-12">
            {result && (
              <div className={`mb-12 border-4 border-black p-8 text-center ${fraunces.className}`}>
                <h4 className="text-[10px] uppercase tracking-[0.4em] font-black mb-2 opacity-60">Final Resolution</h4>
                <p className="text-4xl font-black italic">
                  {result === "completed" ? "Order Finalized." : "System Rolled Back."}
                </p>
                {compensations.length > 0 && (
                  <div className="mt-6 pt-6 border-t border-black/10">
                    <span className="text-[9px] font-black uppercase tracking-[0.2em] mb-4 block">Compensations Executed</span>
                    <ul className="space-y-1">
                      {compensations.map((c, i) => (
                        <li key={i} className="text-xs font-bold uppercase tracking-widest">{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            <div className="space-y-16">
              {STEPS.map((step) => {
                const status = stepStatuses[step.key] ?? "pending";
                return (
                  <article key={step.key} className={`group transition-opacity duration-700 ${
                    status === 'pending' ? 'opacity-20' : 'opacity-100'
                  }`}>
                    <div className="flex items-start gap-8">
                      <span className={`text-5xl font-black tabular-nums tracking-tighter leading-none ${fraunces.className}`}>
                        {step.chapter}
                      </span>
                      <div className="flex-1">
                        <header className="flex justify-between items-baseline border-b border-black pb-2 mb-4">
                          <h2 className={`text-3xl font-bold uppercase tracking-tight ${fraunces.className}`}>
                            {step.label}
                          </h2>
                          <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 ${
                            status === 'running' || status === 'waiting' ? 'bg-black text-[#f6f3ea] animate-pulse' : ''
                          }`}>
                            {status === 'waiting' ? 'Paused for input' : status}
                          </span>
                        </header>
                        
                        {/* Manual Hook Controls if status is waiting and autoAck is off */}
                        {status === "waiting" && !autoAck && (
                          <div className="mt-6 grid grid-cols-2 gap-4 border-2 border-black p-4 bg-white/50">
                            {step.key === "pingRestaurant" && (
                              <>
                                <button onClick={() => resume("restaurant-accept", { accepted: true })} className="text-[10px] font-black uppercase border border-black py-2 hover:bg-black hover:text-white transition-all">Kitchen Accept</button>
                                <button onClick={() => resume("restaurant-accept", { accepted: false, reason: "86'd" })} className="text-[10px] font-black uppercase border border-black py-2 hover:bg-black hover:text-white transition-all">Kitchen Deny</button>
                              </>
                            )}
                            {step.key === "findDriver" && (
                              <>
                                <button onClick={() => resume("driver-accept", { accepted: true })} className="text-[10px] font-black uppercase border border-black py-2 hover:bg-black hover:text-white transition-all">Driver Accept</button>
                                <button onClick={() => resume("driver-accept", { accepted: false })} className="text-[10px] font-black uppercase border border-black py-2 hover:bg-black hover:text-white transition-all">Driver Deny</button>
                              </>
                            )}
                            {step.key === "trackDelivery" && (
                              <button onClick={() => resume("delivered")} className="col-span-2 text-[10px] font-black uppercase border border-black py-2 hover:bg-black hover:text-white transition-all">Mark as Handed to Customer</button>
                            )}
                          </div>
                        )}

                        <div className="text-sm italic opacity-60 leading-relaxed max-w-md">
                          {status === 'pending' && `Chapter pending initiation of the primary sequence.`}
                          {status === 'running' && `Process actively navigating the distributed topology.`}
                          {status === 'success' && `Transactional integrity verified. State committed.`}
                          {status === 'waiting' && `Awaiting external signal to proceed with state transition.`}
                          {status === 'failed' && `Irrecoverable fault encountered. Compensation initiated.`}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </section>

        {/* RIGHT COLUMN: THE EVENT FEED (Marginalia) */}
        <aside className="md:col-span-3">
          <div className="sticky top-12 space-y-8">
            <section className="border-t border-black pt-4">
              <h3 className={`text-lg font-bold mb-4 italic ${fraunces.className}`}>Marginalia</h3>
              <div 
                ref={eventFeedRef}
                className="h-[600px] overflow-y-auto pr-4 scrollbar-hide flex flex-col gap-6"
              >
                {events.length === 0 ? (
                  <p className="text-[11px] leading-relaxed opacity-40 uppercase tracking-widest font-medium">
                    The feed is silent. Waiting for the first byte.
                  </p>
                ) : (
                  events.map((e, i) => (
                    <div key={i} className="border-b border-black/10 pb-4">
                      <div className="flex justify-between mb-2">
                        <span className="text-[8px] font-black opacity-30 tracking-widest uppercase">
                          {new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[8px] font-black uppercase tracking-widest bg-black/5 px-1">{e.type.replace('_', ' ')}</span>
                      </div>
                      <p className="text-[11px] leading-relaxed font-bold tracking-tight">
                        {summarizeEvent(e)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </section>
            
            <section className="pt-8 border-t-2 border-black">
              <p className="text-[10px] leading-tight opacity-40 italic">
                “In a system of distributed components, the only truth is the consensus of the log.”
              </p>
            </section>
          </div>
        </aside>

      </div>

      <footer className="mt-24 border-t border-black pt-8 mx-auto max-w-7xl">
        <div className="flex justify-between items-baseline opacity-30 text-[10px] uppercase font-black tracking-[0.4em]">
          <span>© 2026 Food Delivery Systems</span>
          <span>Distributed Resilience Lab</span>
        </div>
      </footer>
    </main>
  );
}

function summarizeEvent(e: OrderEvent): string {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `${e.label}${"detail" in e && e.detail ? `: ${e.detail}` : ""}${
        "error" in e && e.error ? ` — ERROR: ${e.error}` : ""
      }`;
    case "waiting_for_hook":
      return `PAUSED: ${e.label}`;
    case "hook_resolved":
      return `SIGNAL RECEIVED: ${e.detail ?? "OK"}`;
    case "compensation_pushed":
      return `REVERSAL LOGGED: ${e.action}`;
    case "compensating":
      return `UNDOING: ${e.action}...`;
    case "compensated":
      return `ROLLED BACK: ${e.action}`;
    case "log":
      return e.message;
    case "done":
      return `SEQUENCE CONCLUDED: ${e.status.toUpperCase()}`;
    default:
      return "";
  }
}
