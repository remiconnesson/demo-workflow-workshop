"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import type { FailStep, OrderEvent, OrderInput, OrderItem } from "@/workflows/place-order";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700", "800"],
});

type CartItem = OrderItem & { desc: string };

const MENU: CartItem[] = [
  { id: "burger", name: "Double Cheeseburger", price: 12.99, qty: 0, desc: "Two beef patties, american cheese, special sauce, pickles, onions." },
  { id: "fries", name: "Crispy Fries", price: 4.99, qty: 0, desc: "Golden crinkle-cut fries with sea salt." },
  { id: "nuggets", name: "Spicy Chicken Nuggets (10pc)", price: 7.99, qty: 0, desc: "Crispy white meat chicken with a spicy kick." },
  { id: "shake", name: "Vanilla Shake", price: 5.49, qty: 0, desc: "Thick and creamy hand-spun vanilla milkshake." },
];

const STEPS: { key: string; label: string }[] = [
  { key: "validateOrder", label: "Order Confirmed" },
  { key: "chargeCard", label: "Payment Processed" },
  { key: "pingRestaurant", label: "Preparing Order" },
  { key: "findDriver", label: "Dasher Assigned" },
  { key: "trackDelivery", label: "On The Way" },
  { key: "sendReceipts", label: "Delivered" },
];

const FAIL_OPTIONS: { value: FailStep; label: string }[] = [
  { value: null, label: "Happy path" },
  { value: "validateOrder", label: "Fail at validate" },
  { value: "chargeCard", label: "Fail at payment" },
  { value: "pingRestaurant", label: "Fail at restaurant" },
  { value: "findDriver", label: "Fail at driver" },
  { value: "sendReceipts", label: "Fail at receipt" },
];

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

export default function DoorDashClone() {
  const [cart, setCart] = useState<CartItem[]>(
    MENU.map((m) => ({ ...m, qty: m.id === "burger" ? 1 : 0 })),
  );
  const [customerName, setCustomerName] = useState("Jane Doe");
  const [address, setAddress] = useState("456 Delivery Ave, Food City");
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);
  const [tipPercent, setTipPercent] = useState<number>(15);

  const [running, setRunning] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [stepStatuses, setStepStatuses] = useState<Record<string, StepStatus>>({});
  const [result, setResult] = useState<"completed" | "rolled_back" | null>(null);
  const [currentOrderId, setCurrentOrderId] = useState<string | null>(null);
  const [compensations, setCompensations] = useState<string[]>([]);
  const abortRef = useRef<AbortController | null>(null);

  const subtotal = useMemo(() => cart.reduce((s, i) => s + i.price * i.qty, 0), [cart]);
  const totalItems = useMemo(() => cart.reduce((s, i) => s + i.qty, 0), [cart]);
  const serviceFee = subtotal > 0 ? 2.99 : 0;
  const deliveryFee = 0;
  const tax = subtotal * 0.08;
  const tip = subtotal * (tipPercent / 100);
  const total = subtotal + serviceFee + deliveryFee + tax + tip;

  const updateQty = (id: string, delta: number) =>
    setCart((c) => c.map((i) => (i.id === id ? { ...i, qty: Math.max(0, i.qty + delta) } : i)));

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
    setRunning(false);
  };

  const placeOrder = useCallback(async () => {
    reset();
    setRunning(true);

    const orderId = `dd_${Date.now().toString(36)}`;
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

    const res = await fetch(`/api/runs/${runId}/stream`, { signal: controller.signal });
    if (!res.body) {
      setRunning(false);
      return;
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

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
            applyEvent(event);
          } catch {}
        }
      }
    } catch {} finally {
      setRunning(false);
    }
  }, [cart, customerName, address, failAt, autoAck]);

  const applyEvent = (event: OrderEvent) => {
    setEvents((ev) => [...ev, event]);
    switch (event.type) {
      case "step_running": setStepStatuses((s) => ({ ...s, [event.step]: "running" })); break;
      case "step_succeeded": setStepStatuses((s) => ({ ...s, [event.step]: "success" })); break;
      case "step_failed": setStepStatuses((s) => ({ ...s, [event.step]: "failed" })); break;
      case "step_skipped": setStepStatuses((s) => ({ ...s, [event.step]: "skipped" })); break;
      case "waiting_for_hook": {
        setStepStatuses((s) => ({ ...s, [event.step]: "waiting" }));
        if (autoAck) {
          const kind = event.step === "pingRestaurant" ? "restaurant-accept" : event.step === "findDriver" ? "driver-accept" : "delivered";
          setTimeout(() => { void resume(kind, kind === "delivered" ? {} : { accepted: true }); }, 800);
        }
        break;
      }
      case "hook_resolved": setStepStatuses((s) => ({ ...s, [event.step]: "success" })); break;
      case "compensated": setCompensations((c) => [...c, event.action]); break;
      case "done": setResult(event.status); break;
    }
  };

  const resume = async (kind: "restaurant-accept" | "driver-accept" | "delivered", payload: object = {}) => {
    if (!currentOrderId) return;
    await fetch(`/api/orders/${currentOrderId}/resume`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind, ...payload }),
    });
  };

  return (
    <div className={`min-h-screen bg-[#f7f7f7] text-[#191919] ${sans.className}`}>
      {/* Header */}
      <header className="sticky top-0 z-50 flex items-center justify-between bg-white px-4 md:px-8 py-3 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="text-2xl font-[800] text-[#eb1700] tracking-tighter flex items-center gap-1">
            <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
               <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
            DOORDASH
          </div>
        </div>
        <div className="flex-1 max-w-sm hidden md:flex items-center bg-[#f7f7f7] rounded-full px-4 py-2 text-sm text-gray-700 font-bold hover:bg-[#ebebeb] transition cursor-pointer">
          <svg className="w-4 h-4 mr-2 text-[#eb1700]" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z"></path></svg>
          <span className="truncate">{address}</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-1 bg-[#fff6f5] text-[#eb1700] px-3 py-1 rounded-full text-xs font-bold border border-[#ffd5d1]">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            DashPass
          </div>
          <button className="flex items-center gap-2 bg-[#f7f7f7] hover:bg-[#ebebeb] px-4 py-2 rounded-full font-bold text-sm transition relative">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 0a2 2 0 100 4 2 2 0 000-4z"></path></svg>
            {totalItems > 0 && <span className="bg-[#eb1700] text-white text-[10px] w-4 h-4 flex items-center justify-center rounded-full absolute top-0 left-6 ring-2 ring-white">{totalItems}</span>}
            <span className="hidden sm:inline">${totalItems > 0 ? total.toFixed(2) : "0.00"}</span>
          </button>
        </div>
      </header>

      <main className="max-w-[1100px] mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 lg:gap-8 items-start">
        
        {/* Main Content */}
        {!running && !result ? (
          <div className="space-y-6">
            
            {/* Category Chips */}
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide">
              {['Fastest', 'Under $15', 'Offers', 'New', 'Rating 4.5+', 'Vegetarian'].map(cat => (
                <button key={cat} className="whitespace-nowrap bg-white border border-gray-200 px-4 py-2 rounded-full text-sm font-bold shadow-sm hover:bg-gray-50 text-[#191919] transition">
                  {cat}
                </button>
              ))}
            </div>

            {/* Promo banner */}
            <div className="bg-[#fff6f5] border border-[#ffd5d1] rounded-2xl p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="bg-white p-2 rounded-full text-[#eb1700] shadow-sm">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                </div>
                <div>
                  <div className="font-bold text-sm text-[#eb1700]">DashPass Exclusive</div>
                  <div className="text-xs text-[#191919] font-medium">Enjoy $0 delivery fee and reduced service fees on eligible orders.</div>
                </div>
              </div>
            </div>

            {/* Restaurant Hero */}
            <div className="relative rounded-2xl overflow-hidden aspect-[21/9] bg-gradient-to-tr from-[#eb1700] to-orange-400 shadow-sm">
               <div className="absolute inset-0 bg-black/10" />
               <div className="absolute inset-x-0 bottom-0 p-6 pt-24 bg-gradient-to-t from-black/80 to-transparent text-white">
                 <h1 className="text-3xl md:text-4xl font-[800] mb-3 tracking-tight">Burger Dash</h1>
                 <div className="flex flex-wrap items-center gap-3 text-sm font-bold">
                   <span className="flex items-center gap-1">
                     <span className="text-yellow-400 text-lg">★</span> 4.8 <span className="text-gray-200 font-medium">(1,000+ ratings)</span>
                   </span>
                   <span className="w-1 h-1 bg-gray-400 rounded-full" />
                   <span className="font-medium text-gray-200">Burgers • American • Fast Food</span>
                 </div>
               </div>
            </div>

            {/* Menu */}
            <div>
              <h2 className="text-2xl font-[800] tracking-tight mb-4 text-[#191919]">Featured Items</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MENU.map(item => (
                  <div key={item.id} className="bg-white p-4 rounded-xl border border-gray-100 flex gap-4 hover:shadow-md transition">
                    <div className="flex-1">
                      <h3 className="font-bold text-base mb-1 text-[#191919]">{item.name}</h3>
                      <p className="text-sm text-gray-500 font-medium line-clamp-2 mb-3">{item.desc}</p>
                      <div className="font-bold text-[#191919]">${item.price.toFixed(2)}</div>
                    </div>
                    <div className="w-[110px] h-[110px] shrink-0 bg-[#f7f7f7] rounded-lg flex flex-col items-center justify-center relative border border-gray-100 overflow-visible">
                      <span className="text-5xl opacity-50 drop-shadow-sm">
                        {item.id === "burger" ? "🍔" : item.id === "fries" ? "🍟" : item.id === "nuggets" ? "🍗" : "🥤"}
                      </span>
                      <div className="absolute -bottom-3 flex bg-white shadow-md border border-gray-200 rounded-full overflow-hidden w-[90%] justify-center">
                         {cart.find(i => i.id === item.id)!.qty > 0 ? (
                           <div className="flex items-center w-full">
                              <button onClick={() => updateQty(item.id, -1)} className="flex-1 py-1.5 hover:bg-gray-100 text-[#eb1700] font-[800] text-lg flex items-center justify-center">−</button>
                              <span className="px-1 text-sm font-[800] w-6 text-center text-[#191919]">{cart.find(i => i.id === item.id)!.qty}</span>
                              <button onClick={() => updateQty(item.id, 1)} className="flex-1 py-1.5 hover:bg-gray-100 text-[#eb1700] font-[800] text-lg flex items-center justify-center">+</button>
                           </div>
                         ) : (
                           <button onClick={() => updateQty(item.id, 1)} className="w-full py-1.5 font-[800] text-sm hover:bg-gray-50 text-[#191919]">Add</button>
                         )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
               {/* Accent line top */}
               <div className={`absolute top-0 inset-x-0 h-1 ${result === 'rolled_back' ? 'bg-red-500' : 'bg-[#eb1700]'}`}></div>

               <h2 className="text-2xl font-[800] tracking-tight mb-2 pt-2 text-[#191919]">
                 {result === "rolled_back" ? "Order Canceled" : result === "completed" ? "Order Delivered" : "Preparing your order"}
               </h2>
               <p className="text-gray-500 text-sm font-bold mb-10">Order #{currentOrderId}</p>

               {/* Progress Bar DoorDash style */}
               <div className="relative mb-12">
                  <div className="absolute top-2.5 left-0 w-full h-[3px] bg-gray-200"></div>
                  <div className="absolute top-2.5 left-0 h-[3px] transition-all duration-500 ease-in-out" 
                       style={{ 
                         width: `${
                           result === "rolled_back" ? 100 : 
                           stepStatuses.sendReceipt === 'success' ? 100 : 
                           stepStatuses.trackDelivery === 'success' ? 80 : 
                           stepStatuses.assignDriver === 'success' ? 60 : 
                           stepStatuses.notifyRestaurant === 'success' ? 40 : 
                           stepStatuses.chargePayment === 'success' ? 20 : 0
                         }%`, 
                         backgroundColor: result === "rolled_back" ? "#ef4444" : "#eb1700" 
                       }}>
                  </div>
                  
                  <div className="relative flex justify-between">
                     {STEPS.map((step) => {
                        const s = stepStatuses[step.key];
                        const isDone = s === "success" || s === "skipped";
                        const isCurrent = s === "running" || s === "waiting";
                        const isFailed = s === "failed";
                        return (
                          <div key={step.key} className="flex flex-col items-center relative w-16">
                            <div className={`w-5 h-5 rounded-full z-10 flex items-center justify-center border-2 transition-all duration-300 ${
                                isFailed ? "bg-red-500 border-red-500 text-white" :
                                isDone ? "bg-[#eb1700] border-[#eb1700] text-white shadow-[0_0_0_3px_rgba(235,23,0,0.1)]" :
                                isCurrent ? "bg-white border-[#eb1700] shadow-[0_0_0_3px_rgba(235,23,0,0.2)]" :
                                "bg-white border-gray-300"
                            }`}>
                              {(isDone) && !isFailed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"></path></svg>}
                              {isCurrent && !isFailed && <div className="w-2 h-2 bg-[#eb1700] rounded-full animate-pulse" />}
                              {isFailed && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"></path></svg>}
                            </div>
                            <span className={`text-[10px] font-[800] mt-3 text-center uppercase tracking-wide leading-tight ${
                                isCurrent || isDone ? "text-[#191919]" : "text-gray-400"
                            }`}>{step.label}</span>
                          </div>
                        )
                     })}
                  </div>
               </div>

               {/* Map Placeholder */}
               <div className="w-full h-56 bg-[#f1f3f4] rounded-2xl relative overflow-hidden mb-6 flex items-center justify-center border border-gray-200">
                  <div className="absolute inset-0 opacity-40 mix-blend-multiply" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #e5e7eb 25%, transparent 25%, transparent 75%, #e5e7eb 75%, #e5e7eb), repeating-linear-gradient(45deg, #e5e7eb 25%, #f8fafc 25%, #f8fafc 75%, #e5e7eb 75%, #e5e7eb)', backgroundPosition: '0 0, 10px 10px', backgroundSize: '20px 20px' }}></div>
                  <div className="bg-white/90 backdrop-blur-sm px-5 py-2.5 rounded-full shadow-lg z-10 font-[800] text-sm flex items-center gap-3 text-[#191919]">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#eb1700] animate-pulse"></span>
                    Live GPS tracking
                  </div>
               </div>

               {/* Dasher Card */}
               <div className="flex items-center justify-between bg-white shadow-sm border border-gray-100 p-4 rounded-2xl">
                 <div className="flex items-center gap-4">
                   <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center text-2xl border-2 border-white shadow-sm">🚴</div>
                   <div>
                     <div className="font-[800] text-sm text-[#191919]">Dasher arriving soon</div>
                     <div className="text-xs font-bold text-gray-500 mt-0.5">Alex • 4.9 ★ (2,410 ratings)</div>
                   </div>
                 </div>
                 <div className="flex gap-2">
                   <button className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition font-bold">💬</button>
                   <button className="w-10 h-10 rounded-full bg-gray-100 text-gray-700 flex items-center justify-center hover:bg-gray-200 transition font-bold">📞</button>
                 </div>
               </div>

               {compensations.length > 0 && (
                <div className="mt-6 rounded-2xl border border-red-200 bg-[#fff6f5] p-5 text-sm text-[#eb1700]">
                  <div className="font-[800] flex items-center gap-2 mb-3">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                    Refund & Compensation Details
                  </div>
                  <ul className="list-disc pl-5 font-bold space-y-1 text-red-900/80">
                    {compensations.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            
            <button onClick={reset} className="w-full py-4 text-sm font-[800] text-gray-500 hover:text-[#191919] transition">
              ← Start a new order
            </button>
          </div>
        )}

        {/* Sidebar */}
        <div className="space-y-6">
          {!running && !result ? (
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 sticky top-24">
              <h2 className="text-xl font-[800] tracking-tight mb-5 text-[#191919]">Your Cart</h2>
              
              <div className="space-y-5 mb-6">
                <div>
                  <label className="block text-[11px] font-[800] text-gray-500 uppercase tracking-wider mb-1.5">Delivery Details</label>
                  <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-[#191919] focus:outline-none focus:border-[#eb1700] mb-2 transition" placeholder="Name" />
                  <input value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm font-bold text-[#191919] focus:outline-none focus:border-[#eb1700] transition" placeholder="Address" />
                </div>
              </div>

              {cart.filter(i => i.qty > 0).length === 0 ? (
                <div className="text-center py-6 text-gray-500 font-bold text-sm">Your cart is empty</div>
              ) : (
                <div className="space-y-4">
                  {cart.filter(i => i.qty > 0).map(item => (
                    <div key={item.id} className="flex justify-between items-start text-sm font-bold text-[#191919]">
                       <div className="flex items-start gap-3">
                         <span className="w-6 h-6 flex items-center justify-center bg-gray-100 rounded text-xs text-gray-600 mt-0.5">{item.qty}</span>
                         <div className="flex flex-col">
                           <span>{item.name}</span>
                           <button onClick={() => updateQty(item.id, -item.qty)} className="text-[10px] text-[#eb1700] text-left mt-0.5">Remove</button>
                         </div>
                       </div>
                       <span>${(item.price * item.qty).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              {cart.filter(i => i.qty > 0).length > 0 && (
                <div className="border-t border-gray-100 pt-4 mt-5 space-y-3 text-sm font-bold text-gray-500">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span className="text-[#191919]">${subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Delivery Fee <span className="text-[#eb1700] text-xs ml-1">(DashPass)</span></span>
                    <span className="text-[#191919]"><span className="line-through text-gray-400 mr-2">$3.99</span>$0.00</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Fees & Estimated Tax</span>
                    <span className="text-[#191919]">${(serviceFee + tax).toFixed(2)}</span>
                  </div>
                  <div className="pt-3 border-t border-gray-100">
                    <div className="flex justify-between mb-3">
                      <span className="text-[#191919]">Dasher Tip</span>
                      <span className="text-[#191919]">${tip.toFixed(2)}</span>
                    </div>
                    <div className="flex gap-2">
                      {[15, 18, 20, 25].map(pct => (
                        <button 
                          key={pct} 
                          onClick={() => setTipPercent(pct)}
                          className={`flex-1 py-1.5 rounded-full text-xs font-[800] transition-colors ${tipPercent === pct ? 'bg-[#191919] text-white' : 'bg-gray-100 text-[#191919] hover:bg-gray-200'}`}
                        >
                          {pct}%
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {cart.filter(i => i.qty > 0).length > 0 && (
                <div className="border-t border-gray-100 pt-4 mt-5 flex justify-between font-[800] text-lg text-[#191919]">
                  <span>Total</span>
                  <span>${total.toFixed(2)}</span>
                </div>
              )}

              <div className="mt-8 bg-[#fff6f5] p-4 rounded-xl border border-[#ffd5d1] text-xs space-y-3">
                 <div className="font-[800] text-[#eb1700] uppercase tracking-wider text-[10px]">Demo Settings</div>
                 <div>
                   <label className="block text-[#191919] font-bold mb-1.5">Fail Scenario</label>
                   <select value={failAt ?? "null"} onChange={e => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)} className="w-full bg-white border border-[#ffd5d1] rounded-md px-3 py-2 font-bold text-[#191919] focus:outline-none focus:border-[#eb1700] transition">
                     {FAIL_OPTIONS.map(opt => <option key={String(opt.value)} value={opt.value ?? "null"}>{opt.label}</option>)}
                   </select>
                 </div>
                 <label className="flex items-center gap-2 text-[#191919] font-bold cursor-pointer pt-1">
                   <input type="checkbox" checked={autoAck} onChange={e => setAutoAck(e.target.checked)} className="accent-[#eb1700] w-4 h-4 rounded" />
                   Auto-ack webhook pauses
                 </label>
              </div>

              <button 
                onClick={placeOrder} 
                disabled={totalItems === 0 || running}
                className="w-full bg-[#eb1700] hover:bg-[#d11500] text-white font-[800] text-lg py-4 rounded-full mt-6 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_6px_20px_rgba(235,23,0,0.3)] hover:shadow-[0_6px_25px_rgba(235,23,0,0.4)] disabled:shadow-none"
              >
                {running ? "Placing Order..." : "Place Order"}
              </button>
            </div>
          ) : (
            <div className="space-y-6 sticky top-24">
              {/* Event Stream */}
              <div className="bg-[#191919] p-5 rounded-2xl shadow-xl text-gray-300 font-mono text-[11px] h-[320px] flex flex-col border border-gray-800">
                <div className="font-bold text-white mb-3 flex items-center justify-between border-b border-gray-700 pb-3">
                  <span className="uppercase tracking-wider text-[10px] text-gray-400">Terminal Log</span>
                  <span className="flex items-center gap-2 text-green-400">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse shadow-[0_0_8px_rgba(34,197,94,0.8)]"></span> LIVE
                  </span>
                </div>
                <div className="overflow-y-auto flex-1 space-y-2 pr-2 custom-scrollbar">
                  {events.length === 0 && <div className="text-gray-500 italic flex items-center gap-2"><span className="animate-spin">◷</span> Waiting for connection...</div>}
                  {events.map((e, i) => (
                    <div key={i} className="break-words leading-relaxed flex items-start gap-2">
                      <span className="text-gray-600 shrink-0">[{new Date().toLocaleTimeString([], {hour12:false})}]</span>
                      <div>
                        <span className={`font-bold mr-1.5 ${
                          e.type.includes('fail') || e.type.includes('compensat') ? 'text-red-400' : 
                          e.type.includes('succ') || e.type === 'hook_resolved' || e.type === 'done' ? 'text-green-400' :
                          e.type === 'waiting_for_hook' ? 'text-yellow-400' : 'text-blue-400'
                        }`}>
                          {e.type}
                        </span>
                        <span className="text-gray-300">
                          {(() => {
                            switch (e.type) {
                              case "step_running": case "step_succeeded": case "step_failed": case "step_skipped": return `${e.label}${"detail" in e && e.detail ? ` — ${e.detail}` : ""}${"error" in e && e.error ? ` — ${e.error}` : ""}`;
                              case "waiting_for_hook": return e.label;
                              case "hook_resolved": return e.detail ?? e.token;
                              case "compensation_pushed": return `${e.action} (${e.forStep})`;
                              case "compensating": case "compensated": return e.action;
                              case "log": return e.message;
                              case "done": return `${e.status}`;
                              default: return "";
                            }
                          })()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Manual Hook Controls */}
              <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-[800] text-sm mb-1 text-[#191919]">Manual Hook Triggers</h3>
                <p className="text-[11px] font-bold text-gray-400 mb-4">Required if Auto-ack is disabled</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => resume("restaurant-accept", { accepted: true })} className="bg-gray-100 hover:bg-gray-200 text-[#191919] text-xs font-[800] py-2.5 px-3 rounded-xl transition">Rest. Accept</button>
                  <button onClick={() => resume("restaurant-accept", { accepted: false, reason: "Too busy" })} className="bg-[#fff6f5] hover:bg-[#ffe0dc] text-[#eb1700] border border-[#ffd5d1] text-xs font-[800] py-2.5 px-3 rounded-xl transition">Rest. Reject</button>
                  <button onClick={() => resume("driver-accept", { accepted: true })} className="bg-gray-100 hover:bg-gray-200 text-[#191919] text-xs font-[800] py-2.5 px-3 rounded-xl transition">Driver Accept</button>
                  <button onClick={() => resume("driver-accept", { accepted: false })} className="bg-[#fff6f5] hover:bg-[#ffe0dc] text-[#eb1700] border border-[#ffd5d1] text-xs font-[800] py-2.5 px-3 rounded-xl transition">Driver Reject</button>
                  <button onClick={() => resume("delivered")} className="col-span-2 bg-[#191919] hover:bg-black text-white text-xs font-[800] py-3 px-3 rounded-xl transition mt-1 uppercase tracking-wider">Mark Delivered</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255, 255, 255, 0.2); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255, 255, 255, 0.3); }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}
