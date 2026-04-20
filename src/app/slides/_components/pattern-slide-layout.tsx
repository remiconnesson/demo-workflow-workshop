import type { ReactNode } from "react";
import type { OrderStepId } from "@/lib/order-contract";
import { InspectorBand } from "./inspector-band";
import {
  CreditCard,
  Mail,
  Webhook,
  MessageSquare,
  CloudUpload,
  ShieldCheck,
  CircleCheckBig,
  Clock,
  Calendar,
  PenLine,
  XCircle,
  Plane,
  ArrowDownCircle,
  Server,
  Package,
  MessageCircle,
  Code,
  Search,
  ClipboardList,
  Activity,
  AlertTriangle,
  BarChart3,
  Shield,
  GitMerge,
  Landmark,
  Eye,
  Rocket,
  ArrowUpRight,
} from "lucide-react";

const EXAMPLE_ICONS: Record<string, ReactNode> = {
  "Payment processing": <CreditCard size={22} />,
  "Email delivery": <Mail size={22} />,
  "Webhook delivery": <Webhook size={22} />,
  "SMS notifications": <MessageSquare size={22} />,
  "File uploads to S3": <CloudUpload size={22} />,
  "KYC identity verification": <ShieldCheck size={22} />,
  "Manager approvals": <CircleCheckBig size={22} />,
  "Third-party webhook callbacks": <Clock size={22} />,
  "Multi-day onboarding sequences": <Calendar size={22} />,
  "Legal document signing": <PenLine size={22} />,
  "Order cancellations": <XCircle size={22} />,
  "Travel booking cancellations": <Plane size={22} />,
  "Subscription downgrades": <ArrowDownCircle size={22} />,
  "Multi-service provisioning": <Server size={22} />,
  "Releasing inventory holds": <Package size={22} />,
  "AI customer support chats": <MessageCircle size={22} />,
  "Long-running code generation": <Code size={22} />,
  "Research assistants": <Search size={22} />,
  "AI-powered form wizards": <ClipboardList size={22} />,
  "Infrastructure monitoring": <Activity size={22} />,
  "Log anomaly detection": <AlertTriangle size={22} />,
  "Scheduled report generation": <BarChart3 size={22} />,
  "Compliance auditing": <Shield size={22} />,
  "PR merge approvals": <GitMerge size={22} />,
  "Financial trade authorization": <Landmark size={22} />,
  "Content moderation": <Eye size={22} />,
  "Deployment sign-offs": <Rocket size={22} />,
};

type PatternSlideLayoutProps = {
  eyebrow: string;
  patternName: string;
  description: ReactNode;
  docUrl: string;
  docSection: string;
  apiPrimitive: string | string[];
  /** Retained for future handout route — unused on the live slide. */
  inspectPrompt?: string;
  /** Retained for future handout route — unused on the live slide. */
  comparePrompt?: string;
  marker?: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  realWorldExamples?: string[];
};

/**
 * The "concept / pattern" slide — stage-sized. One idea per screen:
 *   1. the pattern's name,
 *   2. the API primitive,
 *   3. where it applies,
 *   4. a static inspector band for the hand-off to an AI agent.
 * Per .impeccable.md rule #8, the inspector band is a single static command
 * and caption — not a feed, log, or terminal.
 */
export function PatternSlideLayout({
  patternName,
  description,
  docUrl,
  docSection,
  apiPrimitive,
  realWorldExamples,
}: PatternSlideLayoutProps) {
  const docHref = docUrl.startsWith("http") ? docUrl : `https://${docUrl}`;
  const primitives = Array.isArray(apiPrimitive) ? apiPrimitive : [apiPrimitive];

  const visibleExamples = realWorldExamples?.slice(0, 6) ?? [];

  return (
    <div className="flex h-full w-full items-center justify-center overflow-hidden bg-black text-white">
      <div className="mx-auto flex h-full w-full max-w-[1720px] flex-col justify-center gap-8 px-20 py-12">
        {/* Hero — pattern name, API primitive, description */}
        <div className="flex flex-col gap-6">
          <h1 className="text-[88px] font-bold leading-[0.96] tracking-tight">
            {patternName}
          </h1>

          <div className="flex flex-wrap items-center gap-4">
            {primitives.map((primitive) => (
              <div
                key={primitive}
                className="inline-flex items-center gap-5 rounded-2xl border border-emerald-400/25 bg-emerald-400/5 px-8 py-5"
              >
                <span className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500/70">
                  API
                </span>
                <code className="font-mono text-3xl text-emerald-400">
                  {primitive}
                </code>
              </div>
            ))}
          </div>

          <p className="max-w-5xl text-[28px] leading-[1.3] text-zinc-400">
            {description}
          </p>
        </div>

        {/* Where this applies — large readable chips (cap at 6) */}
        {visibleExamples.length > 0 && (
          <div className="flex flex-col gap-4">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-zinc-500">
              Where this applies
            </p>
            <div className="flex flex-wrap gap-3">
              {visibleExamples.map((ex) => (
                <span
                  key={ex}
                  className="inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/[0.03] px-5 py-2.5 text-lg text-zinc-200"
                >
                  {EXAMPLE_ICONS[ex] && (
                    <span className="shrink-0 text-zinc-500">
                      {EXAMPLE_ICONS[ex]}
                    </span>
                  )}
                  <span>{ex}</span>
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Docs — one prominent pill */}
        <div className="flex items-center">
          <a
            href={docHref}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] px-7 py-3.5 font-mono text-lg text-zinc-300 transition-colors hover:border-white/30 hover:bg-white/[0.08] hover:text-white"
          >
            <span className="text-sm uppercase tracking-[0.22em] text-zinc-500">
              Docs
            </span>
            <span className="text-zinc-500">·</span>
            <span>{docSection}</span>
            <ArrowUpRight size={18} className="text-zinc-500" />
          </a>
        </div>

        {/* Inspector band — hand off the run to an AI agent */}
        <InspectorBand />
      </div>
    </div>
  );
}
