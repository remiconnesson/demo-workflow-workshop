"use client";

import React, { useState, useEffect, useRef } from "react";
import { Fraunces, Karla } from "next/font/google";
type IconProps = { size?: number; strokeWidth?: number; className?: string };
const makeIcon = (d: string) => ({ size = 16, strokeWidth = 2, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d={d} />
  </svg>
);
const Plus = makeIcon("M12 5v14M5 12h14");
const Minus = makeIcon("M5 12h14");
const Check = makeIcon("M20 6L9 17l-5-5");
const X = makeIcon("M18 6L6 18M6 6l12 12");
const AlertTriangle = ({ size = 16, className }: IconProps) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className}>
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces" });
const karla = Karla({ subsets: ["latin"], variable: "--font-karla" });

type OrderItem = { id: string; name: string; price: number; qty: number; desc: string };
type FailStep = "validateOrder" | "chargePayment" | "notifyRestaurant" | "assignDriver" | "trackDelivery" | "sendReceipt" | null;

type OrderEvent =
  | { type: "step_running"; step: string; label: string }
  | { type: "step_succeeded"; step: string; label: string; detail?: string }
  | { type: "step_failed"; step: string; label: string; error: string }
  | { type: "step_skipped"; step: string; label: string }
  | { type: "waiting_for_hook"; step: string; token: string; label: string }
  | { type: "hook_resolved"; step: string; token: string; detail?: string }
  | { type: "compensation_pushed"; action: string; forStep: string }
  | { type: "compensating"; action: string }
  | { type: "compensated"; action: string }
  | { type: "log"; message: string }
  | { type: "done"; status: "completed" | "rolled_back"; orderId: string; compensationOrder: string[] };

const MENU: OrderItem[] = [
  { id: "d1", name: "The Deployer", desc: "Classic triangle-cut glazed", price: 3.5, qty: 0 },
  { id: "d2", name: "Edge Runtime", desc: "Spicy jalapeño glaze", price: 4.0, qty: 0 },
  { id: "d3", name: "Cold Start", desc: "Vanilla frost triangle", price: 3.8, qty: 0 },
  { id: "d4", name: "Hot Module", desc: "Molten chocolate core", price: 4.5, qty: 0 },
  { id: "d5", name: "Serverless Sprinkle", desc: "Rainbow triangles", price: 4.2, qty: 0 },
  { id: "d6", name: "Hydration Hole", desc: "Water-glazed ring cut", price: 3.5, qty: 0 },
];

const STEPS = [
  { id: "validateOrder", label: "Dough check" },
  { id: "chargePayment", label: "Payment" },
  { id: "notifyRestaurant", label: "Baking" },
  { id: "assignDriver", label: "Courier dispatch" },
  { id: "trackDelivery", label: "En route" },
  { id: "sendReceipt", label: "Delivered" },
];

export default function PapercraftDonutsDemo() {
  const [cart, setCart] = useState<OrderItem[]>(MENU);
  const [customerName, setCustomerName] = useState("Alice Paper");
  const [address, setAddress] = useState("123 Folded Ave");
  
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState<boolean>(true);
  
  const [orderId, setOrderId] = useState<string | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [status, setStatus] = useState<"idle" | "running" | "completed" | "rolled_back">("idle");
  
  const eventsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [events]);

  useEffect(() => {
    if (!autoAck || !orderId || status === "completed" || status === "rolled_back") return;
    const lastEvent = events[events.length - 1];
    if (lastEvent?.type === "waiting_for_hook") {
      const timer = setTimeout(() => {
        let kind = "";
        let accepted = true;
        if (lastEvent.step === "notifyRestaurant") kind = "restaurant-accept";
        else if (lastEvent.step === "assignDriver") kind = "driver-accept";
        else if (lastEvent.step === "trackDelivery") kind = "delivered";
        
        if (kind) {
          fetch(`/api/orders/${orderId}/resume`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ kind, accepted })
          }).catch(console.error);
        }
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [events, autoAck, orderId, status]);

  const updateQty = (id: string, delta: number) => {
    setCart(cart.map(item => item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item));
  };

  const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
  const totalPrice = cart.reduce((sum, item) => sum + (item.price * item.qty), 0);

  const handlePlaceOrder = async () => {
    if (totalItems === 0) return;
    setEvents([]);
    setStatus("running");
    
    const itemsToOrder = cart.filter(i => i.qty > 0);
    const newOrderId = `ORD-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    setOrderId(newOrderId);

    try {
      const res = await fetch("/api/orders/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId: newOrderId,
          customerName,
          address,
          items: itemsToOrder,
          failAt,
          autoAck
        })
      });
      const data = await res.json();
      setRunId(data.runId);

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
          if (!line.trim()) continue;
          try {
            const event = JSON.parse(line) as OrderEvent;
            setEvents(prev => [...prev, event]);
            if (event.type === "done") {
              setStatus(event.status);
            }
          } catch (e) {
            console.error("Failed to parse event", line);
          }
        }
      }
    } catch (error) {
      console.error(error);
      setStatus("rolled_back");
    }
  };

  const resetOrder = () => {
    setOrderId(null);
    setRunId(null);
    setEvents([]);
    setStatus("idle");
    setCart(MENU);
  };

  const manualHook = async (kind: string, accepted: boolean = true) => {
    if (!orderId) return;
    await fetch(`/api/orders/${orderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, accepted })
    });
  };

  const getStepState = (stepId: string) => {
    const isFailed = events.some(e => e.type === "step_failed" && e.step === stepId);
    if (isFailed) return "failed";
    const isSuccess = events.some(e => e.type === "step_succeeded" && e.step === stepId);
    if (isSuccess) return "success";
    const isSkipped = events.some(e => e.type === "step_skipped" && e.step === stepId);
    if (isSkipped) return "skipped";
    const isWaiting = events.some(e => e.type === "waiting_for_hook" && e.step === stepId) &&
                      !events.some(e => e.type === "hook_resolved" && e.step === stepId);
    if (isWaiting) return "waiting";
    const isRunning = events.some(e => e.type === "step_running" && e.step === stepId);
    if (isRunning) return "running";
    return "pending";
  };

  const getStepColor = (state: string) => {
    switch (state) {
      case "success": return "#9bb796";
      case "failed": return "#c24e4e";
      case "running": return "#e5dcd3";
      case "waiting": return "#e5dcd3";
      case "skipped": return "#d1c7bd";
      default: return "#c48b5a";
    }
  };

  const renderEventLog = (e: OrderEvent) => {
    let details = "";
    if ("step" in e) details += ` [${e.step}]`;
    if ("action" in e) details += ` [${e.action}]`;
    if ("error" in e) details += ` ERR: ${e.error}`;
    
    const colorClass = (e.type.includes('failed') || e.type.includes('compensat')) ? 'text-[#c24e4e]' : 
                       (e.type.includes('succeeded') || e.type === 'hook_resolved' || e.type === 'done') ? 'text-[#9bb796]' : '';
                       
    return (
      <span className={colorClass}>
        {e.type}{details}
      </span>
    );
  };

  const renderPhoneView = () => {
    if (status === "idle") {
      return (
        <div className="flex flex-col h-full bg-[#fef9f1] p-4 text-[#1a1a1a] relative">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h20v20H0z\' fill=\'none\'/%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'1\' fill=\'%23000\'/%3E%3C/svg%3E")' }}></div>
          <div className="text-center mb-6 z-10 relative mt-4">
            <div className="flex justify-center mb-2">
              <svg width="40" height="40" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M50 10L90 85H10L50 10Z" fill="#1a1a1a" stroke="#c48b5a" strokeWidth="4" strokeLinejoin="round"/>
                <path d="M50 10V85" stroke="#fef9f1" strokeWidth="2" opacity="0.5"/>
              </svg>
            </div>
            <h2 className="font-fraunces text-2xl font-bold tracking-tight">Triangle Donuts</h2>
            <p className="text-xs uppercase tracking-widest text-[#c48b5a] mt-1">Folded to perfection</p>
          </div>
          
          <div className="flex-1 overflow-y-auto pb-24 z-10 space-y-4">
            {cart.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 bg-white border-2 border-[#e5dcd3] relative rounded-sm shadow-[2px_2px_0_#e5dcd3]">
                <div className="absolute top-0 left-0 w-0 h-0 border-t-8 border-r-8 border-t-transparent border-r-[#c48b5a]/30"></div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#fef9f1] border border-[#c48b5a] flex items-center justify-center transform rotate-3 relative overflow-hidden">
                    <div className="w-0 h-0 border-l-[10px] border-r-[10px] border-b-[18px] border-transparent border-b-[#c48b5a]"></div>
                    <div className="absolute left-1/2 top-0 bottom-0 w-px bg-black/10 -translate-x-1/2"></div>
                  </div>
                  <div>
                    <h3 className="font-fraunces font-semibold text-sm leading-none">{item.name}</h3>
                    <p className="text-[10px] text-gray-500 mt-1">{item.desc}</p>
                    <p className="text-xs font-bold mt-1 text-[#9bb796]">${item.price.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2 bg-[#fef9f1] rounded-full px-2 py-1 border border-[#e5dcd3]">
                  <button onClick={() => updateQty(item.id, -1)} className="p-1 hover:bg-[#e5dcd3] rounded-full transition-colors"><Minus size={12} /></button>
                  <span className="text-xs font-bold w-4 text-center">{item.qty}</span>
                  <button onClick={() => updateQty(item.id, 1)} className="p-1 hover:bg-[#e5dcd3] rounded-full transition-colors"><Plus size={12} /></button>
                </div>
              </div>
            ))}
          </div>

          {totalItems > 0 && (
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#fef9f1] via-[#fef9f1] to-transparent z-20">
              <button 
                onClick={handlePlaceOrder}
                className="w-full bg-[#1a1a1a] text-[#fef9f1] py-4 rounded-sm font-fraunces font-bold text-lg flex items-center justify-between px-6 shadow-[4px_4px_0_#c48b5a] active:shadow-[1px_1px_0_#c48b5a] active:translate-x-[3px] active:translate-y-[3px] transition-all"
              >
                <span>Checkout</span>
                <span>${totalPrice.toFixed(2)}</span>
              </button>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full bg-[#fef9f1] text-[#1a1a1a] relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'20\' height=\'20\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cpath d=\'M0 0h20v20H0z\' fill=\'none\'/%3E%3Ccircle cx=\'2\' cy=\'2\' r=\'1\' fill=\'%23000\'/%3E%3C/svg%3E")' }}></div>
        
        <div className="p-6 bg-white border-b-2 border-[#e5dcd3] shadow-sm z-10 relative">
          <div className="absolute top-0 right-0 w-6 h-6 border-b-2 border-l-2 border-[#e5dcd3] bg-[#fef9f1]" style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}></div>
          <h2 className="font-fraunces text-xl font-bold">Order Tracking</h2>
          <p className="text-xs text-gray-500 font-mono mt-1 border-b border-dashed border-[#c48b5a] inline-block pb-1">ID: {orderId}</p>
        </div>

        <div className="flex-1 p-6 z-10 overflow-y-auto">
          <div className="relative pl-6 space-y-8">
            <div className="absolute left-[11px] top-4 bottom-8 w-px bg-dashed border-l-2 border-dashed border-[#c48b5a]/40"></div>
            
            {STEPS.map((step, idx) => {
              const state = getStepState(step.id);
              const isActive = state === "running" || state === "waiting";
              const isDone = state === "success";
              const isErr = state === "failed";
              
              return (
                <div key={step.id} className="relative">
                  <div className={`absolute -left-[32px] w-7 h-7 rounded-full border-2 bg-white flex items-center justify-center
                    ${isActive ? 'border-[#c48b5a] shadow-[0_0_0_2px_#fef9f1,0_0_0_4px_#c48b5a]' : ''}
                    ${isDone ? 'border-[#9bb796] bg-[#9bb796]' : ''}
                    ${isErr ? 'border-[#c24e4e] bg-[#c24e4e]' : ''}
                    ${state === 'pending' || state === 'skipped' ? 'border-[#e5dcd3]' : ''}
                    transition-all duration-300 z-10`}
                  >
                    {isDone && <Check size={14} className="text-white" />}
                    {isErr && <X size={14} className="text-white" />}
                    {isActive && <div className="w-2.5 h-2.5 rounded-full bg-[#c48b5a] animate-pulse"></div>}
                  </div>
                  
                  <div className={`transition-opacity duration-300 ${state === 'pending' || state === 'skipped' ? 'opacity-40' : 'opacity-100'} bg-white border border-[#e5dcd3] p-3 rounded-sm shadow-sm relative ml-2`}>
                    <div className="absolute left-0 top-1/2 -translate-x-full -translate-y-1/2 w-0 h-0 border-y-4 border-r-4 border-y-transparent border-r-white"></div>
                    <h4 className="font-fraunces font-bold text-sm">{step.label}</h4>
                    <p className="text-[11px] text-gray-500 font-mono mt-1">
                      {isActive ? 'IN_PROGRESS' : isDone ? 'COMPLETED' : isErr ? 'ERROR' : 'WAITING'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>

          {(status === "completed" || status === "rolled_back") && (
            <div className="mt-10 text-center relative z-20 pb-4">
              <button 
                onClick={resetOrder}
                className="px-6 py-3 bg-[#c48b5a] text-white font-bold text-sm uppercase tracking-wider hover:bg-[#1a1a1a] transition-colors rounded-sm shadow-[4px_4px_0_#1a1a1a]"
              >
                Order Again
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className={`${fraunces.variable} ${karla.variable} min-h-screen bg-[#fef9f1] font-karla text-[#1a1a1a] flex flex-col lg:flex-row p-4 lg:p-8 gap-8 lg:gap-12 overflow-x-hidden relative`}>
      <div className="fixed inset-0 pointer-events-none opacity-20 mix-blend-multiply" style={{ backgroundImage: 'radial-gradient(#c48b5a 0.5px, transparent 0.5px)', backgroundSize: '16px 16px' }}></div>
      
      {/* LEFT: Phone Mockup */}
      <div className="w-full lg:w-[400px] shrink-0 flex flex-col items-center z-10 relative">
        <div className="text-center mb-6">
          <h1 className="font-fraunces text-3xl font-black text-[#1a1a1a] tracking-tighter uppercase drop-shadow-[2px_2px_0_#c48b5a]">Customer</h1>
        </div>
        
        {/* Paper Phone Frame */}
        <div className="w-full max-w-[400px] h-[820px] bg-[#e5dcd3] rounded-[3.5rem] p-3.5 shadow-[20px_20px_50px_rgba(0,0,0,0.15),_inset_6px_6px_15px_rgba(255,255,255,0.9),_inset_-6px_-6px_15px_rgba(0,0,0,0.05)] border-2 border-[#d1c7bd] relative perspective-[1000px] transform rotate-1">
          {/* Sticker tab */}
          <div className="absolute -top-4 -right-3 w-14 h-14 bg-[#c24e4e] transform rotate-12 shadow-[2px_4px_6px_rgba(0,0,0,0.2)] z-30 flex items-center justify-center border-2 border-white" style={{ clipPath: 'polygon(0% 0%, 100% 0%, 50% 100%)' }}>
            <span className="text-[9px] font-black text-white transform -translate-y-1 tracking-widest">TAP</span>
            {/* Sticker fold */}
            <div className="absolute top-0 right-0 w-4 h-4 bg-white/20" style={{ clipPath: 'polygon(100% 0, 0 100%, 100% 100%)' }}></div>
          </div>

          <div className="w-full h-full bg-[#1a1a1a] rounded-[3rem] p-2 shadow-inner relative overflow-hidden">
            {/* Screen Content */}
            <div className="w-full h-full bg-white rounded-[2.5rem] overflow-hidden relative border border-[#1a1a1a]">
              {/* Dynamic Island Notch */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-black rounded-full z-50"></div>
              
              {renderPhoneView()}
            </div>
            
            {/* Glare effect */}
            <div className="absolute inset-0 rounded-[3rem] bg-gradient-to-tr from-white/0 via-white/5 to-white/20 pointer-events-none"></div>
          </div>
        </div>
      </div>

      {/* RIGHT: Dashboard */}
      <div className="flex-1 flex flex-col gap-6 z-10 max-w-4xl pt-2">
        <div className="text-left mb-2 flex items-baseline gap-4">
          <h1 className="font-fraunces text-3xl font-black text-[#1a1a1a] tracking-tighter uppercase drop-shadow-[2px_2px_0_#9bb796]">Control Panel</h1>
          <p className="font-mono text-xs font-bold bg-[#c48b5a] text-white px-2 py-1 uppercase rounded-sm">Saga DevTools</p>
        </div>

        {/* Top Controls */}
        <div className="bg-white border-2 border-[#1a1a1a] p-5 flex flex-wrap gap-6 items-center shadow-[6px_6px_0_#1a1a1a] relative">
          <div className="absolute -top-3 -left-3 w-6 h-6 bg-[#fef9f1] border-2 border-[#1a1a1a] rounded-full flex items-center justify-center shadow-sm"><div className="w-2 h-2 bg-[#1a1a1a] rounded-full"></div></div>
          <div className="absolute -top-3 -right-3 w-6 h-6 bg-[#fef9f1] border-2 border-[#1a1a1a] rounded-full flex items-center justify-center shadow-sm"><div className="w-2 h-2 bg-[#1a1a1a] rounded-full"></div></div>
          <div className="absolute -bottom-3 -left-3 w-6 h-6 bg-[#fef9f1] border-2 border-[#1a1a1a] rounded-full flex items-center justify-center shadow-sm"><div className="w-2 h-2 bg-[#1a1a1a] rounded-full"></div></div>
          <div className="absolute -bottom-3 -right-3 w-6 h-6 bg-[#fef9f1] border-2 border-[#1a1a1a] rounded-full flex items-center justify-center shadow-sm"><div className="w-2 h-2 bg-[#1a1a1a] rounded-full"></div></div>
          
          <div className="flex items-center gap-3">
            <label className="font-bold text-sm uppercase tracking-wide">Inject Error At:</label>
            <select 
              value={failAt || ""} 
              onChange={e => setFailAt((e.target.value as FailStep) || null)}
              className="border-2 border-[#c48b5a] bg-[#fef9f1] font-mono text-sm p-1.5 outline-none focus:border-[#1a1a1a] rounded-none shadow-[2px_2px_0_#c48b5a]"
              disabled={status === "running"}
            >
              <option value="">-- None (Success) --</option>
              {STEPS.map(s => (
                <option key={s.id} value={s.id}>{s.id}</option>
              ))}
            </select>
          </div>

          <div className="w-px h-8 bg-[#e5dcd3] hidden sm:block"></div>

          <label className="flex items-center gap-3 cursor-pointer">
            <div className={`w-12 h-6 rounded-full border-2 border-[#1a1a1a] p-0.5 transition-colors ${autoAck ? 'bg-[#9bb796]' : 'bg-[#e5dcd3]'}`}>
              <div className={`w-4 h-4 bg-[#1a1a1a] rounded-full transition-transform ${autoAck ? 'translate-x-6' : 'translate-x-0'}`}></div>
            </div>
            <span className="font-bold text-sm uppercase tracking-wide">Auto-Ack Hooks</span>
          </label>
        </div>

        {/* Paper Accordion Fan (Saga Steps) */}
        <div className="bg-white border-2 border-[#1a1a1a] p-10 flex justify-center items-center overflow-x-auto shadow-[6px_6px_0_#1a1a1a] relative">
          <div className="absolute inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(45deg, #1a1a1a 25%, transparent 25%, transparent 75%, #1a1a1a 75%, #1a1a1a), linear-gradient(45deg, #1a1a1a 25%, transparent 25%, transparent 75%, #1a1a1a 75%, #1a1a1a)', backgroundSize: '20px 20px', backgroundPosition: '0 0, 10px 10px' }}></div>
          
          <div className="flex relative z-10 py-6 items-center">
            {STEPS.map((step, i) => {
              const isUp = i % 2 === 0;
              const state = getStepState(step.id);
              const color = getStepColor(state);
              const isActive = state === "running" || state === "waiting";
              const isFailed = state === "failed";
              const isSuccess = state === "success";

              return (
                <div key={step.id} className={`relative -ml-6 transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)]
                    ${isActive ? 'scale-[1.3] z-30' : 'scale-100 z-10'}
                    hover:scale-110 hover:z-20
                  `}
                  style={{ transformOrigin: isUp ? 'bottom center' : 'top center' }}
                >
                  <div className="w-32 h-32 relative drop-shadow-[0_8px_8px_rgba(0,0,0,0.15)]" style={{ clipPath: isUp ? 'polygon(50% 0%, 0% 100%, 100% 100%)' : 'polygon(0% 0%, 100% 0%, 50% 100%)' }}>
                    <div className="absolute inset-0 flex transition-colors duration-500" style={{ backgroundColor: color }}>
                      <div className="w-1/2 h-full bg-black/10"></div>
                      <div className="w-1/2 h-full bg-white/10"></div>
                    </div>
                    {/* Status Icon */}
                    <div className={`absolute ${isUp ? 'bottom-3' : 'top-3'} left-1/2 -translate-x-1/2 text-white`}>
                      {isFailed ? <X size={20} strokeWidth={4} /> : isSuccess ? <Check size={20} strokeWidth={4} /> : isActive ? <span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span></span> : null}
                    </div>
                    <div className="absolute inset-0 flex items-center justify-center">
                       <span className={`text-[10px] font-black uppercase text-center w-16 leading-tight px-1 tracking-tighter ${state === 'pending' || state === 'skipped' ? 'text-[#1a1a1a]/50' : 'text-white drop-shadow-md'} ${isUp ? 'translate-y-4' : '-translate-y-4'}`}>
                         {step.id}
                       </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Manual Hook Controls */}
        {!autoAck && events.some(e => e.type === "waiting_for_hook") && (
          <div className="flex flex-wrap gap-4 bg-[#fef9f1] border-2 border-[#c48b5a] p-4 shadow-[4px_4px_0_#c48b5a]">
            {events.some(e => e.type === "waiting_for_hook" && e.step === "notifyRestaurant") && !events.some(e => e.type === "hook_resolved" && e.step === "notifyRestaurant") && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-black uppercase tracking-wider text-[#c48b5a]">Restaurant:</span>
                <button onClick={() => manualHook("restaurant-accept", true)} className="bg-[#9bb796] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-[#1a1a1a] px-4 py-1 text-sm font-bold">Accept</button>
                <button onClick={() => manualHook("restaurant-accept", false)} className="bg-[#c24e4e] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-[#1a1a1a] px-4 py-1 text-sm font-bold">Reject</button>
              </div>
            )}
            {events.some(e => e.type === "waiting_for_hook" && e.step === "assignDriver") && !events.some(e => e.type === "hook_resolved" && e.step === "assignDriver") && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-black uppercase tracking-wider text-[#c48b5a]">Driver:</span>
                <button onClick={() => manualHook("driver-accept", true)} className="bg-[#9bb796] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-[#1a1a1a] px-4 py-1 text-sm font-bold">Accept</button>
                <button onClick={() => manualHook("driver-accept", false)} className="bg-[#c24e4e] border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all text-[#1a1a1a] px-4 py-1 text-sm font-bold">Reject</button>
              </div>
            )}
            {events.some(e => e.type === "waiting_for_hook" && e.step === "trackDelivery") && !events.some(e => e.type === "hook_resolved" && e.step === "trackDelivery") && (
              <div className="flex items-center gap-3">
                <span className="text-sm font-black uppercase tracking-wider text-[#c48b5a]">Customer:</span>
                <button onClick={() => manualHook("delivered")} className="bg-[#1a1a1a] text-white border-2 border-[#1a1a1a] shadow-[2px_2px_0_#1a1a1a] hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-none transition-all px-4 py-1 text-sm font-bold">Confirm Delivery</button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 flex-1 min-h-[350px]">
          {/* Notepad Event Feed */}
          <div className="xl:col-span-2 bg-[#fef9f1] border-2 border-[#1a1a1a] border-l-8 border-l-[#c24e4e] p-6 shadow-[6px_6px_0_#1a1a1a] relative overflow-hidden flex flex-col">
            <div className="absolute inset-0 pointer-events-none opacity-50" style={{ backgroundImage: 'linear-gradient(transparent 95%, #9bb796 95%)', backgroundSize: '100% 28px' }} />
            <h3 className="font-fraunces text-xl font-bold mb-4 relative z-10 text-[#1a1a1a] uppercase tracking-widest border-b-2 border-[#1a1a1a] pb-2 inline-block">Raw Event Log</h3>
            <div className="relative z-10 flex-1 overflow-y-auto font-mono text-xs leading-[28px] text-[#1a1a1a]">
              {events.map((e, i) => (
                <div key={i} className="flex gap-4">
                  <span className="text-[#c48b5a] shrink-0 font-bold">{String(i + 1).padStart(3, '0')}</span>
                  {renderEventLog(e)}
                </div>
              ))}
              <div ref={eventsEndRef} />
              {events.length === 0 && <div className="text-[#1a1a1a]/40 italic">Waiting for events...</div>}
            </div>
          </div>

          {/* Compensations List */}
          <div className="bg-[#1a1a1a] text-[#fef9f1] border-2 border-[#1a1a1a] p-6 shadow-[6px_6px_0_rgba(26,26,26,0.3)] border-t-[12px] border-t-[#c48b5a] flex flex-col relative overflow-hidden">
            <div className="absolute -right-6 -bottom-6 opacity-10">
              <AlertTriangle size={150} />
            </div>
            <h3 className="font-fraunces text-xl font-bold mb-4 relative z-10 uppercase tracking-widest border-b border-[#fef9f1]/20 pb-2">Rollbacks</h3>
            <div className="relative z-10 flex-1 overflow-y-auto space-y-3">
              {events.filter((e): e is Extract<OrderEvent, { type: "compensation_pushed" }> => e.type === "compensation_pushed").map((e, i) => (
                <div key={i} className="text-xs font-mono border-2 border-dashed border-[#c48b5a] p-2 bg-[#fef9f1]/5 flex justify-between items-center relative">
                  {/* Small piece of tape */}
                  <div className="absolute top-[-6px] left-1/2 -translate-x-1/2 w-6 h-3 bg-white/20 transform rotate-2"></div>
                  
                  <span className="text-gray-300">{e.action}</span>
                  {events.some(c => c.type === "compensated" && c.action === e.action) ? (
                    <span className="text-[#9bb796] font-bold"><Check size={14} strokeWidth={3}/></span>
                  ) : events.some(c => c.type === "compensating" && c.action === e.action) ? (
                    <span className="text-[#c48b5a] font-bold animate-pulse">...</span>
                  ) : (
                    <span className="text-gray-500 font-bold">Q'd</span>
                  )}
                </div>
              ))}
              {events.filter(e => e.type === "compensation_pushed").length === 0 && (
                <div className="text-[#fef9f1]/40 text-xs font-mono italic mt-4 text-center">No compensations required.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}