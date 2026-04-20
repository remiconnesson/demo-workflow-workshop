import {
  MessageSquare,
  Zap,
  RotateCcw,
  Search,
  ServerCrash,
  Play,
  FileText,
  UserCheck,
  Settings,
} from "lucide-react";
import type { AgentGroupSlug } from "../_data/agent-groups";

type BeatTone = "red" | "amber" | "emerald" | "sky";

type Beat = {
  label: string;
  icon: React.ReactNode;
  tone: BeatTone;
  badge?: string;
};

const TONE_FILL: Record<BeatTone, string> = {
  red: "border-red-400 bg-red-500/20 text-red-400",
  amber: "border-amber-400 bg-amber-400/20 text-amber-300",
  emerald: "border-white bg-white text-black",
  sky: "border-sky-400 bg-sky-400/20 text-sky-300",
};

const BADGE_CLASS: Record<BeatTone, string> = {
  red: "border-red-400 bg-red-500 text-white shadow-[0_0_24px_rgba(248,113,113,0.6)]",
  amber: "border-amber-300 bg-amber-400 text-black shadow-[0_0_24px_rgba(252,211,77,0.55)]",
  emerald:
    "border-emerald-400 bg-emerald-500 text-white shadow-[0_0_24px_rgba(52,211,153,0.55)]",
  sky: "border-sky-400 bg-sky-500 text-white shadow-[0_0_24px_rgba(56,189,248,0.6)]",
};

const ICON_SIZE = 16;
const STROKE = 2.5;

const BEATS: Record<AgentGroupSlug, [Beat, Beat, Beat]> = {
  "agent-first": [
    {
      label: "Stream",
      icon: <MessageSquare size={ICON_SIZE} strokeWidth={STROKE} />,
      tone: "emerald",
    },
    {
      label: "Refresh",
      icon: <Zap size={ICON_SIZE} strokeWidth={STROKE} />,
      tone: "red",
      badge: "F5",
    },
    {
      label: "Resume",
      icon: <RotateCcw size={ICON_SIZE} strokeWidth={STROKE} />,
      tone: "emerald",
    },
  ],
  "agent-observer": [
    {
      label: "Scan",
      icon: <Search size={ICON_SIZE} strokeWidth={STROKE} />,
      tone: "emerald",
    },
    {
      label: "Crash",
      icon: <ServerCrash size={ICON_SIZE} strokeWidth={STROKE} />,
      tone: "red",
      badge: "down",
    },
    {
      label: "Replay",
      icon: <Play size={ICON_SIZE} strokeWidth={STROKE} />,
      tone: "emerald",
    },
  ],
  "agent-analyst": [
    {
      label: "Propose",
      icon: <FileText size={ICON_SIZE} strokeWidth={STROKE} />,
      tone: "emerald",
    },
    {
      label: "Await",
      icon: <UserCheck size={ICON_SIZE} strokeWidth={STROKE} />,
      tone: "amber",
      badge: "hook",
    },
    {
      label: "Execute",
      icon: <Settings size={ICON_SIZE} strokeWidth={STROKE} />,
      tone: "emerald",
    },
  ],
};

type AgentBeatStripProps = {
  slug: AgentGroupSlug;
};

/**
 * Static "finished" snapshot of a durable-agent demo's three beats.
 * same visual language as FinishedTimelineStrip but with agent-specific
 * steps. Anchors the fix slide back to the demo the audience just watched.
 */
export function AgentBeatStrip({ slug }: AgentBeatStripProps) {
  const beats = BEATS[slug];

  return (
    <div className="rounded-2xl border border-white/5 bg-zinc-950/60 px-8 py-5 opacity-60">
      <div className="relative flex items-start justify-center gap-24">
        {/* Connecting line, behind nodes */}
        <div className="pointer-events-none absolute left-1/2 top-[18px] h-px w-[320px] -translate-x-1/2 bg-white/15" />

        {beats.map((beat) => (
          <div key={beat.label} className="relative min-w-[80px] text-center">
            <div className="relative inline-flex justify-center">
              {/* Badge */}
              <div
                className={`pointer-events-none absolute -top-5 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-full border px-2 py-[1px] font-mono text-xs font-bold transition-opacity duration-500 ${
                  beat.badge
                    ? BADGE_CLASS[beat.tone]
                    : "border-transparent bg-transparent text-transparent"
                } ${beat.badge ? "opacity-100" : "opacity-0"}`}
              >
                {beat.badge ?? "\u00B7"}
              </div>
              {/* Node */}
              <div
                className={`relative flex h-9 w-9 items-center justify-center rounded-full border-2 ${TONE_FILL[beat.tone]}`}
              >
                {beat.icon}
              </div>
            </div>
            <div className="mt-2 text-sm font-semibold text-zinc-300">
              {beat.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
