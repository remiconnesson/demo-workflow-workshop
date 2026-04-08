"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Zen_Maru_Gothic, M_PLUS_Rounded_1c } from "next/font/google";
import type { FailStep, OrderEvent, OrderInput, OrderItem } from "@/workflows/place-order";

const zenMaru = Zen_Maru_Gothic({ weight: ["400", "500", "700"], subsets: ["latin"], display: "swap" });
const mPlus = M_PLUS_Rounded_1c({ weight: ["400", "500", "700"], subsets: ["latin"], display: "swap" });

const MENU_DATA = [
  { id: "deployangle", name: "The Deploy-angle 🔺🍩", price: 3.00, subtitle: "おいしい！ Classic Glazed" },
  { id: "edge", name: "Edge Runtime 🔺🌶️", price: 4.00, subtitle: "はやい！ Sharp & Spicy Jalapeño" },
  { id: "coldstart", name: "Cold Start 🔺❄️", price: 3.50, subtitle: "つめたい！ Vanilla Frost Pyramid" },
  { id: "hotmodule", name: "Hot Module 🔺🍫", price: 4.50, subtitle: "あつい！ Molten Choco Core" },
  { id: "serverless", name: "Serverless Sprinkle 🔺🌈", price: 3.50, subtitle: "かわいい！ Rainbow Triangles" },
  { id: "hydration", name: "Hydration Hole 🔺💦", price: 3.00, subtitle: "うるおい！ Refreshing Water-Glaze" },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "Dough Check ✨" },
  { key: "chargePayment", label: "Payment 💖" },
  { key: "notifyRestaurant", label: "Baking Time ♨️" },
  { key: "assignDriver", label: "Courier Found 🛵" },
  { key: "trackDelivery", label: "En Route 🌸" },
  { key: "sendReceipt", label: "Delivered 💌" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Perfect Day! ☀️" },
  { value: "validateOrder", label: "Oops! Dough Check" },
  { value: "chargePayment", label: "Oops! Payment" },
  { value: "notifyRestaurant", label: "Oops! Baking" },
  { value: "assignDriver", label: "Oops! Courier" },
  { value: "sendReceipt", label: "Oops! Receipt" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

function eventColor(type: OrderEvent["type"]): string {
  if (type === "step_failed" || type === "compensating") return "text-[#ff6b9d]";
  if (type === "step_succeeded" || type === "hook_resolved" || type === "compensated")
    return "text-[#62c28d]";
  if (type === "waiting_for_hook") return "text-[#e6a845]";
  if (type === "done") return "text-[#6bb5ff]";
  return "text-[#b096b4]";
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

export default function KawaiiBakeryDemo() {
  const [cart, setCart] = useState<OrderItem[]>(
    MENU_DATA.map((m) => ({ id: m.id, name: m.name, price: m.price, qty: m.id === "deployangle" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Sakura-chan");
  const [address, setAddress] = useState("123 Kawaii Street, Shibuya");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const total = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);

  const updateQty = (id: string, delta: number) => {
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)));
  };

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
  };

  const resume = async (
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

  const handleManualResume = (kind: "restaurant-accept" | "driver-accept" | "delivered", payload: object = {}) => {
    if (currentOrderId) {
      resume(currentOrderId, kind, payload);
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

    const applyEvent = (oId: string, event: OrderEvent) => {
      setEvents((ev) => [...ev, event]);
      switch (event.type) {
        case "step_running":
          setStepStatuses((s) => ({ ...s, [event.step]: "running" }));
          break;
        case "step_succeeded":
        case "hook_resolved":
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
              void resume(oId, kind, kind === "delivered" ? {} : { accepted: true });
            }, 800);
          }
          break;
        }
        case "compensated":
          setCompensations((c) => [...c, event.action]);
          break;
        case "done":
          setResult(event.status);
          break;
      }
    };

    try {
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
            applyEvent(orderId, event);
          } catch {
            // ignore non-json framing lines
          }
        }
      }
    } catch {
      // abort or stream ended
    } finally {
      setRunning(false);
    }
  }, [cart, customerName, address, failAt, autoAck]);

  return (
    <div className={`min-h-screen bg-[#fff7f0] p-4 lg:p-8 ${zenMaru.className} text-zinc-800`}>
      <style dangerouslySetInnerHTML={{ __html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
      
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-black text-[#ff8fb3] tracking-widest drop-shadow-sm">
            🔺 Triangle Donuts 🔺
          </h1>
          <p className={`mt-2 text-[#b096b4] font-bold ${mPlus.className}`}>~ Tokyo Kawaii Café ~</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-10 items-start">
          {/* LEFT COLUMN — phone frame */}
          <div className="relative mx-auto w-full max-w-[380px] shrink-0">
            {/* Stickers */}
            <div className="absolute -top-4 -left-6 text-4xl -rotate-12 z-20 pointer-events-none drop-shadow-md">🐱💤</div>
            <div className="absolute top-20 -right-6 text-4xl rotate-12 z-20 pointer-events-none drop-shadow-md">🎀</div>
            <div className="absolute bottom-32 -left-6 text-4xl -rotate-12 z-20 pointer-events-none drop-shadow-md">🍡</div>
            <div className="absolute -bottom-4 -right-4 text-4xl rotate-12 z-20 pointer-events-none drop-shadow-md">🔺</div>

            {/* Phone Device */}
            <div className="relative w-full h-[800px] rounded-[50px] bg-[#ffd7e0] p-[12px] shadow-2xl">
              {/* Phone Screen */}
              <div className="relative w-full h-full rounded-[38px] bg-[#fff7f0] overflow-hidden flex flex-col">
                {/* Notch */}
                <div className="absolute top-0 inset-x-0 h-6 flex justify-center z-50 pointer-events-none">
                  <div className="w-32 h-5 bg-[#ffd7e0] rounded-b-2xl"></div>
                </div>
                
                {/* Content Area */}
                <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
                  {!currentOrderId ? (
                    <div className="pt-10 px-5 space-y-6">
                      <div className="text-center space-y-1">
                        <h2 className="text-2xl font-black text-[#ff8fb3] tracking-wide">Menu 🍩</h2>
                      </div>

                      <div className="space-y-3">
                        {cart.map((item) => {
                          const meta = MENU_DATA.find((m) => m.id === item.id);
                          return (
                            <div key={item.id} className="bg-white rounded-[20px] p-3 shadow-sm border-2 border-[#ffd7e0] flex items-center justify-between">
                              <div className="flex flex-col">
                                <span className="font-bold text-sm text-zinc-700">{item.name}</span>
                                <span className={`text-[10px] font-bold text-[#b096b4] mt-0.5 ${mPlus.className}`}>{meta?.subtitle}</span>
                                <span className="text-sm font-black text-[#ff8fb3] mt-1">${item.price.toFixed(2)}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-[#faeedd] text-[#ff8fb3] font-black hover:bg-[#ffd7e0] transition-colors shadow-sm pb-0.5">−</button>
                                <span className="w-4 text-center font-bold text-sm text-zinc-700">{item.qty}</span>
                                <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 flex items-center justify-center rounded-full bg-[#ff8fb3] text-white font-black hover:bg-[#ff7aa5] transition-colors shadow-sm pb-0.5">+</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      <div className="bg-white rounded-[20px] p-4 shadow-sm border-2 border-[#c8f0d8] space-y-3">
                        <h3 className="text-sm font-bold text-[#8bd3a6]">Delivery Info 🛵</h3>
                        <input
                          value={customerName}
                          onChange={(e) => setCustomerName(e.target.value)}
                          placeholder="Name"
                          className={`w-full bg-[#f4fcf7] rounded-xl px-3 py-2 text-sm font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-[#8bd3a6] ${mPlus.className}`}
                        />
                        <input
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="Address"
                          className={`w-full bg-[#f4fcf7] rounded-xl px-3 py-2 text-sm font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-[#8bd3a6] ${mPlus.className}`}
                        />
                      </div>

                      <div className="pt-2 pb-6">
                        <button
                          onClick={placeOrder}
                          disabled={running || total === 0}
                          className="w-full bg-[#ff8fb3] hover:bg-[#ff7aa5] text-white rounded-2xl py-4 font-black text-lg shadow-[0_6px_0_#ff4d85] active:shadow-none active:translate-y-[6px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {running ? "Baking..." : `Place Order! ($${total.toFixed(2)}) 💕`}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-14 px-5 space-y-8 flex flex-col items-center min-h-full">
                      <div className="text-center space-y-3 relative w-full">
                        <button onClick={reset} className="absolute -top-8 right-0 text-xs font-bold text-[#b096b4] hover:text-[#ff8fb3] bg-white border-2 border-[#faeedd] px-3 py-1.5 rounded-full shadow-sm transition-colors z-10">Restart ↻</button>
                        
                        <div className="text-6xl mb-2 animate-bounce drop-shadow-md">
                          {result === 'completed' ? '🎉' : result === 'rolled_back' ? '😭' : '🚚'}
                        </div>
                        <h2 className="text-2xl font-black text-zinc-700">
                          {result === 'completed' ? 'YAY! Delivered!' : result === 'rolled_back' ? 'Order Cancelled' : 'On the way!'}
                        </h2>
                        <p className={`text-sm text-[#b096b4] font-bold ${mPlus.className}`}>
                          {result === 'completed' ? 'Enjoy your yummy triangles!' : result === 'rolled_back' ? 'Sorry about that... try again?' : 'Your cute donuts are being prepared...'}
                        </p>
                      </div>

                      <div className="w-full bg-white rounded-3xl p-5 shadow-sm border-4 border-[#faeedd] space-y-5 relative pb-6">
                        {STEPS.map((step) => {
                          const status = stepStatuses[step.key] || 'pending';
                          let icon = '⚪';
                          let textCls = 'text-zinc-400';
                          if (status === 'success') { icon = '💖'; textCls = 'text-[#ff8fb3] font-bold'; }
                          else if (status === 'running') { icon = '✨'; textCls = 'text-[#6bb5ff] font-bold animate-pulse'; }
                          else if (status === 'waiting') { icon = '⏳'; textCls = 'text-[#e6a845] font-bold animate-pulse'; }
                          else if (status === 'failed') { icon = '💔'; textCls = 'text-[#ff6b9d] font-bold'; }
                          else if (status === 'skipped') { icon = '💨'; textCls = 'text-zinc-300'; }

                          return (
                            <div key={step.key} className={`flex items-center gap-4 ${status === 'pending' ? 'opacity-50' : ''} transition-all duration-300 relative z-10`}>
                              <div className="text-2xl w-8 text-center drop-shadow-sm">{icon}</div>
                              <div className="flex-1">
                                <div className={`text-md ${textCls}`}>{step.label}</div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Home indicator */}
                <div className="absolute bottom-2 inset-x-0 flex justify-center pointer-events-none">
                  <div className="w-0 h-0 border-l-[6px] border-r-[6px] border-b-[10px] border-l-transparent border-r-transparent border-b-[#ffd7e0]"></div>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT COLUMN — saga state + feed */}
          <div className="bg-[#faeedd] rounded-[40px] p-6 lg:p-10 shadow-2xl border-8 border-white relative overflow-hidden flex flex-col h-full lg:h-[800px]">
            {/* cute background elements */}
            <div className="absolute top-4 right-8 text-6xl opacity-40 rotate-12 pointer-events-none drop-shadow-md">🌸</div>
            <div className="absolute bottom-10 left-6 text-7xl opacity-30 -rotate-12 pointer-events-none drop-shadow-md">🍙</div>
            <div className="absolute top-1/2 right-12 text-6xl opacity-30 rotate-45 pointer-events-none drop-shadow-md">🍡</div>

            <h2 className="text-2xl font-black text-[#ff8fb3] mb-6 text-center tracking-widest drop-shadow-sm relative z-10">
              Saga Dashboard ✨
            </h2>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 flex-1 relative z-10 min-h-0">
              {/* Left Side of Dashboard: Controls & Feed */}
              <div className="space-y-6 flex flex-col h-full">
                
                <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border-4 border-[#fff7f0] shadow-sm shrink-0">
                  <h3 className="text-md font-black text-[#b096b4] mb-3">Settings ⚙️</h3>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-xs font-bold text-zinc-500 mb-1 block">Test Scenario</span>
                      <select
                        value={failAt ?? "null"}
                        onChange={(e) => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)}
                        className={`w-full bg-[#fdfaf6] rounded-xl px-3 py-2 text-sm border-2 border-[#ffd7e0] font-bold text-zinc-700 outline-none focus:ring-2 focus:ring-[#ff8fb3] ${mPlus.className}`}
                      >
                        {FAIL_OPTIONS.map(o => <option key={String(o.value)} value={o.value ?? "null"}>{o.label}</option>)}
                      </select>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer mt-2 w-fit">
                      <input type="checkbox" checked={autoAck} onChange={e => setAutoAck(e.target.checked)} className="w-5 h-5 rounded accent-[#ff8fb3]" />
                      <span className="text-xs font-bold text-zinc-600">Auto-ack Hooks (Magic! 🪄)</span>
                    </label>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-md rounded-3xl p-5 border-4 border-[#fff7f0] shadow-sm shrink-0">
                  <h3 className="text-md font-black text-[#8bd3a6] mb-3">Manual Hooks 👆</h3>
                  <div className="grid grid-cols-2 gap-2">
                    <button onClick={() => handleManualResume("restaurant-accept", { accepted: true })} className="bg-[#e2f7eb] text-[#3d835b] rounded-xl py-2 text-xs font-bold hover:bg-[#c8f0d8] active:scale-95 transition-all">Kitchen: Accept</button>
                    <button onClick={() => handleManualResume("restaurant-accept", { accepted: false, reason: "No dough" })} className="bg-[#ffe4eb] text-[#c93b69] rounded-xl py-2 text-xs font-bold hover:bg-[#ffd7e0] active:scale-95 transition-all">Kitchen: Reject</button>
                    <button onClick={() => handleManualResume("driver-accept", { accepted: true })} className="bg-[#e2f7eb] text-[#3d835b] rounded-xl py-2 text-xs font-bold hover:bg-[#c8f0d8] active:scale-95 transition-all">Driver: Accept</button>
                    <button onClick={() => handleManualResume("driver-accept", { accepted: false })} className="bg-[#ffe4eb] text-[#c93b69] rounded-xl py-2 text-xs font-bold hover:bg-[#ffd7e0] active:scale-95 transition-all">Driver: Decline</button>
                    <button onClick={() => handleManualResume("delivered")} className="col-span-2 bg-[#f0e6f5] text-[#7a5c88] rounded-xl py-2 text-xs font-bold hover:bg-[#e5d4f0] active:scale-95 transition-all mt-1">Mark Delivered 💌</button>
                  </div>
                </div>

                <div className="bg-white/80 backdrop-blur-md rounded-3xl p-4 border-4 border-[#fff7f0] shadow-sm flex-1 flex flex-col min-h-[150px]">
                  <h3 className="text-md font-black text-[#ffb84d] mb-2 shrink-0">Raw Events 📜</h3>
                  <div className="flex-1 overflow-y-auto bg-[#fdfaf6] rounded-xl p-3 text-[10px] font-mono border-2 border-[#fff7f0] space-y-1.5 no-scrollbar">
                    {events.length === 0 && <div className="text-zinc-400 italic font-sans text-xs">Waiting for orders...</div>}
                    {events.map((e, i) => (
                      <div key={i} className="whitespace-pre-wrap leading-tight break-words">
                        <span className="text-zinc-400">[{new Date().toLocaleTimeString()}]</span>{" "}
                        <span className={eventColor(e.type)}>{e.type}</span>{" "}
                        <span className="text-zinc-600 font-bold">{summarizeEvent(e)}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

              {/* Right Side of Dashboard: Journey Visualization */}
              <div className="bg-white/90 backdrop-blur-md rounded-3xl p-6 border-4 border-[#fff7f0] shadow-sm relative flex flex-col h-full overflow-y-auto no-scrollbar">
                <h3 className="text-lg font-black text-[#ff8fb3] mb-6 text-center shrink-0">Saga Journey 🛤️</h3>
                
                <div className="space-y-4 relative flex-1">
                  {/* Path line connecting steps */}
                  <div className="absolute left-5 top-6 bottom-6 w-1.5 bg-[#faeedd] rounded-full z-0"></div>

                  {STEPS.map((step) => {
                    const status = stepStatuses[step.key] ?? "pending";
                    let icon = "🔺"; 
                    let statusText = "waiting...";
                    let textCls = "text-zinc-400";
                    let boxCls = "bg-[#fdfaf6] border-2 border-[#faeedd] opacity-60";
                    
                    if (status === "running") {
                      icon = "🏃🔺";
                      statusText = "running!";
                      textCls = "text-sky-500 font-black";
                      boxCls = "bg-white border-2 border-sky-300 shadow-md animate-pulse scale-[1.02]";
                    } else if (status === "success") {
                      icon = "✨🔺やった！";
                      statusText = "success!";
                      textCls = "text-emerald-500 font-black";
                      boxCls = "bg-white border-2 border-emerald-300 shadow-sm";
                    } else if (status === "failed") {
                      icon = "😭🔺";
                      statusText = "failed!";
                      textCls = "text-rose-500 font-black";
                      boxCls = "bg-white border-2 border-rose-300 shadow-sm";
                    } else if (status === "skipped") {
                      icon = "💨🔺";
                      statusText = "skipped";
                      textCls = "text-zinc-400 font-bold";
                      boxCls = "bg-[#fdfaf6] border-2 border-zinc-200 opacity-60";
                    } else if (status === "waiting") {
                      icon = "⏳🔺";
                      statusText = "waiting for hook...";
                      textCls = "text-amber-500 font-black";
                      boxCls = "bg-white border-2 border-amber-300 shadow-md animate-pulse scale-[1.02]";
                    }

                    return (
                      <div key={step.key} className="flex items-center gap-4 relative z-10 transition-all duration-500">
                        {/* Milestone Node */}
                        <div className={`w-11 h-11 rounded-full flex items-center justify-center bg-white border-4 ${status !== 'pending' ? 'border-[#ff8fb3]' : 'border-[#faeedd]'} shadow-sm text-lg z-10 transition-colors duration-500 shrink-0`}>
                          {status === 'success' ? '⭐' : status === 'failed' ? '✖' : '🔺'}
                        </div>
                        {/* Milestone Info */}
                        <div className={`flex-1 p-3 rounded-2xl flex items-center justify-between ${boxCls} transition-all duration-500`}>
                          <div className="flex flex-col">
                            <span className={`text-sm ${textCls}`}>{step.label}</span>
                            <span className={`text-[10px] font-bold text-zinc-400 ${mPlus.className}`}>{statusText}</span>
                          </div>
                          <span className="text-sm font-black ml-2 whitespace-nowrap">{icon}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Compensations list if any */}
                {compensations.length > 0 && (
                  <div className="mt-6 rounded-2xl border-2 border-rose-200 bg-[#fff5f7] p-4 animate-fade-in shrink-0">
                    <div className="text-xs font-black text-rose-500 mb-2">Compensations ran 🚨</div>
                    <ul className="text-[11px] text-rose-400 space-y-1 list-disc pl-4 font-mono font-bold">
                      {compensations.map((c, i) => (
                        <li key={i}>{c}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}