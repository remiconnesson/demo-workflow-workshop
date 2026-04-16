import type { ReactNode } from "react";
import type { OrderStepId } from "@/lib/order-contract";
import { CopyablePrompt } from "./copyable-prompt";
import {
  CreditCard,
  Mail,
  Webhook,
  Database,
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
} from "lucide-react";

const EXAMPLE_ICONS: Record<string, ReactNode> = {
  "Payment processing": <CreditCard size={16} />,
  "Email delivery": <Mail size={16} />,
  "Webhook dispatch": <Webhook size={16} />,
  "Database migrations": <Database size={16} />,
  "File uploads to S3": <CloudUpload size={16} />,
  "KYC identity verification": <ShieldCheck size={16} />,
  "Manager approval flows": <CircleCheckBig size={16} />,
  "Waiting on third-party webhooks": <Clock size={16} />,
  "Multi-day onboarding sequences": <Calendar size={16} />,
  "Legal document signing": <PenLine size={16} />,
  "Order cancellations": <XCircle size={16} />,
  "Travel booking reversals": <Plane size={16} />,
  "Subscription downgrades": <ArrowDownCircle size={16} />,
  "Multi-service provisioning": <Server size={16} />,
  "Inventory reservation release": <Package size={16} />,
  "AI customer support chats": <MessageCircle size={16} />,
  "Long-running code generation": <Code size={16} />,
  "Research assistants": <Search size={16} />,
  "Multi-step form wizards with AI": <ClipboardList size={16} />,
  "Infrastructure monitoring": <Activity size={16} />,
  "Log anomaly detection": <AlertTriangle size={16} />,
  "Scheduled report generation": <BarChart3 size={16} />,
  "Continuous compliance auditing": <Shield size={16} />,
  "PR merge approval gates": <GitMerge size={16} />,
  "Financial trade authorization": <Landmark size={16} />,
  "Content moderation review": <Eye size={16} />,
  "Production deployment sign-off": <Rocket size={16} />,
};

type PatternSlideLayoutProps = {
  eyebrow: string;
  patternName: string;
  description: ReactNode;
  docUrl: string;
  docSection: string;
  apiPrimitive: string | string[];
  inspectPrompt?: string;
  comparePrompt?: string;
  marker?: OrderStepId | OrderStepId[] | "span";
  markerLabel?: string;
  realWorldExamples?: string[];
};

const INSTALL_PROMPT = `npx skills add https://github.com/vercel/workflow --skill workflow-init`;

/**
 * The "concept / pattern" slide — two-tone layout with a left rail
 * showing real-world examples and a main stage split into a hero zone
 * (title + API primitive + description) and a bottom prompt band.
 */
export function PatternSlideLayout({
  patternName,
  description,
  docUrl,
  apiPrimitive,
  inspectPrompt,
  comparePrompt,
  realWorldExamples,
}: PatternSlideLayoutProps) {
  const docHref = docUrl.startsWith("http") ? docUrl : `https://${docUrl}`;

  const defaultInspectPrompt = `npx workflow inspect run <run_id>

Explain this run to me in detail. Walk me through each step that
executed, what state transitions happened, and how the "${patternName}"
pattern played out. I want to understand exactly what the Workflow SDK
did under the hood.`;

  const examplesBlock =
    realWorldExamples && realWorldExamples.length > 0
      ? `\n\nReal-world scenarios to look for:\n${realWorldExamples.map((ex) => `- ${ex}`).join("\n")}\n\nUse these as starting points to find similar patterns in my codebase.`
      : "";

  const defaultComparePrompt = `Compare my current code to what it might look like if I was using
the Workflow SDK's "${patternName}" pattern. Ask me for the absolute
path to my project, cd there, then find the places this pattern would
apply and show me before/after diffs.

API primitive: ${Array.isArray(apiPrimitive) ? apiPrimitive.join(", ") : apiPrimitive}
Docs: ${docHref}${examplesBlock}`;

  const leftPrompt = inspectPrompt ?? defaultInspectPrompt;
  const rightPrompt = comparePrompt ?? defaultComparePrompt;

  return (
    <div className="flex h-full w-full overflow-hidden bg-black text-white">
      {/* Rail */}
      <div className="flex w-64 shrink-0 flex-col border-r border-white/5 bg-zinc-950">
        {realWorldExamples && realWorldExamples.length > 0 && (
          <div className="flex flex-1 flex-col justify-center gap-4 px-8">
            <p className="mb-1 text-sm font-semibold uppercase tracking-[0.2em] text-zinc-500">
              Real-world use
            </p>
            {realWorldExamples.map((ex) => (
              <div
                key={ex}
                className="flex items-center gap-3 text-lg text-zinc-400"
              >
                {EXAMPLE_ICONS[ex] && (
                  <span className="shrink-0 text-zinc-600">
                    {EXAMPLE_ICONS[ex]}
                  </span>
                )}
                <span>{ex}</span>
              </div>
            ))}
          </div>
        )}
        <div className="border-t border-white/5 px-8 py-5">
          <a
            href={docHref}
            target="_blank"
            rel="noreferrer"
            className="font-mono text-sm text-zinc-600 underline decoration-zinc-800 underline-offset-4 hover:text-white"
          >
            Docs
          </a>
        </div>
      </div>

      {/* Main — two zones */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Hero zone */}
        <div className="flex flex-1 flex-col justify-center gap-6 px-16">
          <h1 className="text-8xl font-bold tracking-tight">{patternName}</h1>
          <div className="flex self-start items-center gap-4">
            {(Array.isArray(apiPrimitive) ? apiPrimitive : [apiPrimitive]).map(
              (primitive) => (
                <div
                  key={primitive}
                  className="inline-flex items-center gap-4 rounded-2xl border border-emerald-400/20 bg-emerald-400/5 px-8 py-4"
                >
                  <span className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-500/70">
                    API
                  </span>
                  <code className="font-mono text-3xl text-emerald-400">
                    {primitive}
                  </code>
                </div>
              )
            )}
          </div>
          <p className="max-w-4xl text-2xl leading-relaxed text-zinc-400">
            {description}
          </p>
        </div>

        {/* Prompt band */}
        <div className="shrink-0 border-t border-white/5 bg-zinc-950/40 px-16 py-8">
          <div className="grid grid-cols-2 gap-8">
            <CopyablePrompt prompt={leftPrompt} label="Inspect the run" />
            <CopyablePrompt
              prompt={rightPrompt}
              label="Try it on your code"
            />
          </div>
          <div className="mt-6">
            <CopyablePrompt
              prompt={INSTALL_PROMPT}
              label="Install skill"
              compact
            />
          </div>
        </div>
      </div>
    </div>
  );
}
