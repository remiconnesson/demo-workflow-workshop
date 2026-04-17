"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { Inter } from "next/font/google";
import type {
  FailStep,
  OrderEvent,
  OrderInput,
  OrderItem,
} from "@/workflows/place-order";

const inter = Inter({ subsets: ["latin"], weight: ["400", "600", "800"] });

type StepStatus = "pending" | "running" | "waiting" | "success" | "failed" | "skipped";

const MENU_CATEGORIES = [
  {
    name: "Appetizers",
    items: [
      { id: "spring_rolls", name: "Spring Rolls (4)", desc: "Crispy veggie rolls with sweet chili sauce.", price: 8 },
      { id: "edamame", name: "Edamame", desc: "Steamed soybeans with sea salt.", price: 6 },
    ]
  },
  {
    name: "Phở",
    items: [
      { id: "pho_beef", name: "Beef Phở", desc: "Traditional noodle soup with thinly sliced beef.", price: 14 },
      { id: "pho_chicken", name: "Chicken Phở", desc: "Savory chicken broth with shredded chicken.", price: 13 },
    ]
  },
  {
    name: "Bánh Mì",
    items: [
      { id: "banh_mi_classic", name: "Classic Bánh Mì", desc: "Pork roll, paté, cucumber, jalapeño, cilantro.", price: 10 },
      { id: "banh_mi_tofu", name: "Tofu Bánh Mì", desc: "Crispy tofu with pickled daikon and carrots.", price: 9 },
    ]
  },
  {
    name: "Drinks",
    items: [
      { id: "boba_taro", name: "Taro Boba", desc: "Sweet taro milk tea with tapioca pearls.", price: 6 },
      { id: "thai_tea", name: "Thai Tea", desc: "Brewed black tea spiced with star anise.", price: 5 },
    ]
  }
];

function TopNav({
  view,
  onBack,
  cartCount,
  address,
  onCartClick
}: {
  view: string;
  onBack: () => void;
  cartCount: number;
  address: string;
  onCartClick: () => void;
}) {
  return (
    <header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-gray-200 bg-white px-4 lg:px-8">
      <div className="flex items-center gap-4">
        {view !== "menu" && (
          <button onClick={onBack} className="text-sm font-bold text-[#f63440] hover:text-[#d23833]">
            ← Back
          </button>
        )}
        <div className="font-extrabold tracking-tight text-[#f63440] text-2xl cursor-pointer" onClick={view !== "menu" ? onBack : undefined}>
          GRUBHUB<span className="text-gray-900">clone</span>
        </div>
      </div>
      
      {view === "menu" && (
        <div className="hidden flex-1 items-center justify-center lg:flex">
          <div className="flex w-full max-w-md items-center rounded-full bg-gray-100 px-4 py-2.5 text-sm text-gray-700 font-medium cursor-text">
            <span className="font-bold text-gray-900 mr-2">Deliver to</span>
            <span className="truncate">{address || "Enter your address"}</span>
          </div>
        </div>
      )}

      <div className="flex items-center gap-6">
        <div className="hidden lg:block text-sm font-bold text-gray-700 hover:text-[#f63440] cursor-pointer transition-colors">Orders</div>
        <div className="hidden lg:block text-sm font-bold text-gray-700 hover:text-[#f63440] cursor-pointer transition-colors">Help</div>
        {cartCount > 0 && view === "menu" && (
           <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 hover:bg-gray-200 text-gray-900 font-bold cursor-pointer transition-colors" onClick={onCartClick}>
             {cartCount}
           </div>
        )}
        <button className="rounded-full bg-[#f63440] px-5 py-2 text-sm font-bold text-white hover:bg-[#d23833] transition-colors">
          Sign in
        </button>
      </div>
    </header>
  );
}

function RestaurantHero() {
  return (
    <div className="w-full border-b border-gray-100 bg-white pb-6">
      <div className="h-48 lg:h-64 w-full bg-gradient-to-r from-orange-400 via-red-500 to-[#f63440]" />
      <div className="mx-auto max-w-5xl px-4 pt-6 lg:px-8">
        <h1 className="text-3xl lg:text-4xl font-extrabold text-gray-900 tracking-tight">Saigon Noodle House</h1>
        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-gray-600">
          <span>Vietnamese</span>
          <span>·</span>
          <span>Asian</span>
          <span>·</span>
          <span>Noodles</span>
        </div>
        <div className="mt-4 flex items-center gap-6 text-sm">
          <div className="flex items-center gap-1.5 font-bold text-gray-900 bg-gray-100 px-3 py-1.5 rounded-full">
             <span className="text-yellow-500 text-base">★</span> 4.8 <span className="font-medium text-gray-500">(1,204 ratings)</span>
          </div>
          <div className="font-bold text-gray-900">
             $1.99 <span className="font-medium text-gray-500">delivery</span>
          </div>
          <div className="font-bold text-gray-900">
             $15 <span className="font-medium text-gray-500">minimum</span>
          </div>
          <div className="font-bold text-gray-900 hidden sm:block">
             Open until 10 PM
          </div>
        </div>
        <div className="mt-5 inline-block rounded-full bg-[#ffb100] px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-yellow-950 shadow-sm">
          Perks available
        </div>
      </div>
    </div>
  );
}

function MenuView({
  cart,
  updateQty,
  onCheckout
}: {
  cart: Record<string, number>;
  updateQty: (id: string, delta: number) => void;
  onCheckout: () => void;
}) {
  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    <div className="pb-32 bg-white">
      <RestaurantHero />
      <div className="mx-auto max-w-5xl px-4 lg:px-8 mt-8">
        <div className="flex flex-col lg:flex-row gap-12">
          <div className="flex-1">
            {MENU_CATEGORIES.map(cat => (
              <div key={cat.name} className="mb-10">
                <h2 className="sticky top-16 z-40 bg-white/95 backdrop-blur-sm py-4 text-2xl font-extrabold tracking-tight text-gray-900">
                  {cat.name}
                </h2>
                <div className="divide-y divide-gray-100">
                  {cat.items.map(item => (
                    <div key={item.id} className="flex justify-between py-6 group hover:bg-gray-50 transition-colors -mx-4 px-4 rounded-xl">
                      <div className="pr-6 max-w-[75%]">
                        <h3 className="font-bold text-gray-900 text-lg">{item.name}</h3>
                        <p className="mt-1 text-sm font-medium text-gray-500 leading-relaxed">{item.desc}</p>
                        <div className="mt-3 font-bold text-gray-900">${item.price.toFixed(2)}</div>
                      </div>
                      <div className="flex flex-col items-end justify-center">
                         {cart[item.id] ? (
                           <div className="flex items-center gap-4 rounded-full border border-gray-300 bg-white px-2 py-1.5 shadow-sm">
                             <button onClick={() => updateQty(item.id, -1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200 font-bold transition-colors">−</button>
                             <span className="w-4 text-center font-bold text-gray-900">{cart[item.id]}</span>
                             <button onClick={() => updateQty(item.id, 1)} className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f63440] text-white hover:bg-[#d23833] font-bold transition-colors">+</button>
                           </div>
                         ) : (
                           <button onClick={() => updateQty(item.id, 1)} className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-gray-200 bg-white text-gray-400 hover:border-[#f63440] hover:text-[#f63440] transition-colors shadow-sm">
                             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                           </button>
                         )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {totalItems > 0 && (
         <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-gray-200 bg-white p-4 shadow-[0_-8px_20px_-10px_rgba(0,0,0,0.1)]">
           <div className="mx-auto max-w-5xl">
             <button onClick={onCheckout} className="w-full rounded-lg bg-[#f63440] py-4 text-center font-bold text-white transition-colors hover:bg-[#d23833] text-lg shadow-md">
                Proceed to Checkout ({totalItems} {totalItems === 1 ? 'item' : 'items'})
             </button>
           </div>
         </div>
      )}
    </div>
  );
}

function CheckoutView({
  cartItems,
  customerName, setCustomerName,
  address, setAddress,
  failAt, setFailAt,
  autoAck, setAutoAck,
  onPlaceOrder,
  running
}: {
  cartItems: OrderItem[];
  customerName: string; setCustomerName: (s: string) => void;
  address: string; setAddress: (s: string) => void;
  failAt: FailStep; setFailAt: (s: FailStep) => void;
  autoAck: boolean; setAutoAck: (b: boolean) => void;
  onPlaceOrder: () => void;
  running: boolean;
}) {
  const subtotal = cartItems.reduce((s, i) => s + i.price * i.qty, 0);
  const deliveryFee = 1.99;
  const taxes = subtotal * 0.08;
  const total = subtotal + deliveryFee + taxes;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 lg:px-8">
      <h1 className="mb-8 text-3xl font-extrabold tracking-tight text-gray-900">Checkout</h1>
      
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3 space-y-8">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold text-gray-900 tracking-tight">Delivery details</h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Customer Name</label>
                <input 
                  value={customerName} 
                  onChange={e => setCustomerName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-[#f63440] focus:ring-1 focus:ring-[#f63440] outline-none font-medium"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Delivery Address</label>
                <input 
                  value={address} 
                  onChange={e => setAddress(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 focus:border-[#f63440] focus:ring-1 focus:ring-[#f63440] outline-none font-medium"
                />
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-5 text-xl font-bold text-gray-900 tracking-tight">Demo controls <span className="text-sm font-medium text-gray-400 ml-2 font-normal">(Developer)</span></h2>
            <div className="space-y-5">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Simulate Failure At Step</label>
                <select
                  value={failAt ?? "null"}
                  onChange={(e) => setFailAt(e.target.value === "null" ? null : e.target.value as FailStep)}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 text-gray-900 bg-white focus:border-[#f63440] focus:ring-1 focus:ring-[#f63440] outline-none font-medium"
                >
                  <option value="null">Happy path (No failure)</option>
                  <option value="validateOrder">Fail at validate</option>
                  <option value="chargeCard">Fail at payment</option>
                  <option value="pingRestaurant">Fail at restaurant</option>
                  <option value="findDriver">Fail at driver</option>
                  <option value="sendReceipts">Fail at receipt</option>
                </select>
              </div>
              <label className="flex items-start gap-3 cursor-pointer group">
                <div className="mt-0.5">
                  <input 
                    type="checkbox" 
                    checked={autoAck} 
                    onChange={e => setAutoAck(e.target.checked)}
                    className="h-5 w-5 rounded border-gray-300 text-[#f63440] focus:ring-[#f63440] cursor-pointer"
                  />
                </div>
                <div>
                  <span className="block text-sm font-bold text-gray-900 group-hover:text-[#f63440] transition-colors">Auto-acknowledge hooks</span>
                  <span className="block text-sm font-medium text-gray-500 mt-0.5">Automatically resolve paused workflow steps (restaurant, driver, delivery)</span>
                </div>
              </label>
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm sticky top-24">
            <h2 className="mb-5 text-xl font-bold text-gray-900 tracking-tight">Order summary</h2>
            
            <div className="mb-6 rounded-lg bg-[#fff7e6] p-4 border border-[#ffb100]/40">
              <div className="flex items-center gap-2 font-extrabold text-yellow-900">
                 <span className="text-lg">✨</span> Perks available
              </div>
              <p className="mt-1 text-sm font-medium text-yellow-800">You&apos;re earning points on this order!</p>
            </div>

            <ul className="mb-6 space-y-4 border-b border-gray-100 pb-6">
              {cartItems.map(item => (
                <li key={item.id} className="flex justify-between text-gray-900">
                  <div className="flex gap-3">
                    <span className="font-bold text-gray-400">{item.qty}x</span>
                    <span className="font-bold">{item.name}</span>
                  </div>
                  <span className="font-semibold">${(item.price * item.qty).toFixed(2)}</span>
                </li>
              ))}
            </ul>

            <div className="space-y-3 text-sm font-medium text-gray-600 mb-6">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span className="text-gray-900 font-semibold">${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Delivery Fee</span>
                <span className="text-gray-900 font-semibold">${deliveryFee.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Taxes & Fees</span>
                <span className="text-gray-900 font-semibold">${taxes.toFixed(2)}</span>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6 mb-6">
              <h3 className="text-sm font-bold text-gray-900 mb-3">Delivery Tip</h3>
              <div className="flex gap-2">
                {['15%', '20%', '25%', 'Custom'].map(tip => (
                  <button key={tip} className={`flex-1 rounded-full py-2 text-sm font-bold border transition-colors ${tip === '20%' ? 'bg-gray-900 text-white border-gray-900' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
                    {tip}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6 mb-6">
              <div className="flex gap-2">
                <input placeholder="Add promo code" className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium outline-none focus:border-[#f63440]" />
                <button className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-bold text-gray-700 hover:bg-gray-200 transition-colors">Apply</button>
              </div>
            </div>

            <div className="flex justify-between font-extrabold text-2xl text-gray-900 mb-6">
              <span>Total</span>
              <span>${total.toFixed(2)}</span>
            </div>

            <button 
              onClick={onPlaceOrder}
              disabled={running || cartItems.length === 0}
              className="w-full rounded-lg bg-[#f63440] py-4 text-center font-bold text-white transition-colors hover:bg-[#d23833] text-lg shadow-md disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {running ? "Processing..." : "Place your order"}
            </button>
            <p className="mt-4 text-center text-xs font-medium text-gray-500">
              By placing your order, you agree to our Terms of Use and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackingView({
  orderId,
  stepStatuses,
  events,
  result,
  compensations,
  onResumeHook,
  autoAck
}: {
  orderId: string | null;
  stepStatuses: Record<string, StepStatus>;
  events: OrderEvent[];
  result: "completed" | "rolled_back" | null;
  compensations: string[];
  onResumeHook: (kind: "restaurant-accept" | "driver-accept" | "delivered", payload?: object) => void;
  autoAck: boolean;
}) {
  const steps = [
    { key: "validateOrder", label: "Validating" },
    { key: "chargeCard", label: "Payment" },
    { key: "pingRestaurant", label: "Restaurant" },
    { key: "findDriver", label: "Driver" },
    { key: "trackDelivery", label: "Delivery" },
    { key: "sendReceipts", label: "Receipt" },
  ];

  const activeStepIndex = steps.reduce((acc, curr, i) => {
    const st = stepStatuses[curr.key];
    if (st && st !== 'pending' && st !== 'skipped') return i;
    return acc;
  }, 0);

  const progressPercent = (activeStepIndex / (steps.length - 1)) * 100;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 lg:px-8">
      {/* Header */}
      <div className="text-center mb-16">
        <h1 className="text-4xl lg:text-5xl font-extrabold text-gray-900 mb-4 tracking-tight">
          {result === "completed" ? "Order Delivered!" : result === "rolled_back" ? "Order Cancelled" : "Preparing your order"}
        </h1>
        <p className="text-gray-500 font-bold text-lg">Order #{orderId?.toUpperCase()}</p>
        <p className="text-gray-500 font-medium mt-2">Expected arrival: {new Date(Date.now() + 30*60000).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
      </div>

      {/* Progress Bar */}
      <div className="mb-12 rounded-2xl border border-gray-200 bg-white p-8 lg:p-12 shadow-sm overflow-hidden">
        <div className="relative flex items-center justify-between">
          <div className="absolute left-0 top-[14px] h-1.5 w-full bg-gray-100 rounded-full"></div>
          <div className="absolute left-0 top-[14px] h-1.5 bg-[#f63440] transition-all duration-700 rounded-full" style={{ width: `${progressPercent}%` }}></div>

          {steps.map((step, idx) => {
            const status = stepStatuses[step.key] ?? "pending";
            let dotColor = "bg-gray-200";
            let labelColor = "text-gray-400";
            
            if (status === "success") {
              dotColor = "bg-[#f63440] ring-4 ring-white";
              labelColor = "text-gray-900 font-bold";
            } else if (status === "running" || status === "waiting") {
              dotColor = "bg-white border-[4px] border-[#f63440] shadow-[0_0_0_4px_white] animate-pulse";
              labelColor = "text-[#f63440] font-extrabold";
            } else if (status === "failed") {
              dotColor = "bg-[#f63440] ring-4 ring-white";
              labelColor = "text-red-600 font-extrabold";
            } else if (status === "skipped") {
              dotColor = "bg-gray-200";
              labelColor = "text-gray-400 line-through font-medium";
            } else if (idx < activeStepIndex) {
              dotColor = "bg-[#f63440] ring-4 ring-white";
              labelColor = "text-gray-900 font-bold";
            } else {
              labelColor = "text-gray-400 font-medium";
            }

            return (
              <div key={step.key} className="relative z-10 flex flex-col items-center">
                <div className={`h-7 w-7 rounded-full ${dotColor} transition-colors duration-300`} />
                <div className={`absolute top-10 w-24 text-center text-sm ${labelColor}`}>
                  {step.label}
                  {status === "waiting" && <div className="text-[10px] text-yellow-600 mt-1 font-bold tracking-wide uppercase">Waiting</div>}
                  {status === "failed" && <div className="text-[10px] text-red-600 mt-1 font-bold tracking-wide uppercase">Failed</div>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {result === "rolled_back" && compensations.length > 0 && (
        <div className="mb-10 rounded-xl border border-red-200 bg-red-50 p-6 shadow-sm">
          <h3 className="font-extrabold text-red-900 mb-2 text-lg tracking-tight">Order failed and rolled back.</h3>
          <p className="text-sm font-medium text-red-800 mb-3">The following compensations were executed to revert the state:</p>
          <ul className="list-disc pl-5 text-sm font-bold text-red-700 space-y-1">
            {compensations.map((c, i) => <li key={i}>{c}</li>)}
          </ul>
        </div>
      )}

      {/* Two columns: Manual Controls and Events Stream */}
      <div className="grid gap-8 lg:grid-cols-2">
        <div className="rounded-xl border border-gray-200 bg-white p-6 lg:p-8 shadow-sm">
          <h2 className="mb-2 text-xl font-bold text-gray-900 tracking-tight">Hook Controls</h2>
          {!autoAck && <p className="mb-6 text-sm font-medium text-gray-500">Auto-ack is OFF. You must manually resolve paused workflow steps.</p>}
          {autoAck && <p className="mb-6 text-sm font-medium text-gray-500">Auto-ack is ON. Hooks will resolve automatically in ~800ms.</p>}
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => onResumeHook("restaurant-accept", { accepted: true })}
                className="rounded-lg bg-white border-2 border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Accept (Restaurant)
              </button>
              <button 
                onClick={() => onResumeHook("restaurant-accept", { accepted: false, reason: "Too busy" })}
                className="rounded-lg bg-white border-2 border-red-200 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
              >
                Reject (Restaurant)
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <button 
                onClick={() => onResumeHook("driver-accept", { accepted: true })}
                className="rounded-lg bg-white border-2 border-gray-200 px-4 py-3 text-sm font-bold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-colors"
              >
                Accept (Driver)
              </button>
              <button 
                onClick={() => onResumeHook("driver-accept", { accepted: false })}
                className="rounded-lg bg-white border-2 border-red-200 px-4 py-3 text-sm font-bold text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
              >
                Reject (Driver)
              </button>
            </div>
            <button 
                onClick={() => onResumeHook("delivered")}
                className="w-full rounded-lg bg-[#f63440] border border-transparent px-4 py-4 text-sm font-extrabold text-white hover:bg-[#d23833] transition-colors shadow-sm"
              >
                Mark as Delivered
              </button>
          </div>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-6 lg:p-8 shadow-sm flex flex-col h-[420px]">
          <h2 className="mb-4 text-xl font-bold text-gray-900 tracking-tight">Event Stream</h2>
          <div className="flex-1 overflow-auto rounded-lg bg-[#1a1a1a] p-5 font-mono text-xs text-gray-300 space-y-2">
            {events.length === 0 ? (
              <span className="text-gray-500">Waiting for events...</span>
            ) : (
              events.map((e, i) => (
                <div key={i} className="break-words">
                  <span className="text-gray-500">[{new Date().toLocaleTimeString()}]</span>{" "}
                  <span className={
                    e.type === "step_failed" || e.type === "compensating" ? "text-red-400 font-bold" :
                    e.type === "step_succeeded" || e.type === "hook_resolved" || e.type === "compensated" ? "text-green-400 font-bold" :
                    e.type === "waiting_for_hook" ? "text-yellow-400 font-bold" :
                    e.type === "done" ? "text-blue-400 font-bold" :
                    "text-gray-400 font-bold"
                  }>{e.type}</span>
                  {" "}
                  <span className="text-white font-medium">
                    {e.type === "step_running" || e.type === "step_succeeded" || e.type === "step_failed" || e.type === "step_skipped" ? `${e.label}${'detail' in e && e.detail ? ` — ${e.detail}` : ''}${'error' in e && e.error ? ` — ${e.error}` : ''}` :
                     e.type === "waiting_for_hook" ? e.label :
                     e.type === "hook_resolved" ? (e.detail ?? e.token) :
                     e.type === "compensation_pushed" ? `${e.action} (for ${e.forStep})` :
                     e.type === "compensating" || e.type === "compensated" ? e.action :
                     e.type === "log" ? e.message :
                     e.type === "done" ? `${e.status} — ${e.orderId}` : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="mt-12 border-t border-gray-200 pt-8 text-center pb-8">
        <p className="text-sm text-gray-500 font-bold">Need help with your order?</p>
        <button className="mt-2 font-extrabold text-[#f63440] hover:text-[#d23833] transition-colors">Contact Grubhub Support</button>
      </div>
    </div>
  );
}

export default function GrubhubClonePage() {
  const [view, setView] = useState<"menu" | "checkout" | "tracking">("menu");
  
  const [cart, setCart] = useState<Record<string, number>>({
    "pho_beef": 1
  });
  
  const updateQty = (id: string, delta: number) => {
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, current + delta);
      if (next === 0) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: next };
    });
  };

  const cartItems = useMemo(() => {
    const items: OrderItem[] = [];
    MENU_CATEGORIES.forEach(cat => {
      cat.items.forEach(item => {
        if (cart[item.id]) {
          items.push({ id: item.id, name: item.name, price: item.price, qty: cart[item.id] });
        }
      });
    });
    return items;
  }, [cart]);

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

  const reset = () => {
    abortRef.current?.abort();
    setEvents([]);
    setStepStatuses({});
    setResult(null);
    setCompensations([]);
    setCurrentOrderId(null);
  };

  const handleBack = () => {
    if (view === "checkout") setView("menu");
    if (view === "tracking") {
      reset();
      setView("menu");
      setCart({});
    }
  };

  const placeOrder = useCallback(async () => {
    reset();
    setRunning(true);
    setView("tracking");

    const orderId = `ord_${Date.now().toString(36)}`;
    setCurrentOrderId(orderId);

    const input: OrderInput = {
      orderId,
      customerName,
      address,
      items: cartItems,
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
      // abort or network error
    } finally {
      setRunning(false);
    }
  }, [cartItems, customerName, address, failAt, autoAck]);

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
            void resumeHook(
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

  const resumeHook = async (
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

  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  return (
    <div className={`min-h-screen bg-gray-50/50 ${inter.className}`}>
      <TopNav 
        view={view} 
        onBack={handleBack} 
        cartCount={cartCount}
        address={address}
        onCartClick={() => setView('checkout')}
      />

      {view === "menu" && (
        <MenuView 
          cart={cart}
          updateQty={updateQty}
          onCheckout={() => setView("checkout")}
        />
      )}

      {view === "checkout" && (
        <CheckoutView
          cartItems={cartItems}
          customerName={customerName}
          setCustomerName={setCustomerName}
          address={address}
          setAddress={setAddress}
          failAt={failAt}
          setFailAt={setFailAt}
          autoAck={autoAck}
          setAutoAck={setAutoAck}
          onPlaceOrder={placeOrder}
          running={running}
        />
      )}

      {view === "tracking" && (
        <TrackingView
          orderId={currentOrderId}
          stepStatuses={stepStatuses}
          events={events}
          result={result}
          compensations={compensations}
          onResumeHook={resumeHook}
          autoAck={autoAck}
        />
      )}
    </div>
  );
}
