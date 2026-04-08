"use client";

import { Inter } from "next/font/google";
import { useCallback, useMemo, useRef, useState } from "react";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const inter = Inter({ subsets: ["latin"], weight: ["400", "500", "600", "700"] });

const MENU: OrderItem[] = [
  { id: "burger", name: "Classic Helsinki Burger", price: 14, qty: 0 },
  { id: "fries", name: "Crispy Nordic Fries", price: 5, qty: 0 },
  { id: "salmon", name: "Smoked Salmon Bowl", price: 18, qty: 0 },
  { id: "cola", name: "Craft Cola", price: 4, qty: 0 },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "Validate order" },
  { key: "chargePayment", label: "Charge payment" },
  { key: "notifyRestaurant", label: "Notify restaurant" },
  { key: "assignDriver", label: "Assign driver" },
  { key: "trackDelivery", label: "Track delivery" },
  { key: "sendReceipt", label: "Send receipt" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Happy path" },
  { value: "validateOrder", label: "Fail at validate" },
  { value: "chargePayment", label: "Fail at payment" },
  { value: "notifyRestaurant", label: "Fail at restaurant" },
  { value: "assignDriver", label: "Fail at driver" },
  { value: "sendReceipt", label: "Fail at receipt" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function WoltCloneDemo() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "burger" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Linus Torvalds");
  const [address, setAddress] = useState("Mannerheimintie 1, Helsinki");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  
  const [running, setRunning] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);

  const updateQty = (id: string, delta: number) =>
    setCart((c) =>
      c.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i))
    );

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
    setOrderPlaced(false);
    setRunning(false);
  };

  const placeOrder = useCallback(async () => {
    reset();
    setRunning(true);
    setOrderPlaced(true);

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
    } catch {
      // abort
    } finally {
      setRunning(false);
    }
  }, [cart, customerName, address, failAt, autoAck]);

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
            event.step === "notifyRestaurant"
              ? "restaurant-accept"
              : event.step === "assignDriver"
              ? "driver-accept"
              : "delivered";
          setTimeout(() => {
            void resume(kind, kind === "delivered" ? {} : { accepted: true });
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

  const resume = async (
    kind: "restaurant-accept" | "driver-accept" | "delivered",
    payload: object = {}
  ) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  return (
    <div className={`min-h-screen bg-[#f5f7fa] text-[#002e5d] ${inter.className}`}>
      {/* Top Bar */}
      <header className="bg-white px-6 py-4 shadow-sm flex items-center justify-between sticky top-0 z-10">
        <div className="flex items-center gap-6">
          <div className="text-[#00c2e8] font-black text-3xl tracking-tighter">Wolt</div>
          <div className="hidden md:flex bg-[#f5f7fa] rounded-full px-4 py-2 items-center gap-2 text-sm font-medium">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
            Delivery to: <span className="text-[#00c2e8] truncate max-w-[200px]">{address}</span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm font-semibold">
          <button className="text-[#00c2e8] hover:bg-[#e6fafe] px-4 py-2 rounded-full transition-colors">Log in</button>
          <button className="bg-[#f5f7fa] hover:bg-[#e2e8f0] px-4 py-2 rounded-full transition-colors">Sign up</button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-8 items-start">
        {/* LEFT COLUMN: App Content */}
        <section className="bg-white rounded-3xl shadow-sm overflow-hidden flex flex-col">
          {!orderPlaced ? (
            <>
              {/* Restaurant Hero */}
              <div className="h-64 bg-[#00c2e8] relative flex items-end p-8 text-white overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#002e5d]/60 to-transparent z-0"></div>
                {/* Decorative background shape */}
                <div className="absolute -right-20 -top-20 w-96 h-96 bg-white/10 rounded-full blur-3xl"></div>
                <div className="relative z-10">
                  <h1 className="text-4xl font-bold mb-2 tracking-tight">Helsinki Burger & Co.</h1>
                  <div className="flex items-center gap-3 text-sm font-semibold opacity-90">
                    <span className="bg-white/20 px-2 py-1 rounded-md flex items-center gap-1"><span className="text-yellow-400">★</span> 9.4</span>
                    <span>25–35 min</span>
                    <span>• €2.90 delivery</span>
                  </div>
                </div>
              </div>

              {/* Menu Categories (Sticky) */}
              <div className="border-b border-[#f5f7fa] px-8 py-4 flex gap-6 text-sm font-bold text-[#002e5d] overflow-x-auto">
                <span className="text-[#00c2e8] border-b-2 border-[#00c2e8] pb-4 -mb-4 whitespace-nowrap cursor-pointer">Popular</span>
                <span className="text-[#002e5d]/60 hover:text-[#002e5d] cursor-pointer whitespace-nowrap">Burgers</span>
                <span className="text-[#002e5d]/60 hover:text-[#002e5d] cursor-pointer whitespace-nowrap">Sides</span>
                <span className="text-[#002e5d]/60 hover:text-[#002e5d] cursor-pointer whitespace-nowrap">Drinks</span>
              </div>

              {/* Menu Items */}
              <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                {MENU.map((item) => (
                  <div key={item.id} className="flex gap-4 p-4 border border-[#f5f7fa] rounded-2xl hover:shadow-md transition-shadow group">
                    <div className="flex-1">
                      <h3 className="font-semibold text-base mb-1">{item.name}</h3>
                      <p className="text-sm font-semibold text-[#00c2e8] mb-3">€{item.price.toFixed(2)}</p>
                    </div>
                    <div className="flex flex-col items-end justify-between">
                      <div className="w-24 h-24 bg-[#f5f7fa] rounded-xl flex items-center justify-center text-4xl overflow-hidden relative">
                         {item.id === 'burger' && '🍔'}
                         {item.id === 'fries' && '🍟'}
                         {item.id === 'salmon' && '🥗'}
                         {item.id === 'cola' && '🥤'}
                      </div>
                      <div className="mt-2 flex items-center gap-3 bg-[#f5f7fa] rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#00c2e8] font-bold hover:bg-[#e6fafe]">-</button>
                        <span className="w-4 text-center text-sm font-bold">{cart.find(i => i.id === item.id)?.qty || 0}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 rounded-full bg-white shadow-sm flex items-center justify-center text-[#00c2e8] font-bold hover:bg-[#e6fafe]">+</button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="p-8 lg:p-12 flex flex-col items-center justify-center min-h-[600px] text-center bg-white relative overflow-hidden">
               {/* Animated Map Background */}
               <div className="absolute inset-0 bg-[#f8fbff] opacity-50 pointer-events-none">
                 <svg width="100%" height="100%" viewBox="0 0 800 600" xmlns="http://www.w3.org/2000/svg">
                    <path d="M -100 200 Q 150 150 300 300 T 700 100" fill="none" stroke="#e0e8f5" strokeWidth="8" strokeLinecap="round" />
                    <path d="M 0 400 Q 250 450 400 200 T 800 400" fill="none" stroke="#e0e8f5" strokeWidth="12" strokeLinecap="round" />
                    <path d="M 200 -50 L 250 150 L 150 300 L 400 450 L 500 650" fill="none" stroke="#e0e8f5" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
                 </svg>
               </div>
               
               <div className="relative z-10 w-full max-w-md bg-white rounded-3xl p-8 shadow-xl shadow-[#002e5d]/5 border border-[#f5f7fa]">
                  <div className="mb-8">
                     <span className={`text-xs font-black uppercase tracking-widest px-3 py-1 rounded-full ${
                        result === "completed" ? "bg-[#e6fafe] text-[#00c2e8]" : 
                        result === "rolled_back" ? "bg-rose-100 text-rose-600" : 
                        "bg-[#e6fafe] text-[#00c2e8]"
                     }`}>
                       {result === "completed" ? "Completed" : result === "rolled_back" ? "Cancelled" : "Live Tracking"}
                     </span>
                     <h2 className="text-3xl font-black mt-4 mb-1">
                        {result === "completed" ? "Enjoy your meal!" : result === "rolled_back" ? "Order Failed" : "Arriving soon"}
                     </h2>
                     {result === null && <p className="text-sm font-semibold text-[#002e5d]/60">Estimated time: 25–35 min</p>}
                  </div>

                  <div className="space-y-6 text-left relative">
                    <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-[#f5f7fa] -z-10"></div>
                    
                    {STEPS.map((step) => {
                      const status = stepStatuses[step.key] ?? "pending";
                      return (
                        <div key={step.key} className="flex gap-4 items-start relative bg-white">
                           <div className="relative z-10 flex-shrink-0 mt-0.5">
                              {status === "success" ? (
                                 <div className="w-8 h-8 rounded-full bg-[#00c2e8] flex items-center justify-center text-white shadow-md shadow-[#00c2e8]/20">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                                 </div>
                              ) : status === "running" || status === "waiting" ? (
                                 <div className="w-8 h-8 rounded-full bg-white border-2 border-[#00c2e8] flex items-center justify-center">
                                    <div className="w-2.5 h-2.5 bg-[#00c2e8] rounded-full animate-ping"></div>
                                 </div>
                              ) : status === "failed" ? (
                                 <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center text-white shadow-md shadow-rose-500/20">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                                 </div>
                              ) : status === "skipped" ? (
                                 <div className="w-8 h-8 rounded-full bg-[#f5f7fa] flex items-center justify-center text-[#002e5d]/30">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                 </div>
                              ) : (
                                 <div className="w-8 h-8 rounded-full bg-[#f5f7fa] border-2 border-transparent"></div>
                              )}
                           </div>
                           <div className="flex-1 pb-1">
                              <div className={`font-bold ${status === 'pending' || status === 'skipped' ? 'text-[#002e5d]/40' : 'text-[#002e5d]'}`}>{step.label}</div>
                              <div className="text-xs font-bold text-[#002e5d]/40 mt-0.5 uppercase tracking-wide">
                                 {status === "running" ? "In progress..." : 
                                  status === "waiting" ? "Waiting for updates..." : 
                                  status === "failed" ? "Failed" : 
                                  status === "skipped" ? "Skipped" : 
                                  status === "success" ? "Done" : "Pending"}
                              </div>
                           </div>
                        </div>
                      )
                    })}
                  </div>
               </div>
            </div>
          )}
        </section>

        {/* RIGHT COLUMN: Sidebar (Cart / Checkout -> Presenter Tools) */}
        <section className="space-y-6">
          {!orderPlaced ? (
             <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#f5f7fa]">
                <h2 className="text-2xl font-black tracking-tight mb-6">Your order</h2>
                {cart.filter(i => i.qty > 0).length === 0 ? (
                  <div className="text-center py-8 text-[#002e5d]/50 font-bold">Your cart is empty.</div>
                ) : (
                  <div className="space-y-4 mb-6">
                     {cart.filter(i => i.qty > 0).map(item => (
                        <div key={item.id} className="flex justify-between items-center text-sm font-semibold">
                           <div className="flex items-center gap-3">
                              <div className="w-6 h-6 rounded bg-[#e6fafe] text-[#00c2e8] flex items-center justify-center text-xs font-bold">{item.qty}</div>
                              <span>{item.name}</span>
                           </div>
                           <span className="text-[#002e5d]/70">€{(item.price * item.qty).toFixed(2)}</span>
                        </div>
                     ))}
                     <div className="border-t border-[#f5f7fa] pt-4 mt-4 flex justify-between items-center text-lg font-black">
                        <span>Total</span>
                        <span>€{total.toFixed(2)}</span>
                     </div>
                  </div>
                )}
                
                <div className="space-y-4 pt-4 border-t border-[#f5f7fa]">
                   <div>
                     <label className="text-xs font-black uppercase tracking-wider text-[#002e5d]/50 block mb-1">Customer</label>
                     <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full bg-[#f5f7fa] border-none rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-[#00c2e8] outline-none transition-shadow" />
                   </div>
                   <div>
                     <label className="text-xs font-black uppercase tracking-wider text-[#002e5d]/50 block mb-1">Delivery Address</label>
                     <input value={address} onChange={(e) => setAddress(e.target.value)} className="w-full bg-[#f5f7fa] border-none rounded-xl px-4 py-3 text-sm font-semibold focus:ring-2 focus:ring-[#00c2e8] outline-none transition-shadow" />
                   </div>
                </div>

                <div className="bg-[#f5f7fa] rounded-2xl p-5 mt-6 border border-[#e2e8f0]">
                   <h3 className="text-xs font-black uppercase tracking-widest text-[#002e5d]/50 mb-3 flex items-center gap-2">
                     <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
                     Demo Scenario
                   </h3>
                   <select value={failAt ?? "null"} onChange={(e) => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)} className="w-full bg-white border border-[#e2e8f0] rounded-xl px-4 py-2 text-sm font-semibold focus:ring-2 focus:ring-[#00c2e8] outline-none mb-3">
                      {FAIL_OPTIONS.map((opt) => (
                         <option key={String(opt.value)} value={opt.value ?? "null"}>{opt.label}</option>
                      ))}
                   </select>
                   <label className="flex items-start gap-3 text-sm font-semibold cursor-pointer select-none">
                     <input type="checkbox" checked={autoAck} onChange={(e) => setAutoAck(e.target.checked)} className="mt-1 w-4 h-4 rounded border-gray-300 text-[#00c2e8] focus:ring-[#00c2e8]" />
                     <span className="text-[#002e5d]/80 leading-snug">Auto-acknowledge hooks <span className="block font-bold text-xs text-[#002e5d]/50 mt-0.5">Automatically accept restaurant & driver steps</span></span>
                   </label>
                </div>

                <button 
                  onClick={placeOrder} 
                  disabled={total === 0 || running} 
                  className="w-full mt-6 bg-[#00c2e8] text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-[#00c2e8]/30 hover:bg-[#00a8ca] hover:shadow-[#00c2e8]/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-[#00c2e8] disabled:hover:shadow-[#00c2e8]/30"
                >
                  Place order
                </button>
             </div>
          ) : (
             <>
               <div className="bg-white rounded-3xl p-6 shadow-sm border border-[#f5f7fa]">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-black tracking-tight">Demo Console</h2>
                    <button onClick={reset} className="text-xs font-black uppercase tracking-widest text-[#002e5d]/40 hover:text-[#00c2e8] transition-colors">Reset Demo</button>
                  </div>

                  {compensations.length > 0 && (
                     <div className="mb-6 bg-rose-50 border border-rose-100 rounded-2xl p-4">
                        <h4 className="text-rose-800 font-black text-xs uppercase tracking-widest mb-2">Compensations Run</h4>
                        <ul className="text-sm font-bold text-rose-700 space-y-1">
                           {compensations.map((c, i) => <li key={i} className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-rose-400 rounded-full"></div>{c}</li>)}
                        </ul>
                     </div>
                  )}

                  <div className="space-y-4">
                     <div>
                        <h3 className="text-xs font-black uppercase tracking-widest text-[#002e5d]/40 mb-3">Manual Hook Controls</h3>
                        <div className="grid grid-cols-2 gap-2">
                           <button onClick={() => resume("restaurant-accept", { accepted: true })} className="bg-[#f5f7fa] hover:bg-[#e2e8f0] text-[#002e5d] text-xs font-bold py-3 px-3 rounded-xl transition-colors text-left shadow-sm">Accept Restaurant</button>
                           <button onClick={() => resume("restaurant-accept", { accepted: false, reason: "Too busy" })} className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold py-3 px-3 rounded-xl transition-colors text-left shadow-sm">Reject Restaurant</button>
                           <button onClick={() => resume("driver-accept", { accepted: true })} className="bg-[#f5f7fa] hover:bg-[#e2e8f0] text-[#002e5d] text-xs font-bold py-3 px-3 rounded-xl transition-colors text-left shadow-sm">Accept Driver</button>
                           <button onClick={() => resume("driver-accept", { accepted: false })} className="bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold py-3 px-3 rounded-xl transition-colors text-left shadow-sm">Reject Driver</button>
                           <button onClick={() => resume("delivered")} className="col-span-2 bg-[#e6fafe] hover:bg-[#cbf4fc] text-[#00c2e8] text-xs font-bold py-3 px-3 rounded-xl transition-colors text-center shadow-sm">Mark Delivered</button>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="bg-[#002e5d] rounded-3xl p-6 shadow-sm text-white overflow-hidden flex flex-col h-[400px] border border-[#001f3f]">
                  <h2 className="text-xs font-black tracking-widest text-[#00c2e8] uppercase mb-4 flex-shrink-0">Event Stream Console</h2>
                  <div className="flex-1 overflow-auto font-mono text-[11px] leading-relaxed space-y-1.5 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                     {events.length === 0 ? (
                        <div className="text-white/30 italic">Waiting for saga events...</div>
                     ) : (
                        events.map((e, i) => (
                           <div key={i} className="border-b border-white/5 pb-1.5 mb-1.5 last:border-0 break-words">
                              <span className="text-white/30 mr-2">{new Date().toLocaleTimeString()}</span>
                              <span className={`font-bold ${
                                 e.type === 'step_failed' || e.type === 'compensating' ? 'text-rose-400' :
                                 e.type === 'step_succeeded' || e.type === 'hook_resolved' || e.type === 'compensated' ? 'text-emerald-400' :
                                 e.type === 'waiting_for_hook' ? 'text-yellow-400' :
                                 e.type === 'done' ? 'text-[#00c2e8]' :
                                 'text-white/60'
                              }`}>{e.type}</span>
                              <span className="text-white/80 ml-2">
                                 {summarizeEvent(e)}
                              </span>
                           </div>
                        ))
                     )}
                  </div>
               </div>
             </>
          )}
        </section>
      </main>
    </div>
  );
}

function summarizeEvent(e: OrderEvent): string {
  switch (e.type) {
    case "step_running":
    case "step_succeeded":
    case "step_failed":
    case "step_skipped":
      return `${e.label}${"detail" in e && e.detail ? ` — ${e.detail}` : ""}${
        "error" in e && e.error ? ` — ${e.error}` : ""
      }`;
    case "waiting_for_hook":
      return e.label;
    case "hook_resolved":
      return e.detail ?? e.token;
    case "compensation_pushed":
      return `${e.action} (for ${e.forStep})`;
    case "compensating":
    case "compensated":
      return e.action;
    case "log":
      return e.message;
    case "done":
      return `${e.status} — ${e.orderId}`;
    default:
      return "";
  }
}
