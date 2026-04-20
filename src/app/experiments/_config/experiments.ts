/**
 * Manifest of all 21 experiment demos. Each theme has one DurableAgent
 * demonstrated across the three property groups (stable / suspendable
 * / undoable, with legacy slugs retry · suspend · rollback).
 *
 * Slug format: `{theme}-{verb}`. Routes live at `/experiments/{slug}`.
 */

export type Verb = "retry" | "suspend" | "rollback";

export type ThemeId =
  | "order"
  | "dispatch"
  | "kitchen"
  | "menu"
  | "support"
  | "market"
  | "compliance";

export type Theme = {
  id: ThemeId;
  name: string;
  tagline: string;
  agentRole: string;
};

export const THEMES: Theme[] = [
  {
    id: "order",
    name: "Order lifecycle",
    tagline: "Autonomous order orchestrator",
    agentRole:
      "Oversees a single order from placement to delivery, adapting as steps flake, wait, or need to be unwound.",
  },
  {
    id: "dispatch",
    name: "Dispatch",
    tagline: "Driver assignment & rerouting agent",
    agentRole:
      "Picks drivers, rebalances loads, and handles driver issues across an active fleet.",
  },
  {
    id: "kitchen",
    name: "Kitchen coordinator",
    tagline: "Prep-time juggler",
    agentRole:
      "Tracks restaurant prep times and handles ingredient shortages, 86'd items, and substitutions mid-order.",
  },
  {
    id: "menu",
    name: "Menu curator",
    tagline: "Price & availability tuner",
    agentRole:
      "Proposes price changes, availability windows, and item hides based on ops signals.",
  },
  {
    id: "support",
    name: "Customer success",
    tagline: "Complaint handler",
    agentRole:
      "Triages complaints, issues refunds, credits, or comps, and escalates when judgement is needed.",
  },
  {
    id: "market",
    name: "Marketplace optimizer",
    tagline: "Surge, promos, zone activation",
    agentRole:
      "Tunes surge pricing, promo campaigns, and zone activation to balance supply and demand.",
  },
  {
    id: "compliance",
    name: "Compliance auditor",
    tagline: "Allergen & safety monitor",
    agentRole:
      "Watches menu items, restaurants, and active orders for regulatory and food-safety issues.",
  },
];

export const VERBS: { id: Verb; label: string; color: string; story: string }[] = [
  {
    id: "retry",
    label: "Retry",
    color: "sky",
    story:
      "The agent calls a tool that flakes. The step retries transparently. Show the same stepId replay, no duplicate side effects.",
  },
  {
    id: "suspend",
    label: "Suspend",
    color: "amber",
    story:
      "The agent hits a decision point and suspends on a hook. A human (or another system) resolves the hook. The same agent loop resumes mid-thought.",
  },
  {
    id: "rollback",
    label: "Rollback",
    color: "fuchsia",
    story:
      "The agent makes changes, then a condition triggers a rollback. Prior tool calls unwind in reverse via compensation tools the agent itself invokes.",
  },
];

export type ExperimentSlug =
  | `${ThemeId}-retry`
  | `${ThemeId}-suspend`
  | `${ThemeId}-rollback`;

export type Experiment = {
  slug: ExperimentSlug;
  themeId: ThemeId;
  verb: Verb;
  title: string;
};

export const EXPERIMENTS: Experiment[] = THEMES.flatMap((theme) =>
  VERBS.map((verb) => ({
    slug: `${theme.id}-${verb.id}` as ExperimentSlug,
    themeId: theme.id,
    verb: verb.id,
    title: `${theme.name} · ${verb.label}`,
  })),
);

export function getExperiment(slug: string): Experiment | undefined {
  return EXPERIMENTS.find((e) => e.slug === slug);
}

export function getTheme(id: ThemeId): Theme {
  const theme = THEMES.find((t) => t.id === id);
  if (!theme) throw new Error(`Unknown theme: ${id}`);
  return theme;
}

export function getVerb(id: Verb) {
  const verb = VERBS.find((v) => v.id === id);
  if (!verb) throw new Error(`Unknown verb: ${id}`);
  return verb;
}
