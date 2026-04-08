"use client";

import React, { useState, useRef, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

type OrderItem = { id: string; name: string; price: number; qty: number };
type FailStep = "validateOrder" | "chargePayment" | "notifyRestaurant" | "assignDriver" | "trackDelivery" | "sendReceipt" | null;

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

const MENU_ITEMS = [
  { id: "deployer", name: "The Deployer", desc: "Classic glazed triangle", price: 4.00 },
  { id: "edge", name: "Edge Runtime", desc: "Powdered edge-heavy", price: 4.50 },
  { id: "cold", name: "Cold Start", desc: "Frozen icing triangle", price: 5.00 },
  { id: "hot", name: "Hot Module", desc: "Spicy cinnamon triangle", price: 4.50 },
  { id: "serverless", name: "Serverless Sprinkle", desc: "Rainbow sprinkled", price: 5.50 },
];

type StepState = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

interface SagaStep {
  id: string;
  label: string;
  state: StepState;
}

const INITIAL_STEPS: SagaStep[] = [
  { id: "validateOrder", label: "Validate Order", state: "pending" },
  { id: "chargePayment", label: "Charge Payment", state: "pending" },
  { id: "notifyRestaurant", label: "Notify Restaurant", state: "pending" },
  { id: "assignDriver", label: "Assign Driver", state: "pending" },
  { id: "trackDelivery", label: "Track Delivery", state: "pending" },
  { id: "sendReceipt", label: "Send Receipt", state: "pending" },
];

export default function V22Page() {
  const [cart, setCart] = useState<OrderItem[]>(MENU_ITEMS.map(i => ({ ...i, qty: 0 })));
  const [name, setName] = useState("Alice");
  const [address, setAddress] = useState("123 Vercel Way");
  
  const [orderId, setOrderId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  
  const [steps, setSteps] = useState<SagaStep[]>(INITIAL_STEPS);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [waitToken, setWaitToken] = useState<{ step: string; token: string } | null>(null);
  const [doneStatus, setDoneStatus] = useState<"completed" | "rolled_back" | null>(null);
  
  const orderIdRef = useRef<string | null>(null);
  const autoAckRef = useRef<boolean>(true);
  const eventsEndRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => { orderIdRef.current = orderId; }, [orderId]);
  useEffect(() => { autoAckRef.current = autoAck; }, [autoAck]);
  useEffect(() => {
    if (eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [events]);

  const total = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  const inc = (id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: i.qty + 1 } : i));
  const dec = (id: string) => setCart(c => c.map(i => i.id === id ? { ...i, qty: Math.max(0, i.qty - 1) } : i));

  const updateStep = (id: string, state: StepState) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, state } : s));
  };

  const getHookKind = (step: string) => {
    if (step === "notifyRestaurant") return "restaurant-accept";
    if (step === "assignDriver") return "driver-accept";
    if (step === "trackDelivery") return "delivered";
    return "";
  };

  const resumeHook = async (kind: string, accepted: boolean) => {
    if (!orderIdRef.current) return;
    try {
      await fetch("/api/orders/" + orderIdRef.current + "/resume", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, accepted })
      });
      setWaitToken(null);
    } catch (err) {
      console.error(err);
    }
  };

  const startOrder = async () => {
    try {
      setOrderId(null);
      setRunId(null);
      setSteps(INITIAL_STEPS);
      setEvents([]);
      setWaitToken(null);
      setDoneStatus(null);
      
      const newOrderId = "ORD-" + Math.random().toString(36).substring(2, 9).toUpperCase();
      
      const res = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: newOrderId,
          customerName: name,
          address: address,
          items: cart.filter(i => i.qty > 0),
          failAt,
          autoAck
        })
      });
      const data = await res.json();
      setRunId(data.runId);
      setOrderId(data.orderId);
      
      const streamRes = await fetch("/api/runs/" + data.runId + "/stream");
      if (!streamRes.body) return;
      const reader = streamRes.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.trim()) {
            const event = JSON.parse(line) as OrderEvent;
            setEvents(prev => [...prev, event]);
            
            if (event.type === "step_running") {
              updateStep(event.step, "running");
            } else if (event.type === "step_succeeded") {
              updateStep(event.step, "success");
              setWaitToken(null);
            } else if (event.type === "step_failed") {
              updateStep(event.step, "failed");
            } else if (event.type === "step_skipped") {
              updateStep(event.step, "skipped");
            } else if (event.type === "waiting_for_hook") {
              updateStep(event.step, "waiting");
              setWaitToken({ step: event.step, token: event.token });
              if (autoAckRef.current) {
                setTimeout(() => {
                  const kind = getHookKind(event.step);
                  if (kind) resumeHook(kind, true);
                }, 800);
              }
            } else if (event.type === "done") {
              setDoneStatus(event.status);
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  const resetOrder = () => {
    setOrderId(null);
    setRunId(null);
    setSteps(INITIAL_STEPS);
    setEvents([]);
    setWaitToken(null);
    setDoneStatus(null);
  };

  function formatEvent(e: OrderEvent) {
    if (e.type === "step_running") return "▶ RUNNING: " + e.step;
    if (e.type === "step_succeeded") return "✔ SUCCESS: " + e.step;
    if (e.type === "step_failed") return "✖ FAILED: " + e.step + " - " + e.error;
    if (e.type === "step_skipped") return "⏭ SKIPPED: " + e.step;
    if (e.type === "waiting_for_hook") return "⏸ WAITING: " + e.step;
    if (e.type === "hook_resolved") return "✅ RESOLVED: " + e.step;
    if (e.type === "compensation_pushed") return "⏪ COMP PUSHED: " + (e as any).action;
    if (e.type === "compensating") return "⏪ COMPENSATING: " + (e as any).action;
    if (e.type === "compensated") return "⏪ COMPENSATED: " + (e as any).action;
    if (e.type === "done") return "🏁 DONE: " + e.status;
    if (e.type === "log") return "  ℹ " + e.message;
    return JSON.stringify(e);
  }

  return (
    <div className={"min-h-screen bg-black flex flex-col xl:flex-row " + geist.className}>
      {/* LEFT: Phone View */}
      <div className="xl:w-1/3 min-w-[700px] p-12 flex justify-center items-center bg-zinc-950 border-r border-zinc-900 xl:sticky xl:top-0 xl:h-screen">
        <div className="w-[560px] h-[1100px] bg-white rounded-[12px] border-4 border-[#eaeaea] flex flex-col text-black shadow-2xl overflow-hidden relative">
          
          {/* Dynamic Island / Notch Mock */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-8 bg-black rounded-b-3xl z-10" />

          {!orderId ? (
            <div className="flex flex-col h-full pt-10">
              <div className="p-10 border-b border-zinc-200 flex justify-center items-center shrink-0">
                <span className="text-4xl font-bold tracking-tighter">▲ TRIANGLE DONUTS</span>
              </div>
              
              <div className="flex-1 overflow-y-auto p-10 flex flex-col gap-8">
                <h2 className="text-2xl font-bold tracking-[0.2em] text-zinc-400 uppercase">Menu</h2>
                {cart.map(item => (
                  <div key={item.id} className="flex justify-between items-center py-4 border-b border-zinc-100 last:border-0">
                    <div className="flex flex-col gap-2">
                      <h3 className="text-3xl font-semibold">{item.name}</h3>
                      <p className="text-xl text-zinc-500">{(item as OrderItem & { desc?: string }).desc}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <span className="text-3xl font-medium">${item.price.toFixed(2)}</span>
                      <div className="flex items-center bg-zinc-100 rounded-xl overflow-hidden">
                        <button onClick={() => dec(item.id)} className="h-16 w-16 flex items-center justify-center text-4xl hover:bg-zinc-200 transition-colors">-</button>
                        <span className="text-2xl w-10 text-center font-medium">{item.qty}</span>
                        <button onClick={() => inc(item.id)} className="h-16 w-16 flex items-center justify-center text-4xl hover:bg-zinc-200 transition-colors">+</button>
                      </div>
                    </div>
                  </div>
                ))}
                
                <h2 className="text-2xl font-bold tracking-[0.2em] text-zinc-400 uppercase mt-8">Details</h2>
                <div className="flex flex-col gap-6">
                  <input 
                    className="w-full text-2xl p-6 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    placeholder="Your Name" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                  />
                  <input 
                    className="w-full text-2xl p-6 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black transition-shadow"
                    placeholder="Delivery Address" 
                    value={address} 
                    onChange={e => setAddress(e.target.value)} 
                  />
                </div>
              </div>
              
              <div className="p-10 border-t border-zinc-200 bg-zinc-50 shrink-0">
                <button 
                  onClick={startOrder} 
                  disabled={total === 0 || !name || !address} 
                  className="w-full bg-black text-white py-8 rounded-xl text-3xl font-bold disabled:bg-zinc-300 disabled:text-zinc-500 hover:bg-zinc-800 transition-colors"
                >
                  Place Order - ${total.toFixed(2)}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col h-full pt-10">
              <div className="p-10 border-b border-zinc-200 flex justify-center items-center shrink-0">
                <span className="text-4xl font-bold tracking-tighter">▲ TRIANGLE DONUTS</span>
              </div>
              
              <div className="flex-1 flex flex-col p-10 overflow-y-auto">
                <h2 className="text-5xl font-bold tracking-tight mb-4">Order Status</h2>
                <p className="text-2xl text-zinc-500 mb-12">ID: {orderId}</p>
                
                <div className="flex-1 flex flex-col justify-center gap-10">
                  {steps.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-8 relative">
                      {/* Vertical connector line */}
                      {i < steps.length - 1 && (
                        <div className="absolute left-[30px] top-[60px] bottom-[-40px] w-1 bg-zinc-200 -z-10" />
                      )}
                      <div className={"w-[60px] h-[60px] rounded-full border-4 flex items-center justify-center shrink-0 bg-white z-10 " + 
                        (s.state === "success" ? "bg-black border-black text-white" : 
                         s.state === "running" ? "border-[#0070f3] text-[#0070f3] animate-pulse" : 
                         s.state === "waiting" ? "border-[#f5a623] text-[#f5a623]" : 
                         s.state === "failed" ? "border-[#ee0000] text-[#ee0000]" : 
                         s.state === "skipped" ? "border-zinc-300 bg-zinc-100 text-zinc-400" : 
                         "border-zinc-300 text-transparent")}
                      >
                         {s.state === "success" ? <span className="text-3xl">✓</span> : 
                          s.state === "failed" ? <span className="text-3xl font-bold">!</span> : 
                          s.state === "waiting" ? <span className="text-2xl font-bold">II</span> : 
                          s.state === "skipped" ? <span className="text-2xl">⏭</span> : ""}
                      </div>
                      <span className={"text-3xl font-medium " + (
                        s.state === "pending" || s.state === "skipped" ? "text-zinc-400" : "text-black"
                      )}>
                        {s.label}
                      </span>
                    </div>
                  ))}
                </div>
                
                {doneStatus && (
                  <button 
                    onClick={resetOrder} 
                    className="w-full bg-black text-white py-8 rounded-xl text-3xl font-bold mt-12 hover:bg-zinc-800 transition-colors shrink-0"
                  >
                    Start New Order
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* RIGHT: Dashboard View */}
      <div className="flex-1 p-16 flex flex-col overflow-x-hidden min-h-screen text-white bg-black">
        <h1 className="text-6xl font-semibold tracking-tight">Saga runtime</h1>
        <p className="text-2xl text-zinc-400 mt-6">Distributed transaction monitor</p>

        {/* Controls */}
        <div className="flex items-center gap-16 mt-16 bg-zinc-900/50 p-8 rounded-2xl border border-zinc-800">
          <div className="flex flex-col gap-4">
            <label className="text-2xl font-semibold tracking-wide text-zinc-400 uppercase">Simulate Failure</label>
            <select 
              className="bg-black border border-zinc-700 text-white text-2xl p-5 rounded-xl min-w-[320px] focus:outline-none focus:border-white focus:ring-1 focus:ring-white transition-colors"
              value={failAt || ""}
              onChange={e => setFailAt((e.target.value as FailStep) || null)}
            >
              <option value="">No Failure</option>
              <option value="validateOrder">Validate Order</option>
              <option value="chargePayment">Charge Payment</option>
              <option value="notifyRestaurant">Notify Restaurant</option>
              <option value="assignDriver">Assign Driver</option>
              <option value="trackDelivery">Track Delivery</option>
              <option value="sendReceipt">Send Receipt</option>
            </select>
          </div>
          
          <div className="flex flex-col gap-4">
            <label className="text-2xl font-semibold tracking-wide text-zinc-400 uppercase">Automation</label>
            <label className="flex items-center gap-6 text-2xl cursor-pointer bg-black border border-zinc-700 p-5 rounded-xl transition-colors hover:border-zinc-500">
              <input 
                type="checkbox" 
                className="w-8 h-8 accent-[#0070f3]" 
                checked={autoAck} 
                onChange={e => setAutoAck(e.target.checked)} 
              />
              Auto-ack Hooks
            </label>
          </div>
        </div>

        {/* Saga Visualization */}
        <div className="mt-24 px-10 overflow-x-auto pb-16">
          <div className="relative flex items-start gap-24 min-w-max">
            {/* The background connecting line */}
            <div className="absolute top-[60px] left-[60px] right-[60px] h-[4px] bg-zinc-800 -z-10" />
            
            {steps.map(s => {
              let fill = "transparent";
              let stroke = "#333";
              let textColor = "#fff";
              
              if (s.state === "running") {
                fill = "transparent";
                stroke = "#0070f3"; // Vercel blue
              } else if (s.state === "waiting") {
                fill = "transparent";
                stroke = "#f5a623"; // Yellow
              } else if (s.state === "success") {
                fill = "#fff";
                stroke = "#fff";
                textColor = "#000";
              } else if (s.state === "failed") {
                fill = "#ee0000";
                stroke = "#ee0000";
                textColor = "#fff";
              } else if (s.state === "skipped") {
                fill = "#222";
                stroke = "#222";
                textColor = "#666";
              }

              return (
                <div key={s.id} className="flex flex-col items-center gap-8 relative z-0">
                  <div className="relative w-[120px] h-[120px]">
                    {s.state === "running" && (
                      <svg width="160" height="160" viewBox="0 0 160 160" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-ping opacity-30 -z-10">
                        <polygon points="80,10 150,140 10,140" fill="#0070f3" />
                      </svg>
                    )}
                    <svg width="120" height="120" viewBox="0 0 120 120" className="overflow-visible bg-black rounded-lg">
                      <polygon 
                        points="60,10 110,110 10,110" 
                        fill={fill} 
                        stroke={stroke} 
                        strokeWidth="6" 
                        strokeLinejoin="round" 
                      />
                    </svg>
                  </div>
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-2xl font-medium tracking-wide whitespace-nowrap" style={{ color: textColor }}>
                      {s.label}
                    </span>
                    <span className="text-lg font-mono tracking-widest uppercase text-zinc-500">
                      {s.state}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Manual Hook Controls */}
        {waitToken && !autoAck && (
          <div className="mt-8 mb-8 p-10 border-l-8 border-[#f5a623] bg-[#f5a623]/10 flex flex-col gap-8 rounded-r-2xl">
            <h3 className="text-4xl font-semibold text-[#f5a623]">Action Required: {waitToken.step}</h3>
            <div className="flex gap-8">
              <button 
                onClick={() => resumeHook(getHookKind(waitToken.step), true)}
                className="bg-white text-black px-12 py-5 rounded-xl text-2xl font-bold hover:bg-zinc-200 transition-colors"
              >
                Accept
              </button>
              {waitToken.step !== "trackDelivery" && (
                <button 
                  onClick={() => resumeHook(getHookKind(waitToken.step), false)}
                  className="bg-[#ee0000] text-white px-12 py-5 rounded-xl text-2xl font-bold hover:bg-red-600 transition-colors"
                >
                  Reject
                </button>
              )}
            </div>
          </div>
        )}

        {/* Event Feed */}
        <div className="mt-10 flex flex-col border border-zinc-800 rounded-3xl bg-zinc-950 flex-1 overflow-hidden min-h-[400px]">
          <div className="p-8 border-b border-zinc-800 bg-black/50">
            <h3 className="text-2xl font-bold tracking-widest uppercase text-zinc-500">Event Stream</h3>
          </div>
          <div className={"flex-1 overflow-y-auto p-8 flex flex-col " + geistMono.className}>
            {events.map((e, i) => (
              <div key={i} className="py-4 text-xl flex flex-col md:flex-row md:items-start gap-4 md:gap-8 border-b border-zinc-900/50 last:border-0 hover:bg-white/[0.02] px-4 rounded-lg transition-colors">
                <span className="text-zinc-600 shrink-0 w-36">{(new Date().toISOString().substring(11, 23))}</span>
                <span className="text-zinc-200 break-all leading-relaxed">
                  {formatEvent(e)}
                </span>
              </div>
            ))}
            <div ref={eventsEndRef} />
          </div>
        </div>

      </div>
    </div>
  );
}
