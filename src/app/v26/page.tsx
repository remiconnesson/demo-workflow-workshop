"use client";

import React, { useState, useEffect } from "react";
import { Geist, Geist_Mono } from "next/font/google";

const geist = Geist({ subsets: ["latin"] });
const geistMono = Geist_Mono({ subsets: ["latin"] });

type OrderItem = { id: string; name: string; price: number; qty: number };
type FailStep = "validateOrder" | "chargePayment" | "notifyRestaurant" | "assignDriver" | "trackDelivery" | "sendReceipt" | null;
type OrderInput = {
  orderId: string;
  customerName: string;
  address: string;
  items: OrderItem[];
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
  | { type: "compensation_pushed"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver"; forStep: string }
  | { type: "compensating"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver" }
  | { type: "compensated"; action: "refundPayment" | "cancelRestaurantOrder" | "releaseDriver" }
  | { type: "log"; message: string }
  | { type: "done"; status: "completed" | "rolled_back"; orderId: string; compensationOrder: string[] };

const MENU_ITEMS = [
  { id: "deployer", name: "The Deployer", desc: "Classic triangle glazed", price: 4.50 },
  { id: "edge", name: "Edge Runtime", desc: "Cold brew infused triangle", price: 5.00 },
  { id: "coldstart", name: "Cold Start", desc: "Iced powdered triangle", price: 3.50 },
  { id: "hotmodule", name: "Hot Module", desc: "Spicy cinnamon triangle", price: 4.00 },
  { id: "isr", name: "ISR Glaze", desc: "Incremental sugar regenerated", price: 4.50 },
];

const SAGA_STEPS = [
  { id: "validateOrder", label: "VALIDATE ORDER" },
  { id: "chargePayment", label: "CHARGE PAYMENT" },
  { id: "notifyRestaurant", label: "NOTIFY RESTAURANT" },
  { id: "assignDriver", label: "ASSIGN DRIVER" },
  { id: "trackDelivery", label: "TRACK DELIVERY" },
  { id: "sendReceipt", label: "SEND RECEIPT" },
];

const genId = () => Math.random().toString(36).substring(2, 9).toUpperCase();

export default function V26Page() {
  const [cart, setCart] = useState<{ [id: string]: number }>({ deployer: 2 });
  const [customerName, setCustomerName] = useState("Guillermo R.");
  const [address, setAddress] = useState("Vercel HQ");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(false);
  const [isOrdering, setIsOrdering] = useState(false);

  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [orderId, setOrderId] = useState<string | null>(null);

  const activeHooks = events.filter((e) => e.type === "waiting_for_hook") as { type: "waiting_for_hook"; step: string; token: string; label: string }[];
  const resolvedHooks = events.filter((e) => e.type === "hook_resolved") as { type: "hook_resolved"; step: string; token: string }[];
  const pendingHooks = activeHooks.filter((ah) => !resolvedHooks.some((rh) => rh.step === ah.step));

  const getStepStatus = (stepId: string) => {
    const stepEvents = events.filter((e) => "step" in e && (e as any).step === stepId);
    const isFailed = stepEvents.some((e) => e.type === "step_failed");
    const isSuccess = stepEvents.some((e) => e.type === "step_succeeded");
    const isSkipped = stepEvents.some((e) => e.type === "step_skipped");
    const isWaiting = pendingHooks.some((h) => h.step === stepId);
    const isRunning = stepEvents.some((e) => e.type === "step_running") && !isFailed && !isSuccess && !isWaiting && !isSkipped;
    const isRolledBack = events.some((e) => e.type === "compensated" && (
      (e.action === "refundPayment" && stepId === "chargePayment") ||
      (e.action === "cancelRestaurantOrder" && stepId === "notifyRestaurant") ||
      (e.action === "releaseDriver" && stepId === "assignDriver")
    ));

    if (isRolledBack) return "ROLLED_BACK";
    if (isFailed) return "FAILED";
    if (isSkipped) return "SKIPPED";
    if (isWaiting) return "WAITING";
    if (isSuccess) return "SUCCESS";
    if (isRunning) return "RUNNING";
    return "PENDING";
  };

  const doneEvent = events.find((e) => e.type === "done") as { type: "done"; status: string; compensationOrder: string[] } | undefined;

  useEffect(() => {
    if (!autoAck) return;
    const p = pendingHooks[0];
    if (!p) return;
    const timer = setTimeout(() => {
      let kind = "";
      if (p.step === "notifyRestaurant") kind = "restaurant-accept";
      if (p.step === "assignDriver") kind = "driver-accept";
      if (p.step === "trackDelivery") kind = "delivered";
      if (kind) {
        resumeHook(kind, true);
      }
    }, 1200);
    return () => clearTimeout(timer);
  }, [pendingHooks, autoAck, orderId]);

  const resumeHook = async (kind: string, accepted: boolean) => {
    if (!orderId) return;
    await fetch(`/api/orders/${orderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, accepted, reason: accepted ? undefined : "Declined manually" })
    });
  };

  const updateCart = (id: string, delta: number) => {
    setCart(prev => {
      const v = (prev[id] || 0) + delta;
      if (v <= 0) {
        const next = { ...prev };
        delete next[id];
        return next;
      }
      return { ...prev, [id]: v };
    });
  };

  const totalPrice = MENU_ITEMS.reduce((sum, item) => sum + (cart[item.id] || 0) * item.price, 0);

  const placeOrder = async () => {
    setIsOrdering(true);
    setEvents([]);
    const id = "ORD-" + genId();
    setOrderId(id);

    const items: OrderItem[] = MENU_ITEMS.filter(m => cart[m.id]).map(m => ({
      id: m.id,
      name: m.name,
      price: m.price,
      qty: cart[m.id]
    }));

    const input: OrderInput = {
      orderId: id,
      customerName,
      address,
      items,
      failAt: failAt || undefined,
      autoAck
    };

    try {
      const res = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const data = await res.json();
      
      const streamRes = await fetch(`/api/runs/${data.runId}/stream`);
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
            try {
              const ev = JSON.parse(line) as OrderEvent;
              setEvents(prev => [...prev, ev]);
            } catch (e) {}
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsOrdering(false);
    }
  };

  const resetDemo = () => {
    setOrderId(null);
    setEvents([]);
  };

  return (
    <main className={`${geist.className} min-h-screen bg-white text-black flex flex-col xl:flex-row max-w-[1920px] mx-auto overflow-hidden selection:bg-black selection:text-white`}>
      
      {/* DECORATIVE SAGA TEXT */}
      <div className="absolute top-0 right-0 pointer-events-none select-none opacity-[0.03] z-0 flex items-start justify-end h-screen w-full overflow-hidden">
        <span className="text-[350px] font-bold leading-[0.80] tracking-tighter text-right mt-10 mr-[-20px]">SAGA<br/>DEMO</span>
      </div>

      {/* LEFT COLUMN: PHONE */}
      <div className="xl:w-[800px] flex items-center justify-center p-12 shrink-0 z-10 min-h-screen bg-black">
        <div className="w-[560px] h-[1100px] bg-black border-[12px] border-black shadow-[48px_48px_0_#fff] flex flex-col relative overflow-hidden">
          <div className="w-full h-full bg-white flex flex-col relative overflow-hidden">
            {orderId ? (
              // TRACKING VIEW
              <div className="flex-1 flex flex-col bg-white overflow-y-auto">
                <div className="p-10 bg-black text-white shrink-0">
                  <h3 className="text-5xl font-bold mb-4 tracking-tight">ORDER STATUS</h3>
                  <div className="text-3xl font-mono font-bold text-gray-400">ID: {orderId}</div>
                </div>
                <div className="p-10 flex-1 flex flex-col gap-10 relative">
                  <div className="absolute left-[3.25rem] top-10 bottom-10 w-2 bg-gray-200"></div>
                  {SAGA_STEPS.map(step => {
                    const status = getStepStatus(step.id);
                    let dotBg = "bg-white border-8 border-gray-200";
                    let textClass = "text-gray-400";
                    let statusText = "PENDING";

                    if (status === "RUNNING" || status === "WAITING") {
                      dotBg = "bg-black border-8 border-black";
                      textClass = "text-black font-bold";
                      statusText = "IN PROGRESS";
                    } else if (status === "SUCCESS") {
                      dotBg = "bg-black border-8 border-black";
                      textClass = "text-black font-bold";
                      statusText = "COMPLETED";
                    } else if (status === "FAILED") {
                      dotBg = "bg-red-600 border-8 border-red-600";
                      textClass = "text-red-600 font-bold";
                      statusText = "FAILED";
                    } else if (status === "ROLLED_BACK") {
                      dotBg = "bg-white border-8 border-red-600";
                      textClass = "text-red-600 line-through opacity-50";
                      statusText = "CANCELLED";
                    } else if (status === "SKIPPED") {
                      dotBg = "bg-gray-100 border-8 border-gray-200";
                      textClass = "text-gray-400";
                      statusText = "SKIPPED";
                    }

                    return (
                      <div key={step.id} className="flex gap-8 items-center relative z-10">
                        <div className={`w-16 h-16 rounded-full flex-shrink-0 transition-colors duration-500 ${dotBg}`}></div>
                        <div>
                          <div className={`text-4xl tracking-tight transition-colors duration-500 ${textClass}`}>{step.label}</div>
                          <div className={`text-2xl mt-1 font-bold ${status === 'RUNNING' || status === 'WAITING' ? 'text-black' : 'text-gray-400'}`}>
                            {statusText}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {doneEvent && (
                  <div className="p-10 shrink-0 bg-gray-100 border-t-8 border-black">
                    <h4 className={`text-4xl font-bold mb-4 ${doneEvent.status === 'completed' ? 'text-black' : 'text-red-600'}`}>
                      {doneEvent.status === 'completed' ? 'ORDER COMPLETE' : 'ORDER FAILED'}
                    </h4>
                    <p className="text-2xl text-gray-600 mb-8 font-medium">
                      {doneEvent.status === 'completed' ? 'Your triangle donuts are out for delivery!' : 'We encountered an error. You have been fully refunded.'}
                    </p>
                    <button onClick={resetDemo} className="w-full bg-black text-white px-8 py-6 text-3xl font-bold uppercase tracking-widest hover:bg-gray-800 transition-colors">
                      START NEW ORDER
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // MENU VIEW
              <div className="flex-1 flex flex-col h-full">
                <div className="bg-black text-white p-10 pb-16 flex flex-col items-center justify-center relative overflow-hidden shrink-0">
                  {/* CSS Triangle Motif */}
                  <div className="absolute w-0 h-0 border-l-[150px] border-l-transparent border-r-[150px] border-r-transparent border-b-[260px] border-b-white opacity-10 top-[-50px] right-[-50px] rotate-45" />
                  <h2 className="text-[70px] font-bold tracking-tighter mt-4 z-10 text-center leading-[0.9]">TRIANGLE<br/>DONUTS</h2>
                </div>

                <div className="p-10 flex-1 flex flex-col gap-10 bg-white overflow-y-auto">
                  {MENU_ITEMS.map(item => (
                    <div key={item.id} className="flex justify-between items-center border-b-4 border-black pb-8">
                      <div className="flex-1 pr-4">
                        <h3 className="text-4xl font-bold tracking-tight mb-2">{item.name}</h3>
                        <p className="text-2xl text-gray-500 font-medium leading-snug">{item.desc}</p>
                        <div className="text-4xl font-mono font-bold mt-4">${item.price.toFixed(2)}</div>
                      </div>
                      <div className="flex items-center gap-0 border-4 border-black overflow-hidden shrink-0">
                        <button onClick={() => updateCart(item.id, -1)} className="w-16 h-16 flex items-center justify-center text-4xl bg-white hover:bg-gray-200 transition-colors font-mono font-bold border-r-4 border-black">-</button>
                        <span className="w-16 text-center text-3xl font-bold bg-gray-50 h-16 flex items-center justify-center">{cart[item.id] || 0}</span>
                        <button onClick={() => updateCart(item.id, 1)} className="w-16 h-16 flex items-center justify-center text-4xl bg-black text-white hover:bg-gray-800 transition-colors font-mono font-bold border-l-4 border-black">+</button>
                      </div>
                    </div>
                  ))}
                  
                  <div className="mt-4 flex flex-col gap-8">
                    <input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer Name" className="text-3xl font-bold border-b-8 border-black px-2 py-6 focus:outline-none placeholder:text-gray-300 transition-colors focus:border-gray-500" />
                    <input type="text" value={address} onChange={e => setAddress(e.target.value)} placeholder="Delivery Address" className="text-3xl font-bold border-b-8 border-black px-2 py-6 focus:outline-none placeholder:text-gray-300 transition-colors focus:border-gray-500" />
                  </div>
                </div>

                <div className="bg-black p-10 shrink-0">
                  <div className="flex justify-between text-white text-4xl mb-8 font-mono font-bold">
                    <span>TOTAL</span>
                    <span>${totalPrice.toFixed(2)}</span>
                  </div>
                  <button onClick={placeOrder} disabled={isOrdering || totalPrice === 0} className="w-full bg-white text-black text-4xl font-bold py-8 uppercase tracking-widest hover:bg-gray-200 disabled:opacity-80 transition-colors">
                    {isOrdering ? "PROCESSING..." : "PLACE ORDER"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: DASHBOARD */}
      <div className="flex-1 flex flex-col pt-16 px-16 z-10 h-screen relative bg-white">
        <div className="flex justify-between items-start mb-16 shrink-0">
          <div>
            <h1 className="text-[80px] leading-[0.9] font-bold tracking-tighter mb-4">ORCHESTRATOR</h1>
            <p className="text-3xl font-bold text-gray-500 uppercase tracking-widest">Saga Execution DevTools</p>
          </div>
          <div className="flex gap-10 items-end">
            <div className="flex flex-col gap-4">
              <label className="text-2xl font-bold tracking-widest uppercase">Fail At Step</label>
              <select className="border-4 border-black px-6 py-4 text-2xl font-bold bg-white focus:outline-none cursor-pointer" value={failAt || ""} onChange={e => setFailAt(e.target.value as FailStep || null)}>
                <option value="">-- None (Success) --</option>
                {SAGA_STEPS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-4">
              <label className="text-2xl font-bold tracking-widest uppercase">Auto Ack</label>
              <button onClick={() => setAutoAck(!autoAck)} className={`border-4 border-black px-8 py-4 text-2xl font-bold tracking-widest uppercase transition-colors ${autoAck ? 'bg-black text-white' : 'bg-white text-black hover:bg-gray-100'}`}>
                {autoAck ? 'ON' : 'OFF'}
              </button>
            </div>
          </div>
        </div>

        {/* VERTICAL SAGA STEPS */}
        <div className="flex-1 flex flex-col gap-6 overflow-y-auto pb-48 pr-4">
          {SAGA_STEPS.map((step, i) => {
            const status = getStepStatus(step.id);
            let bg = "bg-white border-4 border-gray-200 text-gray-300";
            let numClass = "text-transparent [-webkit-text-stroke:2px_#e5e7eb]";
            let statusColor = "text-gray-400";
            let lineThrough = false;

            if (status === "RUNNING") {
              bg = "bg-black text-white border-4 border-black";
              numClass = "text-transparent [-webkit-text-stroke:2px_#4b5563]";
              statusColor = "text-gray-400";
            } else if (status === "WAITING") {
              bg = "bg-white text-black border-8 border-black border-dashed";
              numClass = "text-transparent [-webkit-text-stroke:3px_#000]";
              statusColor = "text-black animate-pulse";
            } else if (status === "SUCCESS") {
              bg = "bg-white border-4 border-black text-black";
              numClass = "text-transparent [-webkit-text-stroke:3px_#000]";
              statusColor = "text-black";
            } else if (status === "FAILED") {
              bg = "bg-red-600 text-white border-4 border-red-600";
              numClass = "text-transparent [-webkit-text-stroke:2px_#fca5a5]";
              statusColor = "text-red-200";
            } else if (status === "ROLLED_BACK") {
              bg = "bg-gray-100 border-4 border-gray-300 text-gray-400";
              numClass = "text-transparent [-webkit-text-stroke:3px_#d1d5db]";
              statusColor = "text-red-600";
              lineThrough = true;
            } else if (status === "SKIPPED") {
              bg = "bg-gray-50 border-4 border-dashed border-gray-200 text-gray-300";
            }

            return (
              <div key={step.id} className={`h-[160px] flex items-center px-12 transition-all duration-500 relative overflow-hidden shrink-0 ${bg}`}>
                <div className={`text-[130px] font-bold italic mr-12 leading-[0.8] mt-4 tracking-tighter ${numClass}`}>
                  0{i + 1}
                </div>
                <div className="flex flex-col z-10 mt-2">
                  <div className={`text-5xl font-bold tracking-tight uppercase ${lineThrough ? 'line-through decoration-red-600 decoration-8' : ''}`}>
                    {step.label}
                  </div>
                  <div className={`text-3xl mt-2 tracking-widest font-bold ${statusColor}`}>
                    {status}
                  </div>
                </div>
                
                {/* Hook Controls */}
                {status === "WAITING" && pendingHooks.find(h => h.step === step.id) && (
                  <div className="ml-auto flex gap-6">
                    {step.id === "notifyRestaurant" && (
                      <>
                        <button onClick={() => resumeHook("restaurant-accept", true)} className="bg-black text-white border-4 border-black px-10 py-5 text-2xl font-bold hover:bg-gray-800 transition-colors uppercase tracking-widest">Accept</button>
                        <button onClick={() => resumeHook("restaurant-accept", false)} className="bg-red-600 text-white border-4 border-red-600 px-10 py-5 text-2xl font-bold hover:bg-red-700 transition-colors uppercase tracking-widest">Reject</button>
                      </>
                    )}
                    {step.id === "assignDriver" && (
                      <>
                        <button onClick={() => resumeHook("driver-accept", true)} className="bg-black text-white border-4 border-black px-10 py-5 text-2xl font-bold hover:bg-gray-800 transition-colors uppercase tracking-widest">Accept</button>
                        <button onClick={() => resumeHook("driver-accept", false)} className="bg-red-600 text-white border-4 border-red-600 px-10 py-5 text-2xl font-bold hover:bg-red-700 transition-colors uppercase tracking-widest">Reject</button>
                      </>
                    )}
                    {step.id === "trackDelivery" && (
                      <button onClick={() => resumeHook("delivered", true)} className="bg-black text-white border-4 border-black px-10 py-5 text-2xl font-bold hover:bg-gray-800 transition-colors uppercase tracking-widest">Delivered</button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* BOTTOM TICKER */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-black text-white flex items-center px-16 z-20 border-t-8 border-white">
          <div className={`text-3xl ${geistMono.className} truncate flex-1 font-bold`}>
            <span className="text-yellow-400 mr-8">[{events.length > 0 ? events[events.length - 1].type.toUpperCase() : 'WAITING'}]</span>
            {events.length > 0 ? JSON.stringify(events[events.length - 1]) : "AWAITING SAGA INVOCATION..."}
          </div>
          <div className="text-3xl font-bold ml-12 text-gray-500 shrink-0 tracking-widest">
            {events.length > 1 ? `(+${events.length - 1} MORE)` : ''}
          </div>
        </div>
      </div>
    </main>
  );
}
