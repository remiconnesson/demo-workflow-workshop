"use client";

import React, { useState, useEffect, useRef } from "react";
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

// --- Types ---
type OrderItem = { id: string; name: string; price: number; qty: number; description: string };
type FailStep =
  | "validateOrder"
  | "chargePayment"
  | "notifyRestaurant"
  | "assignDriver"
  | "trackDelivery"
  | "sendReceipt"
  | null;

type OrderInput = {
  orderId: string;
  customerName: string;
  address: string;
  items: Omit<OrderItem, "description">[];
  failAt?: FailStep;
  autoAck?: boolean;
};

type OrderEvent =
  | { type: "step_running"; step: string; label: string }
  | { type: "step_succeeded"; step: string; label: string; detail?: string }
  | { type: "step_failed"; step: string; label: string; error: string }
  | { type: "step_skipped"; step: string; label: string }
  | { type: "waiting_for_hook"; step: string; token: string; label: string }
  | { type: "hook_resolved"; step: string; token: string; detail?: string }
  | {
      type: "compensation_pushed";
      action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver";
      forStep: string;
    }
  | { type: "compensating"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver" }
  | { type: "compensated"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver" }
  | { type: "log"; message: string }
  | { type: "done"; status: "completed" | "rolled_back"; orderId: string; compensationOrder: string[] };

const MENU: OrderItem[] = [
  { id: "d1", name: "The Deployer", description: "Classic triangle glazed with preview sprinkles.", price: 4.5, qty: 0 },
  { id: "d2", name: "Edge Runtime", description: "Lightning fast jelly-filled triangle.", price: 5.0, qty: 0 },
  { id: "d3", name: "Cold Start", description: "Iced vanilla triangle, takes a second to bite into.", price: 3.5, qty: 0 },
  { id: "d4", name: "Hot Module", description: "Spicy cinnamon sugar triangle.", price: 4.0, qty: 0 },
  { id: "d5", name: "Serverless Sprinkle", description: "Infinite scaling sprinkles on chocolate.", price: 5.5, qty: 0 },
  { id: "d6", name: "ISR Glaze", description: "Statically generated base, background icing.", price: 4.5, qty: 0 },
];

const SAGA_STEPS = [
  { id: "validateOrder", label: "Validate" },
  { id: "chargePayment", label: "Charge" },
  { id: "notifyRestaurant", label: "Restaurant" },
  { id: "assignDriver", label: "Driver" },
  { id: "trackDelivery", label: "Track" },
  { id: "sendReceipt", label: "Receipt" },
];

export default function V25Page() {
  // --- State ---
  const [menu, setMenu] = useState<OrderItem[]>(MENU);
  const [customerName, setCustomerName] = useState("Guillermo R.");
  const [address, setAddress] = useState("123 Triangle Way, Edge City");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);

  const [orderId, setOrderId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [finalStatus, setFinalStatus] = useState<"completed" | "rolled_back" | null>(null);
  
  const [stepStatuses, setStepStatuses] = useState<Record<string, "pending" | "running" | "succeeded" | "failed" | "skipped" | "waiting">>({});
  const [activeHooks, setActiveHooks] = useState<{ step: string; token: string }[]>([]);

  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom of events
  useEffect(() => {
    if (eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  const updateQty = (id: string, delta: number) => {
    setMenu((prev) =>
      prev.map((item) => (item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item))
    );
  };

  const total = menu.reduce((acc, item) => acc + item.qty * item.price, 0);
  const cartItems = menu.filter((i) => i.qty > 0);

  const placeOrder = async () => {
    if (cartItems.length === 0) return alert("Cart is empty!");
    
    setOrderId(null);
    setRunId(null);
    setEvents([]);
    setIsRunning(true);
    setIsDone(false);
    setFinalStatus(null);
    setStepStatuses({});
    setActiveHooks([]);

    const newOrderId = `ord_${Math.random().toString(36).substring(2, 9)}`;
    setOrderId(newOrderId);

    const input: OrderInput = {
      orderId: newOrderId,
      customerName,
      address,
      items: cartItems.map(({ id, name, price, qty }) => ({ id, name, price, qty })),
      failAt,
      autoAck,
    };

    try {
      const res = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      if (!res.ok) throw new Error("Failed to start order");
      const data = await res.json();
      setRunId(data.runId);

      // Start streaming
      const streamRes = await fetch(`/api/runs/${data.runId}/stream`);
      if (!streamRes.body) throw new Error("No stream body");
      
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const ev = JSON.parse(line) as OrderEvent;
            processEvent(ev, newOrderId);
          } catch (err) {
            console.error("Failed to parse event", line, err);
          }
        }
      }
    } catch (error) {
      console.error(error);
      setIsRunning(false);
    }
  };

  const processEvent = (ev: OrderEvent, currentOrderId: string) => {
    setEvents((prev) => [...prev, ev]);

    if (ev.type === "step_running") {
      setStepStatuses((prev) => ({ ...prev, [ev.step]: "running" }));
    } else if (ev.type === "step_succeeded") {
      setStepStatuses((prev) => ({ ...prev, [ev.step]: "succeeded" }));
    } else if (ev.type === "step_failed") {
      setStepStatuses((prev) => ({ ...prev, [ev.step]: "failed" }));
    } else if (ev.type === "step_skipped") {
      setStepStatuses((prev) => ({ ...prev, [ev.step]: "skipped" }));
    } else if (ev.type === "waiting_for_hook") {
      setStepStatuses((prev) => ({ ...prev, [ev.step]: "waiting" }));
      setActiveHooks((prev) => [...prev, { step: ev.step, token: ev.token }]);
      
      if (autoAck) {
        setTimeout(() => {
          let kind = "";
          if (ev.step === "notifyRestaurant") kind = "restaurant-accept";
          if (ev.step === "assignDriver") kind = "driver-accept";
          if (ev.step === "trackDelivery") kind = "delivered";
          if (kind) {
            resumeHook(currentOrderId, kind, true);
          }
        }, 800);
      }
    } else if (ev.type === "hook_resolved") {
      setActiveHooks((prev) => prev.filter((h) => h.step !== ev.step));
    } else if (ev.type === "done") {
      setIsRunning(false);
      setIsDone(true);
      setFinalStatus(ev.status);
    }
  };

  const resumeHook = async (id: string, kind: string, accepted: boolean) => {
    try {
      await fetch(`/api/orders/${id}/resume`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, accepted, reason: accepted ? "OK" : "Manual reject" }),
      });
    } catch (err) {
      console.error("Resume failed", err);
    }
  };

  return (
    <div className={`min-h-screen bg-black text-white ${geist.className} overflow-x-hidden selection:bg-fuchsia-500 selection:text-white`}>
      {/* VERCEL GRADIENT HERO BACKGROUND */}
      <div className="fixed inset-0 z-0 flex items-center justify-center opacity-40 pointer-events-none">
        <div 
          className="w-[120vw] h-[120vh] animate-spin-slow"
          style={{
            background: "conic-gradient(from 0deg, #0070f3, #7928ca, #ff0080, #0070f3)",
            filter: "blur(140px)",
            animationDuration: "20s"
          }}
        />
      </div>
      <div className="fixed inset-0 z-0 bg-black/60 pointer-events-none mix-blend-multiply" />

      {/* CONTENT CONTAINER */}
      <div className="relative z-10 max-w-[1920px] mx-auto p-12 lg:p-24 flex flex-col xl:flex-row gap-16 xl:gap-24 items-start">
        
        {/* LEFT COLUMN: PHONE MOCKUP */}
        <div className="w-full xl:w-auto flex flex-col items-center xl:items-start shrink-0">
          
          {/* HERO HEADINGS */}
          <div className="mb-16 text-center xl:text-left">
            <h1 className="text-7xl lg:text-8xl xl:text-9xl font-extrabold tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-br from-white to-white/50">
              Ship donuts<br/>at the edge.
            </h1>
            <p className="text-3xl lg:text-4xl text-zinc-400 font-medium tracking-tight">
              Triangle Donuts. Powered by Vercel.
            </p>
          </div>

          {/* PHONE DEVICE */}
          <div className="relative w-[560px] h-[1120px] bg-white rounded-[64px] border-[12px] border-zinc-900 shadow-2xl overflow-hidden flex flex-col">
            {/* Dynamic Island */}
            <div className="absolute top-0 inset-x-0 h-10 flex justify-center z-50 pointer-events-none">
              <div className="w-40 h-8 bg-black rounded-b-3xl" />
            </div>

            {/* PHONE INTERIOR */}
            <div className="flex-1 overflow-y-auto text-black flex flex-col bg-white">
              
              {!isRunning && !isDone ? (
                // --- ORDERING VIEW ---
                <div className="p-10 pt-20 flex flex-col gap-10">
                  <div className="text-center pb-8 border-b border-zinc-200">
                    <div className="w-24 h-24 mx-auto mb-6 bg-black text-white flex items-center justify-center rounded-3xl transform rotate-12">
                      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2L2 22h20L12 2z" />
                      </svg>
                    </div>
                    <h2 className="text-5xl font-bold tracking-tight">Menu</h2>
                  </div>

                  <div className="flex flex-col gap-8">
                    {menu.map((item) => (
                      <div key={item.id} className="flex justify-between items-center">
                        <div className="flex-1 pr-6">
                          <h3 className="text-3xl font-bold mb-2">{item.name}</h3>
                          <p className="text-xl text-zinc-500 leading-tight">{item.description}</p>
                          <p className="text-2xl font-semibold mt-3">${item.price.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-5 bg-zinc-100 rounded-full p-2 shrink-0">
                          <button onClick={() => updateQty(item.id, -1)} className="w-14 h-14 bg-white rounded-full text-3xl font-medium shadow-sm active:scale-95 transition-transform flex items-center justify-center">−</button>
                          <span className="text-3xl font-bold w-6 text-center">{item.qty}</span>
                          <button onClick={() => updateQty(item.id, 1)} className="w-14 h-14 bg-black text-white rounded-full text-3xl font-medium shadow-sm active:scale-95 transition-transform flex items-center justify-center">+</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="mt-8 pt-8 border-t border-zinc-200 flex flex-col gap-6">
                    <h3 className="text-4xl font-bold">Details</h3>
                    <input 
                      type="text" 
                      value={customerName} 
                      onChange={e => setCustomerName(e.target.value)} 
                      className="w-full bg-zinc-100 p-6 rounded-2xl text-2xl font-medium focus:outline-none focus:ring-4 focus:ring-black/5"
                      placeholder="Name"
                    />
                    <input 
                      type="text" 
                      value={address} 
                      onChange={e => setAddress(e.target.value)} 
                      className="w-full bg-zinc-100 p-6 rounded-2xl text-2xl font-medium focus:outline-none focus:ring-4 focus:ring-black/5"
                      placeholder="Address"
                    />
                  </div>

                  <div className="mt-8 pt-8 border-t border-zinc-200">
                    <div className="flex justify-between items-center mb-8">
                      <span className="text-4xl font-bold">Total</span>
                      <span className="text-5xl font-extrabold">${total.toFixed(2)}</span>
                    </div>
                    <button 
                      onClick={placeOrder}
                      disabled={cartItems.length === 0}
                      className="w-full relative overflow-hidden rounded-3xl py-8 group disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <div className="absolute inset-0 bg-[conic-gradient(from_0deg,#0070f3,#7928ca,#ff0080,#0070f3)] group-hover:scale-110 transition-transform duration-700" />
                      <div className="relative z-10 text-white text-4xl font-extrabold flex items-center justify-center gap-4">
                        Place Order
                        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                      </div>
                    </button>
                  </div>
                </div>
              ) : (
                // --- TRACKING VIEW ---
                <div className="p-10 pt-20 flex flex-col h-full bg-zinc-50">
                  <div className="text-center pb-12">
                    <div className="w-24 h-24 mx-auto mb-6 bg-black text-white flex items-center justify-center rounded-full">
                       <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {finalStatus === "completed" ? (
                          <path d="M20 6L9 17l-5-5" />
                        ) : finalStatus === "rolled_back" ? (
                          <path d="M18 6L6 18M6 6l12 12" />
                        ) : (
                          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" className="animate-spin" style={{ transformOrigin: 'center' }} />
                        )}
                      </svg>
                    </div>
                    <h2 className="text-5xl font-bold tracking-tight mb-4">
                      {finalStatus === "completed" ? "Order Complete" : finalStatus === "rolled_back" ? "Order Failed" : "Processing"}
                    </h2>
                    <p className="text-2xl text-zinc-500 font-mono">{orderId}</p>
                  </div>

                  <div className="flex-1 bg-white rounded-3xl p-8 shadow-sm border border-zinc-200">
                    <h3 className="text-3xl font-bold mb-8">Status Updates</h3>
                    <div className="flex flex-col gap-8 relative">
                      <div className="absolute left-4 top-4 bottom-4 w-1 bg-zinc-100 rounded-full" />
                      
                      {SAGA_STEPS.map((step, idx) => {
                        const status = stepStatuses[step.id] || "pending";
                        const isActive = status === "running" || status === "waiting";
                        const isDone = status === "succeeded" || status === "skipped";
                        const isFailed = status === "failed";
                        
                        let colorClass = "bg-zinc-200 border-zinc-300";
                        let textClass = "text-zinc-400";
                        if (isDone) { colorClass = "bg-black border-black text-white"; textClass = "text-black"; }
                        if (isActive) { colorClass = "bg-[conic-gradient(from_0deg,#0070f3,#7928ca,#ff0080,#0070f3)] border-transparent text-white animate-pulse"; textClass = "text-black font-bold"; }
                        if (isFailed) { colorClass = "bg-red-500 border-red-500 text-white"; textClass = "text-red-600 font-bold"; }

                        return (
                          <div key={step.id} className="relative flex items-center gap-8 z-10">
                            <div className={`w-9 h-9 rounded-full border-4 flex items-center justify-center shrink-0 transition-colors ${colorClass}`}>
                              {isDone && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5" /></svg>}
                              {isFailed && <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6L6 18M6 6l12 12" /></svg>}
                            </div>
                            <div className={`text-2xl ${textClass} transition-colors`}>
                              {step.label}
                              {status === "waiting" && <span className="ml-4 text-xl text-fuchsia-600 animate-pulse">(Action Required)</span>}
                              {status === "failed" && <span className="ml-4 text-xl text-red-600">(Failed)</span>}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {isDone && (
                    <button 
                      onClick={() => { setIsRunning(false); setIsDone(false); setStepStatuses({}); setEvents([]); }}
                      className="mt-8 w-full bg-black text-white text-3xl font-bold py-8 rounded-3xl"
                    >
                      New Order
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: DASHBOARD */}
        <div className="flex-1 w-full flex flex-col gap-10 pt-16 xl:pt-0">
          
          {/* Controls Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-12 shadow-2xl">
            <div className="flex flex-col lg:flex-row gap-12 justify-between lg:items-center mb-10">
              <h2 className="text-5xl font-bold">Saga DevTools</h2>
              <div className="flex items-center gap-8">
                <label className="flex items-center gap-4 cursor-pointer group">
                  <div className={`w-20 h-10 rounded-full p-1 transition-colors ${autoAck ? "bg-[#0070f3]" : "bg-white/20"}`}>
                    <div className={`w-8 h-8 bg-white rounded-full shadow-md transform transition-transform ${autoAck ? "translate-x-10" : "translate-x-0"}`} />
                  </div>
                  <span className="text-2xl font-medium group-hover:text-[#0070f3] transition-colors">Auto-Ack Hooks</span>
                </label>
              </div>
            </div>

            <div className="bg-black/50 border border-white/10 rounded-3xl p-8 flex flex-col sm:flex-row gap-8 items-center">
              <span className="text-3xl font-medium text-zinc-400">Inject Failure:</span>
              <select 
                className="flex-1 bg-white/10 border border-white/20 text-white text-2xl py-5 px-8 rounded-2xl focus:outline-none focus:border-[#0070f3] appearance-none"
                value={failAt || ""}
                onChange={(e) => setFailAt((e.target.value as FailStep) || null)}
              >
                <option value="" className="bg-zinc-900">None (Happy Path)</option>
                {SAGA_STEPS.map(s => <option key={s.id} value={s.id} className="bg-zinc-900">Fail at {s.label}</option>)}
              </select>
            </div>
          </div>

          {/* Saga Visualizer Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-12 shadow-2xl">
            <h3 className="text-4xl font-bold mb-12">Saga Execution</h3>
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-8">
              {SAGA_STEPS.map((step) => {
                const status = stepStatuses[step.id] || "pending";
                const isActive = status === "running" || status === "waiting";
                const isDone = status === "succeeded" || status === "skipped";
                const isFailed = status === "failed";

                return (
                  <div key={step.id} className="relative aspect-square max-h-[240px] mx-auto w-full flex items-center justify-center group">
                    {/* The Triangle */}
                    <div 
                      className={`absolute inset-0 transition-all duration-500`}
                      style={{
                        clipPath: "polygon(50% 0%, 0% 100%, 100% 100%)",
                        background: isActive ? "conic-gradient(from 0deg, #0070f3, #7928ca, #ff0080, #0070f3)" : 
                                   isFailed ? "#ef4444" :
                                   isDone ? "rgba(255,255,255,0.1)" : "transparent",
                        border: !isActive && !isFailed && !isDone ? "4px solid rgba(255,255,255,0.2)" : "none",
                        boxShadow: isActive ? "0 0 40px rgba(121, 40, 202, 0.5)" : "none",
                        transform: isActive ? "scale(1.05)" : "scale(1)"
                      }}
                    />
                    <div className="relative z-10 flex flex-col items-center justify-end h-full pb-8 lg:pb-12 text-center px-4">
                      <span className="text-xl lg:text-3xl font-bold drop-shadow-lg text-white">
                        {step.label}
                      </span>
                      <span className={`text-lg lg:text-xl font-mono mt-2 uppercase tracking-widest ${isActive ? "text-white" : isFailed ? "text-red-200" : "text-zinc-400"}`}>
                        {status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Manual Hooks Actions */}
            {activeHooks.length > 0 && !autoAck && (
              <div className="mt-12 p-8 border-2 border-fuchsia-500/50 bg-fuchsia-500/10 rounded-3xl">
                <h4 className="text-3xl font-bold text-fuchsia-400 mb-8 flex items-center gap-4">
                  <span className="w-4 h-4 bg-fuchsia-500 rounded-full animate-ping" />
                  Awaiting Manual Action
                </h4>
                <div className="flex flex-col gap-6">
                  {activeHooks.map((h, i) => {
                    let acceptAction = "";
                    let rejectAction = "";
                    let label = "";

                    if (h.step === "notifyRestaurant") {
                      acceptAction = "restaurant-accept";
                      rejectAction = "restaurant-accept";
                      label = "Restaurant Acceptance";
                    } else if (h.step === "assignDriver") {
                      acceptAction = "driver-accept";
                      rejectAction = "driver-accept";
                      label = "Driver Assignment";
                    } else if (h.step === "trackDelivery") {
                      acceptAction = "delivered";
                      rejectAction = "delivered"; // Using same endpoint logic, just false
                      label = "Delivery Confirmation";
                    }

                    return (
                      <div key={i} className="flex flex-col lg:flex-row items-center gap-6 justify-between bg-black/40 p-6 rounded-2xl border border-white/10">
                        <span className="text-2xl font-medium">{label}</span>
                        <div className="flex gap-4 w-full lg:w-auto">
                          <button 
                            onClick={() => resumeHook(orderId!, acceptAction, true)}
                            className="flex-1 lg:flex-none px-8 py-4 bg-white text-black font-bold text-xl rounded-xl hover:bg-zinc-200 active:scale-95 transition-all"
                          >
                            Accept
                          </button>
                          <button 
                            onClick={() => resumeHook(orderId!, rejectAction, false)}
                            className="flex-1 lg:flex-none px-8 py-4 bg-red-500/20 text-red-400 font-bold text-xl rounded-xl border border-red-500/50 hover:bg-red-500/30 active:scale-95 transition-all"
                          >
                            Reject
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Event Feed Card */}
          <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-[40px] p-12 shadow-2xl flex-1 min-h-[600px] flex flex-col">
            <h3 className="text-4xl font-bold mb-8">Event Feed</h3>
            <div className={`flex-1 overflow-y-auto bg-black/50 border border-white/10 rounded-3xl p-8 font-mono text-xl lg:text-2xl leading-relaxed ${geistMono.className}`}>
              {events.length === 0 ? (
                <div className="h-full flex items-center justify-center text-zinc-600">
                  Waiting for order...
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {events.map((ev, i) => {
                    let color = "text-zinc-300";
                    let badge = "";
                    let badgeColor = "bg-zinc-800 text-zinc-300";
                    
                    if (ev.type === "log") {
                      color = "text-zinc-500";
                    } else if (ev.type.includes("succeeded") || ev.type.includes("resolved") || (ev.type === "done" && ev.status === "completed")) {
                      color = "text-emerald-400";
                      badge = "SUCCESS";
                      badgeColor = "bg-emerald-900/50 text-emerald-400 border border-emerald-500/30";
                    } else if (ev.type.includes("failed") || ev.type === "compensating" || ev.type.includes("rolled_back")) {
                      color = "text-red-400";
                      badge = "ERROR";
                      badgeColor = "bg-red-900/50 text-red-400 border border-red-500/30";
                    } else if (ev.type === "waiting_for_hook") {
                      color = "text-fuchsia-400";
                      badge = "WAITING";
                      badgeColor = "bg-fuchsia-900/50 text-fuchsia-400 border border-fuchsia-500/30";
                    } else {
                      badge = "INFO";
                      badgeColor = "bg-[#0070f3]/20 text-[#0070f3] border border-[#0070f3]/30";
                    }

                    const stepLabel = "step" in ev ? ev.step : "action" in ev ? ev.action : ev.type;

                    return (
                      <div key={i} className="border-b border-white/5 pb-4 last:border-0 last:pb-0 break-words">
                        <div className="flex items-start gap-4">
                          {badge && (
                            <span className={`px-3 py-1 rounded text-lg font-bold shrink-0 mt-1 ${badgeColor}`}>
                              {badge}
                            </span>
                          )}
                          <span className={color}>
                            <span className="font-bold text-white/70 mr-4">[{stepLabel}]</span>
                            {ev.type === "log" ? ev.message : 
                             "error" in ev ? (ev as any).error : 
                             "detail" in ev ? (ev as any).detail : 
                             ev.type}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={eventsEndRef} />
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
      
      {/* Global CSS adjustments for animations */}
      <style>{`
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .animate-spin-slow {
          animation: spin-slow linear infinite;
        }
      `}</style>
    </div>
  );
}
