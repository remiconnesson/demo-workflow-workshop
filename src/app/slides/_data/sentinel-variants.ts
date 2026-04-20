// ---------------------------------------------------------------------------
// Always-on sentinel variants — metadata only.
//
// Each variant ships its own bespoke full-bleed demo component
// (src/app/slides/_components/sentinel-demos/*). This file holds only the
// copy that's shared between the demo headline, the picker, and the
// resumed-state banner. Visual vocabulary (colors, icons, layout) is owned
// by the per-variant demo component.
// ---------------------------------------------------------------------------

export type SentinelVariantSlug =
  | "fraud"
  | "slo"
  | "moderation"
  | "patcher"
  | "order-safety";

export type SentinelVariant = {
  slug: SentinelVariantSlug;
  agentName: string;                // "Fraud sentinel"
  eyebrow: string;                  // "Durable agent · fraud sentinel"
  purposeLine: string;              // single-line pitch (picker)
  uptimeLabel: string;              // "Running since Jan 14 · 94 days"
  startingLoop: number;             // 13_248
  kill: {
    buttonLabel: string;            // "Kill server"
    preHeadline: string;            // picker card headline
    catastropheLine: string;        // picker card support line
  };
  resumed: {
    headline: string;               // demo resumed banner headline
    statChip: string;               // "$1.2M flagged · 94 days · 0 gaps"
  };
};

// Order drives the 1–5 keyboard shortcut on the picker.
export const SENTINEL_VARIANT_ORDER: SentinelVariantSlug[] = [
  "fraud",
  "slo",
  "moderation",
  "patcher",
  "order-safety",
];

export const SENTINEL_VARIANTS: Record<SentinelVariantSlug, SentinelVariant> = {
  fraud: {
    slug: "fraud",
    agentName: "Fraud sentinel",
    eyebrow: "Durable agent · fraud sentinel",
    purposeLine:
      "Scores every card charge before it settles. Freezes high-risk accounts.",
    uptimeLabel: "Running since Jan 14 · 94 days uptime",
    startingLoop: 13_248,
    kill: {
      buttonLabel: "Kill server",
      preHeadline: "Kill the server\nmid-score.",
      catastropheLine:
        "Every second offline is a charge that settles without review.",
    },
    resumed: {
      headline: "Zero gaps.",
      statChip: "$1.2M flagged · 94 days · 0 gaps",
    },
  },

  slo: {
    slug: "slo",
    agentName: "SLO watchdog",
    eyebrow: "Durable agent · on-call automation",
    purposeLine:
      "Watches p99 latency and error budgets. Pages on-call when the sky falls.",
    uptimeLabel: "Running since Feb 02 · 75 days uptime",
    startingLoop: 7_104,
    kill: {
      buttonLabel: "Kill metrics pipeline",
      preHeadline: "Kill the metrics\npipeline mid-check.",
      catastropheLine:
        "You're about to crash the crash-detector. Watch what happens.",
    },
    resumed: {
      headline: "Still watching.",
      statChip: "317 pages · 75 days · 0 missed incidents",
    },
  },

  moderation: {
    slug: "moderation",
    agentName: "Moderation sentinel",
    eyebrow: "Durable agent · trust & safety",
    purposeLine:
      "Scans new posts. Scores toxicity, harassment, PII. Quarantines above threshold.",
    uptimeLabel: "Running since Dec 28 · 111 days uptime",
    startingLoop: 39_482,
    kill: {
      buttonLabel: "Pull the plug",
      preHeadline: "Pull the plug\nmid-score.",
      catastropheLine:
        "Three minutes offline is a screenshot in the press.",
    },
    resumed: {
      headline: "Nothing leaked.",
      statChip: "2.1M scanned · 111 days · 0 leaks",
    },
  },

  patcher: {
    slug: "patcher",
    agentName: "CVE auto-patcher",
    eyebrow: "Durable agent · self-healing security",
    purposeLine:
      "Joins running deploys against the CVE feed. Opens PRs for every patched upstream.",
    uptimeLabel: "Running since Feb 14 · 62 days uptime",
    startingLoop: 2_976,
    kill: {
      buttonLabel: "Kill runner",
      preHeadline: "Kill the runner\nmid-PR.",
      catastropheLine:
        "62 days of unattended security work. One crash must not open a window.",
    },
    resumed: {
      headline: "PR landed. No duplicate.",
      statChip: "918 CVEs patched · 62 days · 0 rollbacks",
    },
  },

  "order-safety": {
    slug: "order-safety",
    agentName: "Order-safety monitor",
    eyebrow: "Durable agent · order safety",
    purposeLine:
      "Watches every order like the one from slide 2. Pulls risky drivers before the next ticket.",
    uptimeLabel: "Running since Jan 01 · 107 days uptime",
    startingLoop: 48_129,
    kill: {
      buttonLabel: "Kill dispatch",
      preHeadline: "Kill dispatch\nmid-scan.",
      catastropheLine:
        "One order is easy. A million of them, forever, is the job.",
    },
    resumed: {
      headline: "Same order. A million at a time.",
      statChip: "6.4M watched · 107 days · 0 gaps",
    },
  },
};

export function getSentinelVariant(slug: string): SentinelVariant | null {
  return (SENTINEL_VARIANTS as Record<string, SentinelVariant>)[slug] ?? null;
}
