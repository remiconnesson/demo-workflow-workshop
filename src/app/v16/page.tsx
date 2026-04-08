"use client";

import React, { useState, useEffect, useRef } from "react";
import { Press_Start_2P, VT323 } from "next/font/google";

const pressStart = Press_Start_2P({ weight: "400", subsets: ["latin"], display: "swap" });
const vt323 = VT323({ weight: "400", subsets: ["latin"], display: "swap" });

// Types
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

type AppStatus = 'idle' | 'ordering' | 'completed' | 'rolled_back';

// Data
const DONUTS = [
  { id: "deployer", name: "The Deployer", price: 3.00, desc: "Classic triangle-cut glazed" },
  { id: "edge", name: "Edge Runtime", price: 3.50, desc: "Spicy jalapeño glaze" },
  { id: "cold", name: "Cold Start", price: 3.00, desc: "Vanilla frost triangle" },
  { id: "hot", name: "Hot Module", price: 4.00, desc: "Molten chocolate core" },
  { id: "serverless", name: "Serverless Sprinkle", price: 3.50, desc: "Rainbow triangles" },
  { id: "hydration", name: "Hydration Hole", price: 3.00, desc: "Water-glazed ring cut into a triangle" },
];

const STEPS = ["validateOrder", "chargePayment", "notifyRestaurant", "assignDriver", "trackDelivery", "sendReceipt"];

export default function TriangleArcadeDemo() {
    const [cart, setCart] = useState<Record<string, number>>({});
    const [name, setName] = useState("PLAYER 1");
    const [address, setAddress] = useState("SECTOR 7G");
    
    const [status, setStatus] = useState<AppStatus>('idle');
    const [events, setEvents] = useState<OrderEvent[]>([]);
    const [runId, setRunId] = useState("");
    const [orderId, setOrderId] = useState("");
    
    const [failAt, setFailAt] = useState<FailStep>(null);
    const [autoAck, setAutoAck] = useState(false);
    const [waitingHook, setWaitingHook] = useState<{ step: string; token: string } | null>(null);

    const feedRef = useRef<HTMLDivElement>(null);

    const updateCart = (id: string, delta: number) => {
        setCart(prev => ({
            ...prev,
            [id]: Math.max(0, (prev[id] || 0) + delta)
        }));
    };

    const cartTotal = Object.entries(cart).reduce((acc, [id, qty]) => {
        const item = DONUTS.find(d => d.id === id);
        return acc + (item ? item.price * qty : 0);
    }, 0);

    const placeOrder = async () => {
        if (Object.values(cart).every(qty => qty === 0)) {
            alert("CART IS EMPTY! INSERT COIN.");
            return;
        }
        const items = DONUTS.map(d => ({
            id: d.id,
            name: d.name,
            price: d.price,
            qty: cart[d.id] || 0
        })).filter(i => i.qty > 0);

        setEvents([]);
        setStatus('ordering');
        setWaitingHook(null);

        try {
            const res = await fetch('/api/orders/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    orderId: `TRG-${Math.floor(Math.random()*10000)}`,
                    customerName: name,
                    address: address,
                    items,
                    failAt,
                    autoAck
                })
            });
            const data = await res.json();
            setRunId(data.runId);
            setOrderId(data.orderId);

            const streamRes = await fetch(`/api/runs/${data.runId}/stream`);
            const reader = streamRes.body?.getReader();
            if (!reader) return;
            const decoder = new TextDecoder();
            let buffer = '';
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                    if (!line.trim()) continue;
                    try {
                        const event = JSON.parse(line) as OrderEvent;
                        setEvents(prev => [...prev, event]);
                        
                        if (event.type === 'waiting_for_hook') {
                            setWaitingHook({ step: event.step, token: event.token });
                        } else if (event.type === 'hook_resolved') {
                            setWaitingHook(null);
                        } else if (event.type === 'done') {
                            setStatus(event.status);
                        }
                    } catch (err) {
                        console.error('Failed to parse NDJSON line:', line);
                    }
                }
            }
        } catch (e) {
            console.error("Order failed", e);
            setStatus('idle');
        }
    };

    const resolveHook = async (accepted: boolean) => {
        if (!waitingHook || !orderId) return;
        let kind = 'delivered';
        if (waitingHook.step === 'notifyRestaurant') kind = 'restaurant-accept';
        if (waitingHook.step === 'assignDriver') kind = 'driver-accept';

        try {
            await fetch(`/api/orders/${orderId}/resume`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ kind, accepted })
            });
            setWaitingHook(null);
        } catch (e) {
            console.error("Failed to resolve hook", e);
        }
    };

    const resetOrder = () => {
        setCart({});
        setStatus('idle');
        setEvents([]);
        setRunId('');
        setOrderId('');
        setWaitingHook(null);
    };

    // Auto-ack effect
    useEffect(() => {
        if (autoAck && waitingHook && orderId) {
            const timer = setTimeout(() => {
                let kind = 'delivered';
                if (waitingHook.step === 'notifyRestaurant') kind = 'restaurant-accept';
                if (waitingHook.step === 'assignDriver') kind = 'driver-accept';

                fetch(`/api/orders/${orderId}/resume`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ kind, accepted: true })
                }).then(() => {
                    setWaitingHook(null);
                }).catch(e => console.error(e));
            }, 800);
            return () => clearTimeout(timer);
        }
    }, [autoAck, waitingHook, orderId]);

    // Feed auto-scroll
    useEffect(() => {
        if (feedRef.current) {
            feedRef.current.scrollTop = feedRef.current.scrollHeight;
        }
    }, [events]);

    return (
        <div className="min-h-screen bg-[#0a0014] text-white font-mono overflow-x-hidden relative flex flex-col items-center py-12 px-4 z-0">
            <style dangerouslySetInnerHTML={{__html: `
                .retro-scrollbar::-webkit-scrollbar { width: 10px; height: 10px; }
                .retro-scrollbar::-webkit-scrollbar-track { background: #0a0014; border-left: 2px solid #555; }
                .retro-scrollbar::-webkit-scrollbar-thumb { background: #ffee00; border: 2px solid #0a0014; }
                
                @keyframes grid-move {
                    0% { background-position: 0 0; }
                    100% { background-position: 0 60px; }
                }
                .retro-grid {
                    background-image: 
                        linear-gradient(to bottom, transparent 48%, rgba(255, 43, 214, 0.4) 50%, transparent 52%),
                        linear-gradient(to right, transparent 48%, rgba(0, 229, 255, 0.2) 50%, transparent 52%);
                    background-size: 60px 60px;
                    transform: perspective(500px) rotateX(60deg) scale(2) translateY(100px);
                    transform-origin: bottom;
                    animation: grid-move 2s linear infinite;
                }
            `}} />

            <div className="fixed inset-0 pointer-events-none z-[-1] retro-grid"></div>
            <div className="fixed top-0 left-0 right-0 h-1/2 bg-gradient-to-b from-[#0a0014] to-transparent pointer-events-none z-[-1]"></div>

            <div className="w-full flex flex-col items-center z-10 gap-12 mt-4 xl:mt-8">
                <div className="w-full text-center">
                    <h1 className="text-4xl md:text-6xl text-[#ff2bd6]" style={{ ...pressStart.style, textShadow: '4px 4px 0 #00e5ff' }}>TRIANGLE DONUTS</h1>
                    <p className="text-[#ffee00] text-xl md:text-3xl mt-4 drop-shadow-[0_0_10px_rgba(255,238,0,0.8)]" style={vt323.style}>-- SAGA PROTOCOL SYSTEM --</p>
                </div>
                
                <div className="w-full max-w-[1400px] flex flex-col xl:flex-row gap-12 items-start justify-center">
                    
                    {/* Gameboy Phone Mockup */}
                    <div className="relative w-[380px] h-[780px] bg-[#d3d3d3] rounded-[20px] rounded-br-[80px] shadow-[20px_20px_0px_rgba(0,0,0,0.6),inset_-5px_-5px_15px_rgba(0,0,0,0.2)] border-4 border-[#a9a9a9] flex flex-col items-center p-6 z-10 shrink-0 mx-auto">
                        <div className="w-full h-[460px] bg-[#555] rounded-t-[10px] rounded-b-[40px] p-4 flex flex-col shadow-[inset_0_0_10px_rgba(0,0,0,0.8)]">
                            <div className="w-full flex justify-between px-2 mb-2">
                                <div className="text-[10px] text-[#ff2bd6] animate-pulse" style={pressStart.style}>BAT: ████</div>
                                <div className="text-[10px] text-[#00e5ff]" style={pressStart.style}>SIG: ■■■</div>
                            </div>
                            <div className="w-full h-full bg-[#0a0014] border-4 border-[#222] shadow-[inset_0_0_20px_rgba(0,229,255,0.2)] overflow-y-auto overflow-x-hidden relative p-3 text-[#00e5ff] retro-scrollbar flex flex-col">
                                {!runId ? (
                                    <div className="flex flex-col gap-6" style={vt323.style}>
                                        <div className="text-center bg-[#ff2bd6] text-black py-1 -mx-3 border-y-2 border-white" style={pressStart.style}>
                                            <span className="text-[10px] animate-pulse">INSERT COIN TO ORDER</span>
                                        </div>
                                        
                                        <div className="flex flex-col gap-4">
                                            {DONUTS.map(d => (
                                                <div key={d.id} className="border border-[#00e5ff] bg-[#00e5ff]/10 p-2 flex flex-col">
                                                    <div className="flex justify-between items-start text-xl font-bold text-white">
                                                        <span>{d.name}</span>
                                                        <span className="text-[#ffee00]">${d.price.toFixed(2)}</span>
                                                    </div>
                                                    <div className="text-sm opacity-80 mt-1 mb-2">{d.desc}</div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-lg">QTY: {cart[d.id] || 0}</span>
                                                        <div className="flex gap-2">
                                                            <button onClick={() => updateCart(d.id, -1)} className="w-8 h-8 bg-transparent border-2 border-[#ff2bd6] text-[#ff2bd6] flex items-center justify-center font-bold hover:bg-[#ff2bd6] hover:text-black transition-colors">-</button>
                                                            <button onClick={() => updateCart(d.id, 1)} className="w-8 h-8 bg-transparent border-2 border-[#00e5ff] text-[#00e5ff] flex items-center justify-center font-bold hover:bg-[#00e5ff] hover:text-black transition-colors">+</button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex flex-col gap-2">
                                            <input value={name} onChange={e=>setName(e.target.value)} className="bg-transparent border-2 border-[#ffee00] text-[#ffee00] p-2 text-xl outline-none placeholder:text-[#ffee00]/30" placeholder="NAME" />
                                            <input value={address} onChange={e=>setAddress(e.target.value)} className="bg-transparent border-2 border-[#ffee00] text-[#ffee00] p-2 text-xl outline-none placeholder:text-[#ffee00]/30" placeholder="LOCATION" />
                                        </div>

                                        <div className="flex justify-between items-center border-t-2 border-white pt-2 mt-2">
                                            <span className="text-2xl text-white">TOTAL:</span>
                                            <span className="text-2xl text-[#ffee00]">${cartTotal.toFixed(2)}</span>
                                        </div>

                                        <button onClick={placeOrder} className="bg-[#ff2bd6] text-black py-4 text-xl hover:bg-white hover:text-black hover:scale-105 transition-transform" style={pressStart.style}>
                                            START
                                        </button>
                                    </div>
                                ) : (
                                    <div className="flex flex-col h-full gap-4" style={vt323.style}>
                                        <div className="text-center bg-[#ffee00] text-black py-1 -mx-3 border-y-2 border-white" style={pressStart.style}>
                                            <span className="text-[10px]">TRACKING</span>
                                        </div>
                                        
                                        <div className="flex-1 flex flex-col gap-4">
                                            <div className="text-center text-[#ff2bd6] text-3xl font-bold animate-pulse mt-2">
                                                {status === 'idle' ? 'PREPARING...' : status === 'completed' ? '1-UP! ENJOY!' : status === 'rolled_back' ? 'GAME OVER' : 'WAVE IN PROGRESS'}
                                            </div>
                                            <div className="text-center text-xl text-white opacity-80 min-h-[60px] flex items-center justify-center">
                                                {(events[events.length - 1] as any)?.label || 'INITIALIZING...'}
                                            </div>

                                            <div className="flex flex-col gap-3 mt-4 px-2">
                                                {STEPS.map(s => {
                                                    const stepEvent = events.find(e => (e as any).step === s && e.type.startsWith('step_'));
                                                    let color = '#555';
                                                    let label = '[ ]';
                                                    if (stepEvent) {
                                                        if (stepEvent.type === 'step_succeeded') { color = '#00e5ff'; label = '[X]'; }
                                                        else if (stepEvent.type === 'step_failed') { color = '#ff0000'; label = '[!]'; }
                                                        else if (stepEvent.type === 'step_running' || stepEvent.type === 'waiting_for_hook') { color = '#ffee00'; label = '[~]'; }
                                                        else if (stepEvent.type === 'step_skipped') { color = '#555'; label = '[-]'; }
                                                    }
                                                    return (
                                                        <div key={s} className="flex gap-4 items-center text-xl" style={{ color }}>
                                                            <span className="w-8">{label}</span>
                                                            <span className={color === '#ffee00' ? 'animate-pulse' : ''}>{s}</span>
                                                        </div>
                                                    )
                                                })}
                                            </div>
                                        </div>

                                        {(status === 'completed' || status === 'rolled_back') && (
                                            <button onClick={resetOrder} className="bg-transparent border-2 border-white text-white py-3 hover:bg-white hover:text-black mt-auto" style={pressStart.style}>
                                                NEW GAME
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="w-full flex justify-start pl-4 mt-2">
                            <div className="text-[#ff2bd6] text-xl font-bold tracking-widest italic drop-shadow-[1px_1px_0_#fff]" style={pressStart.style}>
                                TRI-BOY<span className="text-[#00e5ff]"> COLOR</span>
                            </div>
                        </div>

                        <div className="w-full flex-1 flex justify-between items-center px-4 mt-8 relative">
                            <div className="relative w-28 h-28 drop-shadow-[4px_4px_0_rgba(0,0,0,0.4)]">
                                <div className="absolute top-9 left-0 w-10 h-10 bg-[#333] rounded-l-sm border-t-2 border-l-2 border-b-2 border-[#555]"></div>
                                <div className="absolute top-9 right-0 w-10 h-10 bg-[#333] rounded-r-sm border-t-2 border-r-2 border-b-2 border-[#555]"></div>
                                <div className="absolute top-0 left-9 w-10 h-10 bg-[#333] rounded-t-sm border-t-2 border-l-2 border-r-2 border-[#555]"></div>
                                <div className="absolute bottom-0 left-9 w-10 h-10 bg-[#333] rounded-b-sm border-b-2 border-l-2 border-r-2 border-[#555]"></div>
                                <div className="absolute top-9 left-9 w-10 h-10 bg-[#333]"></div>
                                <div className="absolute top-13 left-13 w-2 h-2 rounded-full bg-[#222] shadow-inner"></div>
                            </div>

                            <div className="flex gap-4 transform -rotate-12 mt-8">
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-14 h-14 rounded-full bg-[#ff2bd6] shadow-[2px_6px_0_#9e007e,inset_-2px_-2px_6px_rgba(0,0,0,0.3)] active:translate-y-[4px] active:shadow-[2px_2px_0_#9e007e] cursor-pointer"></div>
                                    <div className="text-[#555] text-xs font-bold" style={pressStart.style}>B</div>
                                </div>
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-14 h-14 rounded-full bg-[#ffee00] shadow-[2px_6px_0_#b3a600,inset_-2px_-2px_6px_rgba(0,0,0,0.3)] active:translate-y-[4px] active:shadow-[2px_2px_0_#b3a600] cursor-pointer"></div>
                                    <div className="text-[#555] text-xs font-bold" style={pressStart.style}>A</div>
                                </div>
                            </div>
                        </div>

                        <div className="w-full flex justify-center gap-6 mt-4 pb-4">
                            <div className="w-12 h-3 bg-[#555] rounded-full transform -rotate-12 shadow-[inset_1px_2px_2px_rgba(0,0,0,0.4)]"></div>
                            <div className="w-12 h-3 bg-[#555] rounded-full transform -rotate-12 shadow-[inset_1px_2px_2px_rgba(0,0,0,0.4)]"></div>
                        </div>
                    </div>

                    {/* Dashboard */}
                    <div className="flex-1 w-full max-w-5xl z-10 flex flex-col gap-6">
                        <div className="border-4 border-[#00e5ff] bg-[#0a0014]/90 p-6 relative shadow-[0_0_20px_rgba(0,229,255,0.4)]">
                            <div className="absolute -top-3 left-4 px-2 py-1 bg-[#00e5ff] text-black text-[10px]" style={pressStart.style}>SAGA VISUALIZER</div>
                            <div className="mt-4 flex gap-4 overflow-x-auto py-8 px-4 items-center justify-between min-h-[160px] retro-scrollbar">
                                {STEPS.map((step, idx) => {
                                    const isRunning = events.some(e => (e as any).step === step && e.type === 'step_running') && !events.some(e => (e as any).step === step && (e.type === 'step_succeeded' || e.type === 'step_failed' || e.type === 'step_skipped'));
                                    const isWaiting = events.some(e => (e as any).step === step && e.type === 'waiting_for_hook') && !events.some(e => (e as any).step === step && e.type === 'hook_resolved');
                                    const isSuccess = events.some(e => (e as any).step === step && e.type === 'step_succeeded');
                                    const isFailed = events.some(e => (e as any).step === step && e.type === 'step_failed');
                                    const isSkipped = events.some(e => (e as any).step === step && e.type === 'step_skipped');
                                    const isCompensated = events.some(e => (e as any).forStep === step && e.type === 'compensation_pushed');

                                    let borderClass = 'border-[#555] text-[#555] shadow-none';
                                    let bgClass = 'bg-transparent';
                                    let animClass = '';
                                    let icon = '△';

                                    if (isRunning) {
                                        borderClass = 'border-[#ffee00] text-[#ffee00] shadow-[0_0_15px_#ffee00]';
                                        animClass = 'animate-pulse scale-110';
                                    } else if (isWaiting) {
                                        borderClass = 'border-[#ffee00] text-[#ffee00] border-dashed shadow-[0_0_15px_#ffee00]';
                                        animClass = 'animate-bounce scale-110';
                                        icon = '▲';
                                    } else if (isSuccess) {
                                        borderClass = 'border-[#00e5ff] text-[#00e5ff] shadow-[0_0_10px_#00e5ff]';
                                        bgClass = 'bg-[#00e5ff]/20';
                                        icon = '▲';
                                    } else if (isFailed) {
                                        borderClass = 'border-[#ff0000] text-[#ff0000] shadow-[0_0_15px_#ff0000]';
                                        bgClass = 'bg-[#ff0000]/20';
                                        animClass = 'animate-pulse';
                                        icon = '▼';
                                    } else if (isSkipped) {
                                        borderClass = 'border-[#555] text-[#555] opacity-50';
                                        icon = '–';
                                    }

                                    if (isCompensated) {
                                        borderClass = 'border-[#ff2bd6] text-[#ff2bd6] shadow-[0_0_15px_#ff2bd6]';
                                        bgClass = 'bg-[#ff2bd6]/20';
                                        icon = '◀';
                                    }

                                    return (
                                        <React.Fragment key={step}>
                                            <div className={`relative flex flex-col items-center justify-center w-20 h-20 md:w-24 md:h-24 border-4 transition-all duration-300 shrink-0 ${borderClass} ${bgClass} ${animClass}`}>
                                                <span className="text-4xl">{icon}</span>
                                                <span className="absolute -bottom-8 text-[8px] md:text-[10px] whitespace-nowrap text-white" style={pressStart.style}>{step}</span>
                                            </div>
                                            {idx < STEPS.length - 1 && (
                                                <div className={`h-1 w-6 md:w-12 shrink-0 ${isSuccess ? 'bg-[#00e5ff] shadow-[0_0_5px_#00e5ff]' : 'bg-[#555]'}`} />
                                            )}
                                        </React.Fragment>
                                    )
                                })}
                            </div>
                        </div>

                        <div className="flex flex-col xl:flex-row gap-6 items-stretch">
                            {/* OPERATOR CONTROLS */}
                            <div className="border-4 border-[#ff2bd6] bg-[#0a0014]/90 p-6 flex-1 flex flex-col gap-4 relative shadow-[0_0_20px_rgba(255,43,214,0.4)] min-w-[320px]">
                                <div className="absolute -top-3 left-4 px-2 py-1 bg-[#ff2bd6] text-black text-[10px]" style={pressStart.style}>OPERATOR CONTROLS</div>
                                
                                <div className="mt-2 flex flex-col gap-6 text-[#00e5ff]" style={vt323.style}>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex flex-col gap-2 text-2xl text-[#ffee00]">
                                            <span>SCENARIO (FAIL AT):</span>
                                            <select value={failAt || ''} onChange={e => setFailAt(e.target.value as FailStep || null)} className="bg-[#0a0014] border-2 border-[#ffee00] p-3 text-[#ffee00] outline-none cursor-pointer">
                                                <option value="">-- NONE (PERFECT RUN) --</option>
                                                {STEPS.map(s => <option key={s} value={s}>{s}</option>)}
                                            </select>
                                        </label>
                                    </div>
                                    
                                    <label className="flex items-center gap-3 cursor-pointer text-2xl text-white group w-max">
                                        <div className={`w-8 h-8 flex items-center justify-center border-2 ${autoAck ? 'bg-[#ff2bd6] border-[#ff2bd6]' : 'bg-transparent border-[#555]'}`}>
                                            {autoAck && <span className="text-black leading-none pb-1 font-bold">x</span>}
                                        </div>
                                        <input type="checkbox" checked={autoAck} onChange={e => setAutoAck(e.target.checked)} className="hidden" />
                                        AUTO-ACKNOWLEDGE
                                    </label>

                                    <div className="mt-2 border-2 border-[#555] p-4 flex flex-col gap-2 min-h-[140px]">
                                        <div className="text-white mb-2" style={pressStart.style}>
                                            <span className="text-[10px]">MANUAL OVERRIDE</span>
                                        </div>
                                        {!waitingHook ? (
                                            <div className="text-[#555] text-2xl flex-1 flex items-center">NO PENDING HOOKS...</div>
                                        ) : (
                                            <div className="flex flex-col gap-4 mt-2">
                                                <div className="text-[#ffee00] text-2xl animate-pulse">WAITING: {waitingHook.step}</div>
                                                <div className="flex gap-4">
                                                    <button onClick={() => resolveHook(true)} className="flex-1 bg-transparent border-2 border-[#00e5ff] text-[#00e5ff] p-2 text-2xl hover:bg-[#00e5ff] hover:text-black transition-colors">ACCEPT (Y)</button>
                                                    <button onClick={() => resolveHook(false)} className="flex-1 bg-transparent border-2 border-[#ff0000] text-[#ff0000] p-2 text-2xl hover:bg-[#ff0000] hover:text-black transition-colors">REJECT (N)</button>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {status === 'rolled_back' && (
                                        <div className="mt-2 border-2 border-[#ff2bd6] p-4 flex flex-col gap-2">
                                            <div className="text-[#ff2bd6] text-[10px] mb-2" style={pressStart.style}>COMPENSATIONS</div>
                                            {events.filter(e => e.type === 'compensation_pushed' || e.type === 'compensated').map((e, i) => (
                                                <div key={i} className="text-2xl text-white">
                                                    {e.type === 'compensated' ? <span className="text-[#00e5ff]">[✓]</span> : <span className="text-[#555]">[ ]</span>} {e.action}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* EVENT LOG */}
                            <div className="border-4 border-[#ffee00] bg-[#0a0014]/90 p-6 flex-1 flex flex-col relative shadow-[0_0_20px_rgba(255,238,0,0.4)] h-[500px] xl:h-auto">
                                <div className="absolute -top-3 left-4 px-2 py-1 bg-[#ffee00] text-black text-[10px]" style={pressStart.style}>EVENT LOG</div>
                                <div className="mt-2 overflow-y-auto flex-1 flex flex-col gap-1 text-xl text-[#00e5ff] retro-scrollbar" style={vt323.style} ref={feedRef}>
                                    {events.length === 0 && <div className="opacity-50 mt-4 animate-pulse">AWAITING CONNECTION...</div>}
                                    {events.map((e, i) => (
                                        <div key={i} className="font-mono break-all">
                                            <span className="text-[#555]">{`> `}</span>
                                            {e.type === 'log' ? <span className="text-white">{e.message}</span> : 
                                            e.type.startsWith('step_failed') ? <span className="text-[#ff0000]">{JSON.stringify(e)}</span> :
                                            e.type.startsWith('compensation') ? <span className="text-[#ff2bd6]">{JSON.stringify(e)}</span> :
                                            <span className="text-[#00e5ff] opacity-80">{JSON.stringify(e)}</span>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
