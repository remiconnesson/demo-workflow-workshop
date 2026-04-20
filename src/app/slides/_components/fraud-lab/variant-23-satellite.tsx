"use client";

import { useMemo } from "react";
import { AgentDebugDrawer, type DebugEvent } from "../agent-debug-drawer";
import {
  CHARGES,
  FRAUD_CARD,
  FRAUD_MERCHANT,
  FRAUD_REASON,
  FRAUD_COUNTRY,
  STARTING_LOOP,
  TopStrip,
  IdleHint,
  CrashOverlay,
  ReplayingChip,
  ResumedBanner,
  KillButton,
  usePhaseMachine,
  useElapsed,
} from "./_shared";

// ---------------------------------------------------------------------------
// Variant 23 · Satellite
// Night Earth, dark-blue→black radial. 11 city dots scattered at deterministic
// lat/lon. Satellite orbits at constant rate (CSS rotate). Each tick a beam
// fires from the satellite down to a city and back, city glows briefly. On
// the fraud frame the beam from Moscow turns red and the satellite LOCKS in
// position above it. Kill → satellite & Earth go dark. Replay → satellite
// powers back on, still locked. Resume → emerald banner.
// ---------------------------------------------------------------------------

const FRAUD_IDX = CHARGES.length - 1;
const BEAM_CADENCE_MS = 700;

// Cities — deterministic (lat/lon-ish in % of viewbox). Moscow is last;
// matches FRAUD_COUNTRY="RU".
type City = { name: string; code: string; angleDeg: number; radius: number };
const CITIES: City[] = [
  { name: "San Francisco", code: "SFO", angleDeg: 240, radius: 0.58 },
  { name: "Dallas",        code: "DFW", angleDeg: 215, radius: 0.42 },
  { name: "New York",      code: "JFK", angleDeg: 195, radius: 0.55 },
  { name: "Reykjavik",     code: "KEF", angleDeg: 152, radius: 0.38 },
  { name: "London",        code: "LHR", angleDeg: 128, radius: 0.48 },
  { name: "Berlin",        code: "BER", angleDeg: 110, radius: 0.38 },
  { name: "Lagos",         code: "LOS", angleDeg: 95,  radius: 0.68 },
  { name: "Dubai",         code: "DXB", angleDeg: 70,  radius: 0.52 },
  { name: "Tokyo",         code: "HND", angleDeg: 30,  radius: 0.55 },
  { name: "Sydney",        code: "SYD", angleDeg: 355, radius: 0.78 },
  // fraud city — Moscow (RU)
  { name: "Moscow",        code: "SVO", angleDeg: 80,  radius: 0.30 },
];
const FRAUD_CITY_IDX = CITIES.length - 1;

function polar(angleDeg: number, radius: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: 50 + Math.cos(rad) * radius * 28,
    y: 50 + Math.sin(rad) * radius * 28,
  };
}

export function SatelliteDemo() {
  const m = usePhaseMachine({
    armedAfterMs: 7_500,
    crashHoldMs: 2_400,
    replayHoldMs: 1_800,
  });
  const elapsed = useElapsed(m.active);

  const rawTicks = Math.floor(elapsed / BEAM_CADENCE_MS);
  const locked = m.isArmed || m.isCrashed || m.isReplaying || m.isResumed;
  const ticks = locked ? FRAUD_IDX + 1 : Math.min(rawTicks, FRAUD_IDX + 1);
  const atFraud = ticks >= FRAUD_IDX;

  // City index this tick targets (deterministic by tick value, cycling).
  const beamCityIdx = atFraud
    ? FRAUD_CITY_IDX
    : ticks % FRAUD_CITY_IDX;

  // Satellite orbit angle. Locks pointing "above Moscow" when atFraud.
  const orbitAngle = atFraud
    ? CITIES[FRAUD_CITY_IDX].angleDeg
    : ((elapsed / 40) % 360);

  const scanned = 42_804_192 + Math.min(ticks, CHARGES.length) * 417;
  const frozen = 1_248 + (m.isResumed ? 1 : 0);
  const loop = STARTING_LOOP + (m.active ? 1 : 0);

  const debugEvents = useMemo<DebugEvent[]>(() => {
    const out: DebugEvent[] = [];
    if (m.phase === "idle") return out;
    out.push({ kind: "RUN", msg: "orbit(period: 94d)" });
    out.push({ kind: "RUN", msg: `beam(${CITIES[Math.min(beamCityIdx, CITIES.length - 1)].code})` });
    if (atFraud) {
      out.push({ kind: "CMP", msg: `assess(${CITIES[FRAUD_CITY_IDX].code} · ${FRAUD_COUNTRY} · 0.93)` });
      out.push({ kind: "WAI", msg: `hold · ${FRAUD_REASON}` });
    }
    if (m.isCrashed) out.push({ kind: "ERR", msg: "signal lost · satellite dark" });
    if (m.isReplaying) out.push({ kind: "RPL", msg: "power-on · lock cached" });
    if (m.isResumed) {
      out.push({ kind: "OK ", msg: `freezeAccount(${FRAUD_CARD})` });
      out.push({ kind: "END", msg: "resumed · 0 re-executions" });
    }
    return out;
  }, [m.phase, beamCityIdx, atFraud, m.isCrashed, m.isReplaying, m.isResumed]);

  const earthDark = m.isCrashed;

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-4 overflow-hidden">
      <TopStrip
        title="Satellite · orbit"
        scanned={scanned}
        frozen={frozen}
        loop={loop}
        resumed={m.isResumed}
      />

      <div
        className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-white/10"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(10,14,36,1) 0%, rgba(4,6,16,1) 60%, rgba(0,0,0,1) 100%)",
        }}
      >
        {/* starfield */}
        <div className="pointer-events-none absolute inset-0">
          {Array.from({ length: 60 }).map((_, i) => {
            const x = ((i * 53) % 100);
            const y = ((i * 29) % 100);
            const size = ((i % 3) + 1) * 0.8;
            const opacity = 0.25 + ((i * 7) % 10) / 20;
            return (
              <div
                key={i}
                className="absolute rounded-full bg-white"
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  opacity,
                  filter: "blur(0.4px)",
                  animation: `satTwinkle ${3 + (i % 4)}s ease-in-out infinite`,
                  animationDelay: `${(i % 5) * 0.3}s`,
                }}
              />
            );
          })}
        </div>

        {/* scope labels */}
        <div className="pointer-events-none absolute top-6 left-8 flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            orbit · {Math.floor(orbitAngle)}&deg;
          </span>
          <span
            className={`font-mono text-3xl tabular-nums transition-colors duration-300 ${
              atFraud ? "text-red-300" : "text-sky-300"
            }`}
          >
            {atFraud
              ? `LOCK · ${CITIES[FRAUD_CITY_IDX].code}`
              : `beam ${CITIES[Math.min(beamCityIdx, CITIES.length - 1)].code}`}
          </span>
        </div>
        <div className="pointer-events-none absolute top-6 right-8 flex flex-col items-end gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.22em] text-zinc-500">
            signals today
          </span>
          <span className="font-mono text-3xl tabular-nums text-zinc-200">
            {(6_400_000 + ticks * 417).toLocaleString()}
          </span>
        </div>

        {/* Earth + satellite */}
        <div className="absolute inset-0 flex items-center justify-center">
          <svg
            viewBox="0 0 100 100"
            className="h-full max-h-[640px] w-full max-w-[640px]"
            preserveAspectRatio="xMidYMid meet"
            style={{
              transition: "opacity 400ms ease",
              opacity: earthDark ? 0.25 : 1,
            }}
          >
            <defs>
              <radialGradient id="earth-grad" cx="35%" cy="35%" r="70%">
                <stop offset="0%" stopColor="rgb(30,58,138)" />
                <stop offset="60%" stopColor="rgb(8,20,56)" />
                <stop offset="100%" stopColor="rgb(2,6,16)" />
              </radialGradient>
              <radialGradient id="earth-glow" cx="50%" cy="50%" r="50%">
                <stop offset="70%" stopColor="rgba(59,130,246,0)" />
                <stop offset="100%" stopColor="rgba(59,130,246,0.3)" />
              </radialGradient>
            </defs>

            {/* atmospheric glow */}
            <circle cx="50" cy="50" r="32" fill="url(#earth-glow)" />
            {/* Earth */}
            <circle cx="50" cy="50" r="28" fill="url(#earth-grad)" stroke="rgba(59,130,246,0.35)" strokeWidth="0.3" />

            {/* continents — abstract shapes */}
            <g opacity="0.35" fill="rgb(16,80,160)">
              <path d="M 35 38 Q 40 34 46 38 Q 48 44 44 48 Q 38 50 34 45 Z" />
              <path d="M 54 42 Q 62 38 66 46 Q 64 52 58 52 Q 52 50 54 42 Z" />
              <path d="M 42 58 Q 48 54 54 60 Q 52 66 46 66 Q 40 64 42 58 Z" />
              <path d="M 30 52 Q 26 56 28 60 Q 32 62 34 58 Q 36 54 30 52 Z" />
            </g>

            {/* orbit ring */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(125,211,252,0.18)"
              strokeWidth="0.15"
              strokeDasharray="0.8 1.2"
            />

            {/* cities */}
            {CITIES.map((c, i) => {
              const p = polar(c.angleDeg, c.radius);
              const lit = ticks > i;
              const isFraud = i === FRAUD_CITY_IDX;
              const active = beamCityIdx === i && ticks > i;
              const redLock = isFraud && atFraud;
              return (
                <g key={c.code}>
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r={redLock ? 1.8 : active ? 1.4 : 0.8}
                    fill={redLock ? "rgb(248,113,113)" : active ? "rgb(74,222,128)" : lit ? "rgb(132,204,22)" : "rgb(100,116,139)"}
                    style={{
                      filter: redLock
                        ? "drop-shadow(0 0 2px rgba(248,113,113,1))"
                        : active
                          ? "drop-shadow(0 0 1.5px rgba(74,222,128,0.9))"
                          : undefined,
                      transition: "fill 300ms ease, r 300ms ease",
                    }}
                  />
                  <text
                    x={p.x + 2}
                    y={p.y - 1}
                    fontSize="1.6"
                    fontFamily="ui-monospace, monospace"
                    fill={redLock ? "rgb(252,165,165)" : "rgb(161,161,170)"}
                    opacity={lit || redLock ? 1 : 0.4}
                    style={{ transition: "fill 300ms ease, opacity 300ms ease" }}
                  >
                    {c.code}
                  </text>
                </g>
              );
            })}

            {/* Satellite + beam — orbit group rotates around Earth */}
            <g
              style={{
                transform: `rotate(${orbitAngle}deg)`,
                transformOrigin: "50px 50px",
                transition: atFraud ? "transform 700ms cubic-bezier(.2,.8,.2,1)" : "none",
                opacity: earthDark ? 0 : 1,
              }}
            >
              {/* satellite body — the beam is drawn OUTSIDE this rotating
                   group so it links satellite↔city in Earth's frame. */}
              <g transform="translate(50, 10)">
                <rect
                  x={-1.6}
                  y={-1.2}
                  width="3.2"
                  height="2.4"
                  fill={atFraud ? "rgb(248,113,113)" : "rgb(226,232,240)"}
                  stroke="rgba(0,0,0,0.5)"
                  strokeWidth="0.1"
                  style={{ transition: "fill 300ms ease" }}
                />
                {/* solar panels */}
                <rect x={-5.2} y={-0.6} width="3" height="1.2" fill="rgb(59,130,246)" opacity="0.8" />
                <rect x={2.2}  y={-0.6} width="3" height="1.2" fill="rgb(59,130,246)" opacity="0.8" />
                {/* dish */}
                <circle cx="0" cy="2" r="0.8" fill="rgb(226,232,240)" opacity={atFraud ? 0.6 : 0.9} />
                {/* lock halo */}
                {atFraud && (
                  <circle
                    cx="0"
                    cy="0"
                    r="6"
                    fill="none"
                    stroke="rgb(248,113,113)"
                    strokeWidth="0.3"
                    opacity="0.8"
                    style={{ animation: "satLockPulse 1.6s ease-in-out infinite" }}
                  />
                )}
              </g>
            </g>

            {/* beam — drawn outside the rotation so it joins satellite→city
                 directly in Earth's frame. */}
            {(() => {
              const city = CITIES[Math.min(beamCityIdx, CITIES.length - 1)];
              const cp = polar(city.angleDeg, city.radius);
              // satellite position in unrotated frame
              const rad = ((orbitAngle - 90) * Math.PI) / 180;
              const sx = 50 + Math.cos(rad) * 40;
              const sy = 50 + Math.sin(rad) * 40;
              const red = atFraud;
              return (
                <line
                  x1={sx}
                  y1={sy}
                  x2={cp.x}
                  y2={cp.y}
                  stroke={red ? "rgb(248,113,113)" : "rgb(74,222,128)"}
                  strokeWidth={red ? 0.5 : 0.3}
                  strokeLinecap="round"
                  style={{
                    filter: red
                      ? "drop-shadow(0 0 2px rgba(248,113,113,1))"
                      : "drop-shadow(0 0 1px rgba(74,222,128,0.8))",
                    opacity: earthDark ? 0 : (m.active ? 1 : 0),
                    transition: "opacity 300ms ease, stroke 300ms ease",
                    animation: red ? undefined : "satBeamPulse 700ms ease-in-out infinite",
                  }}
                />
              );
            })()}

            <style>{`
              @keyframes satBeamPulse {
                0%, 100% { opacity: 0.9; }
                50%      { opacity: 0.4; }
              }
              @keyframes satLockPulse {
                0%, 100% { r: 5; opacity: 0.4; }
                50%      { r: 8; opacity: 0.9; }
              }
              @keyframes satTwinkle {
                0%, 100% { opacity: 0.2; }
                50%      { opacity: 0.9; }
              }
            `}</style>
          </svg>
        </div>

        <CrashOverlay
          active={m.isCrashed}
          body="Satellite dark · signal lost"
          footer="Event log intact · lock cached"
        />
        <ReplayingChip active={m.isReplaying} />
        <IdleHint
          eyebrow="fraud sentinel · always on"
          purpose="94 orbits · one signal flagged."
          active={!m.active}
        />
      </div>

      <ResumedBanner
        active={m.isResumed}
        headline="94 orbits · 6.4M signals · 1 flagged, 0 lost."
        stat={`${FRAUD_CARD} · ${FRAUD_MERCHANT} · 0 re-executions`}
      />

      <div className="flex items-end gap-4">
        <AgentDebugDrawer runId={m.runId} events={debugEvents} />
        <KillButton armed={m.isArmed} onClick={m.kill} />
      </div>
    </div>
  );
}
