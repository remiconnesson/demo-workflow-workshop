'use client';

import React, { useState, useEffect } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';

const geist = Geist({ subsets: ['latin'] });
const geistMono = Geist_Mono({ subsets: ['latin'] });

// Types
type OrderItem = { id: string; name: string; price: number; qty: number; desc: string };
type FailStep = "validateOrder" | "chargeCard" | "pingRestaurant" | "findDriver" | "trackDelivery" | "sendReceipts" | null;

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

const MENU_ITEMS: OrderItem[] = [
  { id: 'deployer', name: 'The Deployer', price: 5, qty: 0, desc: 'A classic ring with Vercel black glaze.' },
  { id: 'edge', name: 'Edge Runtime', price: 4, qty: 0, desc: 'Crispy on the outside, executes fast.' },
  { id: 'cold', name: 'Cold Start', price: 3, qty: 0, desc: 'Chilled vanilla cream center.' },
  { id: 'hmr', name: 'Hot Module', price: 6, qty: 0, desc: 'Spicy cinnamon sugar dust.' },
  { id: 'serverless', name: 'Serverless Sprinkle', price: 4.5, qty: 0, desc: 'Infinitely scaling sprinkles.' },
  { id: 'isr', name: 'ISR Glaze', price: 5.5, qty: 0, desc: 'Stays fresh in the background.' },
];

const TriangleDivider = () => (
  <div className="w-full overflow-hidden text-zinc-800 text-2xl tracking-[0.3em] whitespace-nowrap select-none my-8 opacity-50 flex items-center justify-center">
    {'▲'.repeat(80)}
  </div>
);

const PointedButton = ({ onClick, children, variant = 'primary', disabled = false }: any) => {
  const base = "relative font-bold py-6 px-10 text-2xl transition-all duration-200 outline-none uppercase tracking-wider text-center flex items-center justify-center";
  const styles = variant === 'primary' 
    ? "bg-white text-black hover:bg-zinc-200 disabled:opacity-50" 
    : variant === 'danger'
    ? "bg-red-600 text-white hover:bg-red-500 disabled:opacity-50"
    : variant === 'secondary'
    ? "bg-zinc-800 text-white hover:bg-zinc-700 disabled:opacity-50"
    : "bg-transparent text-white border-4 border-white hover:bg-white hover:text-black disabled:opacity-50";

  return (
    <button 
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles}`}
      style={{ clipPath: 'polygon(0% 0%, calc(100% - 30px) 0%, 100% 50%, calc(100% - 30px) 100%, 0% 100%)' }}
    >
      <span className="pr-4 whitespace-nowrap">{children}</span>
    </button>
  );
};

export default function TriangleDonutsV28() {
  const [cart, setCart] = useState<OrderItem[]>(MENU_ITEMS);
  const [customerName, setCustomerName] = useState('Guillermo R.');
  const [address, setAddress] = useState('340 S Lemon Ave, Walnut, CA');
  const [failAt, setFailAt] = useState<FailStep>(null);
  const [autoAck, setAutoAck] = useState(true);

  const [orderState, setOrderState] = useState<'idle'|'ordering'|'running'|'done'>('idle');
  const [events, setEvents] = useState<OrderEvent[]>([]);
  const [runId, setRunId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [waitingHooks, setWaitingHooks] = useState<{step: string, token: string}[]>([]);

  // auto-ack logic
  useEffect(() => {
    if (!autoAck) return;
    const hooksToAck = waitingHooks.filter(h => !events.some(e => e.type === 'hook_resolved' && (e as any).step === h.step));
    
    hooksToAck.forEach(hook => {
      let kind = '';
      if (hook.step === 'notifyRestaurant') kind = 'restaurant-accept';
      else if (hook.step === 'assignDriver') kind = 'driver-accept';
      else if (hook.step === 'trackDelivery') kind = 'delivered';
      
      if (kind) {
        const timer = setTimeout(() => {
          resumeHook(kind, true);
        }, 1500);
        return () => clearTimeout(timer);
      }
    });
  }, [waitingHooks, autoAck, events]);

  const updateQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, qty: Math.max(0, item.qty + delta) } : item));
  };

  const total = cart.reduce((acc, item) => acc + item.price * item.qty, 0);

  const placeOrder = async () => {
    if (total === 0) return alert('Cart is empty!');
    setOrderState('ordering');
    setEvents([]);
    setWaitingHooks([]);
    
    const reqOrderId = `ORD-TRI-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    setOrderId(reqOrderId);

    try {
      const res = await fetch('/api/orders/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderId: reqOrderId,
          customerName,
          address,
          items: cart.filter(i => i.qty > 0),
          failAt,
          autoAck,
        }),
      });

      const data = await res.json();
      setRunId(data.runId);
      setOrderState('running');

      const streamRes = await fetch(`/api/runs/${data.runId}/stream`);
      const reader = streamRes.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            if (line.trim()) {
              const ev = JSON.parse(line) as OrderEvent;
              setEvents(prev => [...prev, ev]);
              if (ev.type === 'waiting_for_hook') {
                setWaitingHooks(prev => [...prev, { step: ev.step, token: ev.token }]);
              }
              if (ev.type === 'done') {
                setOrderState('done');
              }
            }
          }
        }
      }
    } catch (err) {
      console.error(err);
      setOrderState('idle');
    }
  };

  const resumeHook = async (kind: string, accepted: boolean) => {
    try {
      await fetch(`/api/orders/${orderId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, accepted, reason: accepted ? undefined : 'Manually rejected' })
      });
      setWaitingHooks(prev => prev.filter(h => {
        if (kind === 'restaurant-accept' && h.step === 'notifyRestaurant') return false;
        if (kind === 'driver-accept' && h.step === 'assignDriver') return false;
        if (kind === 'delivered' && h.step === 'trackDelivery') return false;
        return true;
      }));
    } catch (err) {
      console.error(err);
    }
  };

  const renderPhone = () => {
    if (orderState === 'idle' || orderState === 'ordering') {
      return (
        <div className="flex flex-col h-full overflow-y-auto p-12 custom-scrollbar bg-black">
          <h2 className="text-6xl font-black mb-8 tracking-tighter uppercase text-white flex items-center gap-4">
            <span className="text-white text-5xl">▲</span> Menu
          </h2>
          
          <div className="space-y-8 mb-12">
            {cart.map(item => (
              <div key={item.id} className="flex flex-col gap-4 bg-zinc-900/50 p-6 rounded-xl border border-zinc-800">
                <div className="flex items-center gap-6">
                  <div className="w-24 h-24 bg-white text-black flex items-center justify-center text-4xl shrink-0" style={{ clipPath: 'polygon(50% 0, 100% 100%, 0 100%)' }}>
                    <span className="mt-4">🍩</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-3xl font-bold text-white leading-none mb-2">{item.name}</h3>
                    <p className="text-2xl font-mono text-zinc-300">${item.price.toFixed(2)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xl text-zinc-400 flex-1 pr-4 leading-tight">{item.desc}</p>
                  <div className="flex items-center gap-6 bg-black p-2 rounded-xl border border-zinc-800 shrink-0">
                    <button onClick={() => updateQty(item.id, -1)} className="w-16 h-16 bg-zinc-900 text-4xl font-bold rounded-lg hover:bg-zinc-800 transition-colors text-white flex items-center justify-center">-</button>
                    <span className="text-4xl font-black w-12 text-center text-white">{item.qty}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-16 h-16 bg-white text-black text-4xl font-bold rounded-lg hover:bg-zinc-200 transition-colors flex items-center justify-center">+</button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <TriangleDivider />

          <div className="space-y-8 mb-12">
            <div>
              <label className="block text-2xl font-bold text-zinc-400 mb-3 uppercase tracking-wider">Customer Name</label>
              <input 
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-xl p-6 text-3xl text-white outline-none focus:border-white transition-colors"
                value={customerName}
                onChange={e => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-2xl font-bold text-zinc-400 mb-3 uppercase tracking-wider">Delivery Address</label>
              <input 
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-xl p-6 text-3xl text-white outline-none focus:border-white transition-colors"
                value={address}
                onChange={e => setAddress(e.target.value)}
              />
            </div>
          </div>

          <div className="mt-auto bg-black p-8 rounded-2xl border-2 border-zinc-800 flex flex-col gap-6 sticky bottom-0 z-10 shadow-[0_-20px_40px_rgba(0,0,0,0.8)]">
            <div className="flex justify-between items-center text-4xl">
              <span className="font-bold text-zinc-400">Total</span>
              <span className="font-black text-white font-mono">${total.toFixed(2)}</span>
            </div>
            <PointedButton onClick={placeOrder} disabled={total === 0 || orderState === 'ordering'}>
              {orderState === 'ordering' ? 'Processing...' : 'Place Order'}
            </PointedButton>
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-full p-12 bg-black">
        <h2 className="text-6xl font-black mb-12 tracking-tighter uppercase text-white flex items-center gap-4 shrink-0">
          <span className="text-white text-5xl">▲</span> Tracking
        </h2>
        
        <div className="bg-zinc-900 p-8 rounded-2xl border-2 border-zinc-800 mb-12 shrink-0">
          <p className="text-2xl text-zinc-400 mb-2">Order ID</p>
          <p className="text-4xl font-mono font-bold text-white break-all">{orderId}</p>
        </div>

        <div className="flex-1 overflow-y-auto space-y-6 custom-scrollbar pb-12">
          {events.filter(e => e.type !== 'log').map((ev, i) => (
            <div key={i} className="flex gap-6 items-start">
              <div className="mt-2 shrink-0">
                {ev.type.includes('fail') ? (
                  <span className="text-3xl text-red-500">▼</span>
                ) : ev.type.includes('success') || ev.type === 'done' ? (
                  <span className="text-3xl text-white">▲</span>
                ) : ev.type.includes('wait') ? (
                  <span className="text-3xl text-yellow-500 animate-pulse">▲</span>
                ) : (
                  <span className="text-3xl text-zinc-500">▲</span>
                )}
              </div>
              <div className="bg-zinc-900/50 p-6 rounded-xl border border-zinc-800 flex-1 min-w-0">
                <p className="text-2xl font-bold text-white tracking-wide break-words">
                  {ev.type === 'done' ? `ORDER ${(ev as any).status.toUpperCase()}` : (ev as any).label || ev.type}
                </p>
                {(ev as any).error && (
                  <p className="text-xl text-red-400 mt-2 font-mono break-words">{(ev as any).error}</p>
                )}
              </div>
            </div>
          ))}
        </div>

        {orderState === 'done' && (
          <div className="mt-auto shrink-0 pt-8">
            <PointedButton onClick={() => setOrderState('idle')} variant="secondary">
              Start New Order
            </PointedButton>
          </div>
        )}
      </div>
    );
  };

  const SAGA_STEPS = [
    { id: 'validateOrder', label: 'Validate' },
    { id: 'chargePayment', label: 'Charge' },
    { id: 'notifyRestaurant', label: 'Kitchen' },
    { id: 'assignDriver', label: 'Driver' },
    { id: 'trackDelivery', label: 'Transit' },
    { id: 'sendReceipt', label: 'Receipt' },
  ];

  const getStepStatus = (stepId: string) => {
    const stepEvents = events.filter(e => (e as any).step === stepId);
    if (stepEvents.some(e => e.type === 'step_failed')) return 'failed';
    if (stepEvents.some(e => e.type === 'step_succeeded')) return 'success';
    if (stepEvents.some(e => e.type === 'step_skipped')) return 'skipped';
    if (stepEvents.some(e => e.type === 'waiting_for_hook')) return 'waiting';
    if (stepEvents.some(e => e.type === 'step_running')) return 'running';
    return 'pending';
  };

  return (
    <div className={`min-h-screen bg-black text-white ${geist.className} overflow-x-hidden pb-32 selection:bg-white selection:text-black`}>
      <svg className="fixed inset-0 w-full h-full pointer-events-none z-0">
        <defs>
          <pattern id="triangle-pattern" width="120" height="104" patternUnits="userSpaceOnUse">
            <path d="M60 0 L120 104 L0 104 Z" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#triangle-pattern)" />
      </svg>

      <div className="relative z-10 max-w-[1920px] mx-auto p-12 xl:p-24 flex flex-col xl:flex-row gap-24 items-start">
        
        {/* LEFT COLUMN: THE PHONE */}
        <div className="w-[600px] h-[1200px] flex-shrink-0 relative flex justify-center pt-24 drop-shadow-2xl mx-auto xl:mx-0">
          {/* Phone Case SVG */}
          <svg className="absolute inset-0 w-full h-full text-zinc-950 drop-shadow-[0_0_60px_rgba(255,255,255,0.05)]" viewBox="0 0 600 1200" fill="currentColor">
            <path d="M 30,30 L 570,30 Q 590,30 585,50 L 330,1150 Q 300,1190 270,1150 L 15,50 Q 10,30 30,30 Z" stroke="rgba(255,255,255,0.15)" strokeWidth="4" />
            <path d="M 50,60 L 550,60 Q 560,60 555,70 L 315,1120 Q 300,1150 285,1120 L 45,70 Q 40,60 50,60 Z" fill="#000" />
          </svg>
          
          {/* Screen Area */}
          <div className="relative z-10 w-[480px] h-[960px] rounded-[2.5rem] overflow-hidden flex flex-col bg-black border-[6px] border-zinc-900 mt-12 shadow-2xl">
            {renderPhone()}
          </div>
        </div>

        {/* RIGHT COLUMN: DASHBOARD */}
        <div className="flex-1 w-full min-w-0 flex flex-col gap-16">
          
          <header className="flex flex-col gap-6">
            <h1 className="text-8xl md:text-[140px] font-black tracking-tighter uppercase leading-none">
              Triangle<br/>Donuts
            </h1>
            <p className={`text-4xl text-zinc-400 ${geistMono.className}`}>Vercel Presentation Demo / v28</p>
          </header>

          <TriangleDivider />

          {/* DevTools Controls */}
          <div className="bg-zinc-950 border border-zinc-800 p-12 relative" style={{ clipPath: 'polygon(40px 0, 100% 0, calc(100% - 40px) 100%, 0 100%)' }}>
            <div className="flex flex-col lg:flex-row gap-12 items-start lg:items-center px-8">
              <div className="flex-1 w-full lg:w-auto">
                <label className="block text-2xl font-bold text-zinc-400 mb-4 uppercase tracking-widest">Simulate Failure</label>
                <select 
                  className="w-full bg-black border-2 border-zinc-800 p-6 text-3xl font-bold text-white outline-none appearance-none cursor-pointer hover:border-zinc-600 transition-colors"
                  value={failAt || ''}
                  onChange={e => setFailAt((e.target.value as FailStep) || null)}
                >
                  <option value="">None (Success)</option>
                  {SAGA_STEPS.map(s => <option key={s.id} value={s.id}>Fail at {s.label}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-8 pt-2">
                <label className="text-3xl font-bold text-zinc-400 uppercase tracking-widest cursor-pointer flex items-center gap-6 group hover:text-white transition-colors">
                  <div className={`w-20 h-20 border-4 flex items-center justify-center transition-colors ${autoAck ? 'border-white bg-white' : 'border-zinc-700 bg-transparent group-hover:border-zinc-500'}`}>
                    {autoAck && <span className="text-black text-5xl font-black">▲</span>}
                  </div>
                  Auto-Ack Hooks
                </label>
                <input 
                  type="checkbox" 
                  className="hidden"
                  checked={autoAck}
                  onChange={e => setAutoAck(e.target.checked)}
                />
              </div>
            </div>
          </div>

          {/* Saga Visualizer */}
          <div>
            <h3 className="text-5xl font-black uppercase tracking-widest mb-16 text-white px-8">Saga State</h3>
            <div className="flex flex-wrap items-center justify-start gap-y-24 pl-8">
              {SAGA_STEPS.map((step, i) => {
                const status = getStepStatus(step.id);
                const isUp = i % 2 === 0;
                
                let bg = 'bg-zinc-900';
                let border = 'border-zinc-800 border-[6px]';
                let text = 'text-zinc-500';
                
                if (status === 'success') { bg = 'bg-white'; text = 'text-black'; border = 'border-white border-[6px]'; }
                else if (status === 'failed') { bg = 'bg-red-600'; text = 'text-white'; border = 'border-red-600 border-[6px]'; }
                else if (status === 'running' || status === 'waiting') { bg = 'bg-black'; border = 'border-white border-[6px]'; text = 'text-white animate-pulse'; }
                else if (status === 'skipped') { bg = 'bg-transparent'; border = 'border-zinc-800 border-dashed border-[6px]'; text = 'text-zinc-600'; }

                const clip = isUp ? "polygon(50% 0%, 0% 100%, 100% 100%)" : "polygon(0% 0%, 100% 0%, 50% 100%)";
                
                return (
                  <div key={step.id} className="relative flex flex-col items-center ml-[-40px] first:ml-0 drop-shadow-2xl">
                    <div 
                      className={`w-[240px] h-[208px] transition-all duration-500 flex items-center justify-center ${bg} ${border}`}
                      style={{ clipPath: clip }}
                    >
                      <div className={`flex flex-col items-center ${isUp ? 'mt-8' : 'mb-8'}`}>
                        {status === 'success' && <span className="text-7xl text-black">✓</span>}
                        {status === 'failed' && <span className="text-7xl text-white">✕</span>}
                        {status === 'waiting' && <span className="text-7xl text-white">⏸</span>}
                      </div>
                    </div>
                    <div className={`absolute w-full text-center ${isUp ? '-bottom-16' : 'bottom-20'} pointer-events-none`}>
                      <span className={`text-3xl font-black uppercase tracking-wider bg-black/90 px-4 py-2 rounded ${text}`}>
                        {step.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <TriangleDivider />

          {/* Manual Hook Controls */}
          {waitingHooks.length > 0 && !autoAck && (
            <div className="bg-yellow-500/10 border-4 border-yellow-500 p-12 relative shadow-[0_0_40px_rgba(234,179,8,0.2)]" style={{ clipPath: 'polygon(0 0, 100% 0, calc(100% - 40px) 100%, 0 100%)' }}>
              <h3 className="text-5xl font-black uppercase tracking-widest mb-10 text-yellow-500">Awaiting Manual Action</h3>
              <div className="flex flex-wrap gap-8">
                {waitingHooks.some(h => h.step === 'notifyRestaurant') && (
                  <div className="flex gap-6 w-full lg:w-auto">
                    <PointedButton onClick={() => resumeHook('restaurant-accept', true)}>Accept Order</PointedButton>
                    <PointedButton onClick={() => resumeHook('restaurant-accept', false)} variant="danger">Reject</PointedButton>
                  </div>
                )}
                {waitingHooks.some(h => h.step === 'assignDriver') && (
                  <div className="flex gap-6 w-full lg:w-auto">
                    <PointedButton onClick={() => resumeHook('driver-accept', true)}>Driver Accepts</PointedButton>
                    <PointedButton onClick={() => resumeHook('driver-accept', false)} variant="danger">Driver Rejects</PointedButton>
                  </div>
                )}
                {waitingHooks.some(h => h.step === 'trackDelivery') && (
                  <div className="flex gap-6 w-full lg:w-auto">
                    <PointedButton onClick={() => resumeHook('delivered', true)}>Mark Delivered</PointedButton>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Event Feed */}
          <div className="flex-1 flex flex-col min-h-[600px]">
            <h3 className="text-5xl font-black uppercase tracking-widest mb-12 text-white px-8">Event Log</h3>
            <div className="bg-zinc-950 border-2 border-zinc-800 p-12 flex-1 overflow-y-auto custom-scrollbar space-y-6 shadow-2xl" style={{ clipPath: 'polygon(50px 0, 100% 0, calc(100% - 50px) 100%, 0 100%)' }}>
              <div className="px-8 py-4">
                {events.length === 0 && <p className="text-3xl text-zinc-600 font-mono">Waiting for events...</p>}
                {events.map((ev, i) => {
                  let color = 'text-zinc-500';
                  let icon = '▲';
                  if (ev.type.includes('fail') || ev.type === 'compensating' || ev.type === 'compensated') { color = 'text-red-500'; icon = '▼'; }
                  else if (ev.type.includes('success') || ev.type === 'done') { color = 'text-white'; }
                  else if (ev.type.includes('wait')) { color = 'text-yellow-500'; }

                  return (
                    <div key={i} className={`font-mono text-2xl py-4 flex items-start gap-8 border-b-2 border-zinc-800/50 last:border-0 ${geistMono.className}`}>
                      <span className={`${color} text-3xl mt-1 shrink-0`}>{icon}</span>
                      <div className="flex-1 break-words leading-relaxed">
                        <span className="text-zinc-400 font-bold">[{new Date().toISOString().split('T')[1].slice(0,-1)}] </span>
                        <span className={`font-bold ${color} mr-6`}>{ev.type.toUpperCase()}</span>
                        <span className="text-zinc-300">
                          {ev.type === 'log' ? ev.message : (ev as any).label || (ev as any).action || ''}
                        </span>
                        {(ev as any).detail && <span className="text-zinc-50 ml-6 block mt-2 opacity-80">→ {(ev as any).detail}</span>}
                        {(ev as any).error && <span className="text-red-400 ml-6 block mt-2 font-bold">→ {(ev as any).error}</span>}
                        {ev.type === 'done' && <span className="text-white ml-6 block mt-2 font-bold text-3xl">→ STATUS: {ev.status.toUpperCase()}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

        </div>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 16px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0,0,0,0.5);
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #3f3f46;
          border-radius: 8px;
          border: 4px solid black;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #71717a;
        }
      `}} />
    </div>
  );
}
