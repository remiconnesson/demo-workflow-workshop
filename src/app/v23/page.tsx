"use client";

import React, { useState, useEffect, useRef } from "react";
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"] });
const mono = Geist_Mono({ subsets: ["latin"] });

// Types
type OrderItem = { id: string; name: string; price: number; qty: number; desc: string };
type FailStep =
  | "validateOrder"
  | "chargeCard"
  | "pingRestaurant"
  | "findDriver"
  | "trackDelivery"
  | "sendReceipts"
  | null;

type OrderEvent =
  | { type: "step_running"; step: string; label: string }
  | { type: "step_succeeded"; step: string; label: string; detail?: string }
  | { type: "step_failed"; step: string; label: string; error: string }
  | { type: "step_skipped"; step: string; label: string }
  | { type: "waiting_for_hook"; step: string; token: string; label: string }
  | { type: "hook_resolved"; step: string; token: string; detail?: string }
  | { type: "compensation_pushed"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver"; forStep: string }
  | { type: "compensating"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver" }
  | { type: "compensated"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver" }
  | { type: "log"; message: string }
  | { type: "done"; status: "completed" | "rolled_back"; orderId: string; compensationOrder: string[] };

const MENU: OrderItem[] = [
  { id: "deployer", name: "The Deployer", price: 4.99, qty: 0, desc: "Immutable strawberry glaze." },
  { id: "edge", name: "Edge Runtime", price: 3.99, qty: 0, desc: "Executes in milliseconds." },
  { id: "coldstart", name: "Cold Start", price: 2.99, qty: 0, desc: "Needs a warm cup of coffee." },
  { id: "hmr", name: "Hot Module", price: 5.99, qty: 0, desc: "Spicy cinnamon sugar replacement." },
  { id: "serverless", name: "Server Sprinkle", price: 4.49, qty: 0, desc: "Infinitely scalable topping." },
  { id: "isr", name: "ISR Glaze", price: 3.49, qty: 0, desc: "Stale-while-revalidate goodness." },
];

const STEPS = [
  { id: "validateOrder", label: "Validate" },
  { id: "chargeCard", label: "Charge" },
  { id: "pingRestaurant", label: "Restaurant" },
  { id: "findDriver", label: "Driver" },
  { id: "trackDelivery", label: "Delivery" },
  { id: "sendReceipts", label: "Receipt" },
];

export default function TriangleDonutsV23() {
  const [cart, setCart] = useState<OrderItem[]>(MENU);
  const [name, setName] = useState("Vercel Demo");
  const [address, setAddress] = useState("440 N Barranca Ave");
  
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  
  const [runId, setRunId] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "submitting" | "running" | "done">("idle");
  const [finalResult, setFinalResult] = useState<"completed" | "rolled_back" | null>(null);
  const [activeHook, setActiveHook] = useState<{ step: string; token: string } | null>(null);

  const [stepStatuses, setStepStatuses] = useState<Record<string, string>>({});
  const [events, setEvents] = useState<OrderEvent[]>([]);

  const autoAckRef = useRef(autoAck);
  useEffect(() => { autoAckRef.current = autoAck; }, [autoAck]);

  const updateCart = (id: string, delta: number) => {
    setCart((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const nextQty = Math.max(0, item.qty + delta);
          return { ...item, qty: nextQty };
        }
        return item;
      })
    );
  };

  const handleOrder = async () => {
    const items = cart.filter(i => i.qty > 0);
    if (items.length === 0) return;
    
    setStatus("submitting");
    setEvents([]);
    setStepStatuses({});
    setActiveHook(null);
    setFinalResult(null);

    try {
      const res = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: "ORDER-" + Math.random().toString(36).slice(2, 8).toUpperCase(),
          customerName: name,
          address,
          items,
          failAt,
          autoAck: false, // Handled on client side for demo visibility
        }),
      });
      const data = await res.json();
      setRunId(data.runId);
      setOrderId(data.orderId);
      setStatus("running");
      pollStream(data.runId, data.orderId);
    } catch (e) {
      console.error(e);
      setStatus("idle");
    }
  };

  const pollStream = async (rId: string, oId: string) => {
    try {
      const res = await fetch(`/api/runs/${rId}/stream`);
      if (!res.body) return;
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event: OrderEvent = JSON.parse(line);
          processEvent(event, oId);
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const processEvent = (e: OrderEvent, oId: string) => {
    setEvents((prev) => {
      const next = [...prev, e];
      return next.slice(-8); // keep last 8 for visibility
    });

    if (e.type === "step_running") setStepStatuses((s) => ({ ...s, [e.step]: "running" }));
    if (e.type === "step_succeeded") setStepStatuses((s) => ({ ...s, [e.step]: "success" }));
    if (e.type === "step_failed") setStepStatuses((s) => ({ ...s, [e.step]: "failed" }));
    if (e.type === "step_skipped") setStepStatuses((s) => ({ ...s, [e.step]: "skipped" }));
    
    if (e.type === "waiting_for_hook") {
      setStepStatuses((s) => ({ ...s, [e.step]: "waiting" }));
      setActiveHook({ step: e.step, token: e.token });
      
      if (autoAckRef.current) {
        setTimeout(() => {
          resumeHook(oId, e.step, e.token, true);
        }, 800);
      }
    }
    
    if (e.type === "hook_resolved") {
      setActiveHook(null);
      setStepStatuses((s) => ({ ...s, [e.step]: "success" }));
    }
    
    if (e.type === "compensating") {
      let stepId = "";
      if (e.action === "refundPayment") stepId = "chargeCard";
      if (e.action === "cancelRestaurantOrder") stepId = "pingRestaurant";
      if (e.action === "releaseDriver") stepId = "findDriver";
      if (stepId) setStepStatuses((s) => ({ ...s, [stepId]: "compensating" }));
    }
    
    if (e.type === "compensated") {
      let stepId = "";
      if (e.action === "refundPayment") stepId = "chargeCard";
      if (e.action === "cancelRestaurantOrder") stepId = "pingRestaurant";
      if (e.action === "releaseDriver") stepId = "findDriver";
      if (stepId) setStepStatuses((s) => ({ ...s, [stepId]: "compensated" }));
    }

    if (e.type === "done") {
      setStatus("done");
      setFinalResult(e.status);
    }
  };

  const resumeHook = async (oId: string, step: string, token: string, accept: boolean) => {
    let kind = "";
    if (step === "pingRestaurant") kind = "restaurant-accept";
    else if (step === "findDriver") kind = "driver-accept";
    else if (step === "trackDelivery") kind = "delivered";
    else return;

    setActiveHook(null); // Optimistic clear

    await fetch(`/api/orders/${oId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, accepted: accept }),
    });
  };

  const reset = () => {
    setStatus("idle");
    setCart(MENU);
    setEvents([]);
    setStepStatuses({});
    setActiveHook(null);
    setFinalResult(null);
  };

  const totalQty = cart.reduce((acc, c) => acc + c.qty, 0);
  const totalAmount = cart.reduce((acc, c) => acc + c.qty * c.price, 0);

  const getEventText = (e: OrderEvent) => {
    switch (e.type) {
      case "step_running": return `▶ RUNNING: ${(e as any).step}`;
      case "step_succeeded": return `✔ SUCCESS: ${(e as any).step}`;
      case "step_failed": return `✖ FAILED: ${(e as any).step} (${e.error})`;
      case "step_skipped": return `⏭ SKIPPED: ${(e as any).step}`;
      case "waiting_for_hook": return `⏸ WAITING: ${(e as any).step}`;
      case "hook_resolved": return `✔ RESOLVED: ${(e as any).step}`;
      case "compensation_pushed": return `+ COMP PUSHED: ${e.action} (for ${(e as any).forStep})`;
      case "compensating": return `↩ COMPENSATING: ${e.action}`;
      case "compensated": return `✔ COMPENSATED: ${e.action}`;
      case "log": return `ℹ LOG: ${e.message}`;
      case "done": return `🏁 DONE: ${e.status.toUpperCase()}`;
      default: return `? UNKNOWN: ${(e as any).type}`;
    }
  };

  const TriangleIcon = ({ status }: { status: string }) => {
    let fill = "transparent";
    let stroke = "var(--color-white-20, rgba(255,255,255,0.2))";
    if (status === "running") { fill = "white"; stroke = "white"; }
    if (status === "waiting") { fill = "#F5A623"; stroke = "#F5A623"; } // yellow-orange
    if (status === "success") { fill = "white"; stroke = "white"; }
    if (status === "failed") { fill = "#E00"; stroke = "#E00"; } // red
    if (status === "skipped") { fill = "rgba(255,255,255,0.1)"; stroke = "rgba(255,255,255,0.2)"; }
    if (status === "compensating") { fill = "#F5A623"; stroke = "#F5A623"; } // orange
    if (status === "compensated") { fill = "transparent"; stroke = "#E00"; } // red outline

    return (
      <div className={`relative flex items-center justify-center transition-all duration-500 ${status === "running" ? "scale-125" : ""}`}>
        <svg viewBox="0 0 100 100" width="80" height="80" className="drop-shadow-2xl">
          <polygon points="50,10 90,90 10,90" fill={fill} stroke={stroke} strokeWidth="4" />
        </svg>
      </div>
    );
  };

  return (
    <main className={`min-h-screen bg-black text-white ${geist.className} bg-[radial-gradient(circle_at_center,_rgba(40,40,40,1)_0%,_rgba(0,0,0,1)_100%)] overflow-x-hidden selection:bg-white selection:text-black`}>
      <div className="max-w-[1920px] mx-auto p-16 flex flex-col xl:flex-row gap-20 items-center xl:items-stretch min-h-screen">
        
        {/* PHONE COLUMN */}
        <div className="w-[600px] h-[1100px] shrink-0 border border-white/20 rounded-[3rem] p-10 flex flex-col relative bg-black shadow-[0_0_150px_rgba(255,255,255,0.15)] overflow-hidden">
          {/* dynamic island / camera cutout */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-8 bg-black rounded-b-3xl z-50"></div>

          {status === "idle" ? (
            <div className="flex flex-col h-full overflow-y-auto pb-10">
              <h1 className="text-5xl font-black tracking-tighter mb-12 mt-8 text-center uppercase">
                Triangle<br/>Donuts.
              </h1>
              
              <div className="flex-1 space-y-8">
                {cart.map((item) => (
                  <div key={item.id} className="flex justify-between items-center py-4 border-b border-white/10">
                    <div className="flex-1">
                      <div className="text-3xl font-bold tracking-tight">{item.name}</div>
                      <div className="text-xl text-neutral-400 mt-2">{item.desc}</div>
                      <div className="text-2xl font-mono mt-3">${item.price}</div>
                    </div>
                    <div className="flex items-center gap-6 bg-white/5 rounded-full p-2 border border-white/10 shrink-0 ml-4">
                      <button onClick={() => updateCart(item.id, -1)} className="w-16 h-16 rounded-full bg-white/10 text-3xl font-mono flex items-center justify-center hover:bg-white/20 transition-colors">-</button>
                      <span className="text-3xl font-mono w-8 text-center">{item.qty}</span>
                      <button onClick={() => updateCart(item.id, 1)} className="w-16 h-16 rounded-full bg-white/10 text-3xl font-mono flex items-center justify-center hover:bg-white/20 transition-colors">+</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-12 space-y-6">
                <input 
                  type="text" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  className="w-full bg-white/5 border border-white/20 text-3xl p-8 rounded-2xl outline-none focus:border-white transition-colors" 
                  placeholder="Your Name"
                />
                <input 
                  type="text" 
                  value={address} 
                  onChange={e => setAddress(e.target.value)} 
                  className="w-full bg-white/5 border border-white/20 text-3xl p-8 rounded-2xl outline-none focus:border-white transition-colors" 
                  placeholder="Delivery Address"
                />
                
                <button 
                  onClick={handleOrder} 
                  disabled={totalQty === 0}
                  className="w-full bg-white text-black text-4xl font-black p-8 rounded-full hover:bg-neutral-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed mt-8 uppercase tracking-tighter"
                >
                  Place Order &middot; ${totalAmount.toFixed(2)}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full relative">
              <h2 className="text-4xl font-bold tracking-tighter mb-12 mt-12 text-center uppercase border-b border-white/10 pb-8">
                Order Status
              </h2>

              <div className="flex-1 flex flex-col justify-center items-center gap-12">
                {finalResult === "completed" ? (
                  <>
                    <div className="w-48 h-48 bg-white text-black flex items-center justify-center rounded-full">
                      <svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <div className="text-5xl font-black text-center tracking-tighter uppercase">Delivered.</div>
                  </>
                ) : finalResult === "rolled_back" ? (
                  <>
                    <div className="w-48 h-48 bg-red-600 text-white flex items-center justify-center rounded-full">
                      <svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </div>
                    <div className="text-5xl font-black text-center tracking-tighter uppercase">Rolled Back.</div>
                  </>
                ) : (
                  <>
                    <div className="w-48 h-48 rounded-full border-8 border-white/20 border-t-white animate-spin"></div>
                    <div className="text-5xl font-black text-center tracking-tighter uppercase animate-pulse">Orchestrating</div>
                  </>
                )}

                <div className="bg-white/5 border border-white/10 rounded-3xl p-8 w-full mt-12">
                  <div className="text-2xl font-mono text-neutral-400 mb-4">ORDER {orderId || "ID"}</div>
                  <div className="text-3xl font-bold">{name}</div>
                  <div className="text-2xl text-neutral-300 mt-2">{address}</div>
                </div>
              </div>

              {status === "done" && (
                <button 
                  onClick={reset} 
                  className="w-full bg-white/10 text-white border border-white/20 text-3xl font-bold p-8 rounded-full hover:bg-white/20 transition-colors mt-auto mb-10 uppercase tracking-tighter"
                >
                  New Order
                </button>
              )}
            </div>
          )}
        </div>

        {/* DASHBOARD COLUMN (KEYNOTE) */}
        <div className="flex-1 flex flex-col py-10 justify-between">
          <div>
            <div className="flex justify-between items-start mb-24">
              <h2 className="text-8xl font-black tracking-tighter uppercase leading-none">Saga<br/>Orchestration.</h2>
              <div className="flex flex-col gap-6 items-end">
                <div className="flex items-center gap-6">
                  <label className="text-3xl font-bold tracking-tighter uppercase">Fail At:</label>
                  <select 
                    value={failAt || ""} 
                    onChange={e => setFailAt((e.target.value as FailStep) || null)}
                    className="bg-black border-2 border-white/20 text-2xl p-4 rounded-xl outline-none focus:border-white font-mono uppercase tracking-tighter appearance-none w-64 text-center cursor-pointer"
                  >
                    <option value="">None</option>
                    {STEPS.map(s => <option key={s.id} value={s.id}>{s.id}</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-6">
                  <label className="text-3xl font-bold tracking-tighter uppercase">Auto-Ack:</label>
                  <button 
                    onClick={() => setAutoAck(!autoAck)}
                    className={`w-24 h-12 rounded-full border-2 transition-colors relative flex items-center ${autoAck ? "bg-white border-white" : "bg-transparent border-white/40"}`}
                  >
                    <div className={`w-10 h-10 rounded-full transition-transform absolute ${autoAck ? "bg-black translate-x-12" : "bg-white/40 translate-x-1"}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* SAGA WAYPOINTS */}
            <div className="w-full relative mt-40 mb-48 px-12">
              <div className="absolute left-24 right-24 h-2 bg-white/10 top-1/2 -translate-y-1/2 rounded-full z-0"></div>
              <div className="flex justify-between relative z-10">
                {STEPS.map((step) => {
                  const s = stepStatuses[step.id] || "idle";
                  return (
                    <div key={step.id} className="flex flex-col items-center gap-8 group">
                      <div className="bg-black p-4 rounded-full z-10">
                        <TriangleIcon status={s} />
                      </div>
                      <div className={`absolute top-32 text-center w-64 -ml-32 left-1/2 uppercase tracking-widest font-bold ${s === "running" ? "text-4xl text-white" : "text-3xl text-neutral-500"}`}>
                        {step.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* EVENT FEED & HOOKS */}
            <div className="flex justify-between gap-16 items-start h-[450px]">
              <div className="flex-1 max-w-[1100px]">
                <h3 className="text-4xl font-bold tracking-tighter uppercase mb-10 text-white/50">Event Stream</h3>
                <ul className={`space-y-6 ${mono.className} text-[22px] leading-relaxed`}>
                  {events.length === 0 && <li className="text-neutral-600">Awaiting events...</li>}
                  {events.map((e, i) => {
                    const isLast = i === events.length - 1;
                    return (
                      <li key={i} className={`flex gap-6 animate-in slide-in-from-bottom-4 fade-in duration-300 ${isLast ? "text-white font-bold" : "text-neutral-400"}`}>
                        <span className="text-neutral-600 shrink-0 select-none">&gt;</span>
                        <span className="break-all">{getEventText(e)}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* HOOK CONTROLS */}
              {activeHook && !autoAck && (
                <div className="shrink-0 bg-white/5 border border-white/20 rounded-3xl p-12 flex flex-col items-center gap-8 w-[400px] animate-in fade-in slide-in-from-right-8 duration-500 shadow-[0_0_100px_rgba(255,255,255,0.05)]">
                  <div className="text-3xl font-black uppercase text-center tracking-tighter mb-4">
                    Require Action:<br/>
                    <span className="text-yellow-400 text-2xl font-mono mt-4 block break-all">{activeHook.step}</span>
                  </div>
                  
                  {activeHook.step === "pingRestaurant" || activeHook.step === "findDriver" ? (
                    <>
                      <button 
                        onClick={() => resumeHook(orderId!, activeHook.step, activeHook.token, true)}
                        className="w-full bg-white text-black py-8 text-3xl font-black uppercase tracking-tighter rounded-full hover:bg-neutral-200 transition-colors"
                      >
                        Accept
                      </button>
                      <button 
                        onClick={() => resumeHook(orderId!, activeHook.step, activeHook.token, false)}
                        className="w-full bg-transparent text-red-500 border-4 border-red-500 py-8 text-3xl font-black uppercase tracking-tighter rounded-full hover:bg-red-500/10 transition-colors"
                      >
                        Reject
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => resumeHook(orderId!, activeHook.step, activeHook.token, true)}
                      className="w-full bg-white text-black py-8 text-3xl font-black uppercase tracking-tighter rounded-full hover:bg-neutral-200 transition-colors"
                    >
                      Delivered
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          
          <div className="mt-auto pt-10 text-neutral-500 text-xl font-mono uppercase tracking-widest border-t border-white/10 flex justify-between">
            <div>Triangle Donuts Keynote Demo</div>
            <div>Vercel Platform</div>
          </div>
        </div>
      </div>
    </main>
  );
}
