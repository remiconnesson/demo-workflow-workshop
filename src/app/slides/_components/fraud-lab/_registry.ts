// ---------------------------------------------------------------------------
// The 25 fraud-lab variants. Each is a bespoke visual demo of the same
// narrative (94d uptime → •••• 8891 flagged → kill → replay → resume).
// Dynamic component map lives in `_renderer.tsx` (client component) so that
// this file stays server-importable for routes using generateStaticParams.
// ---------------------------------------------------------------------------

export type FraudVariantMeta = {
  slug: string;
  number: number;
  title: string;
  tagline: string;
};

export const FRAUD_VARIANTS: FraudVariantMeta[] = [
  { slug: "heartbeat",     number: 1,  title: "Heartbeat",       tagline: "ECG line as 94-day pulse; flatline → resume." },
  { slug: "choir",         number: 2,  title: "Choir",           tagline: "40 workers hum in unison; one notices." },
  { slug: "tape",          number: 3,  title: "Ticker tape",     tagline: "Brass ticker; stamp hesitates and flips red." },
  { slug: "giant",         number: 4,  title: "Sleeping giant",  tagline: "Breathing orb that opens a red eye." },
  { slug: "conveyor",      number: 5,  title: "Conveyor arm",    tagline: "Factory arm that pauses mid-stamp." },
  { slug: "telescope",     number: 6,  title: "Telescope",       tagline: "Reticle snaps impossibly fast to fraud." },
  { slug: "courtroom",     number: 7,  title: "Courtroom",       tagline: "Defendant card; streaming verdict text." },
  { slug: "hive",          number: 8,  title: "Bee hive",        tagline: "Never-visited cell turns red." },
  { slug: "reading-ai",    number: 9,  title: "Reading AI",      tagline: "Monologue pauses: \"Wait.\"" },
  { slug: "galaxy",        number: 10, title: "Galaxy",          tagline: "Constellation lines connect the dots." },
  { slug: "radar",         number: 11, title: "Radar ping",      tagline: "Sonar sweep locks on target." },
  { slug: "slot",          number: 12, title: "Slot machine",    tagline: "Three reels land red; lever locks." },
  { slug: "scroll",        number: 13, title: "Long scroll",     tagline: "Logs scroll; AI voice cuts in." },
  { slug: "brain",         number: 14, title: "Brain scan",      tagline: "fMRI regions all fire at once." },
  { slug: "eyes",          number: 15, title: "Swarm of eyes",   tagline: "500 eyes synchronize on one point." },
  { slug: "metronome",     number: 16, title: "Metronome",       tagline: "Pendulum pauses mid-swing." },
  { slug: "loom",          number: 17, title: "Jacquard loom",   tagline: "Weaving a 94-day tapestry." },
  { slug: "guardian",      number: 18, title: "Guardian statue", tagline: "Stone hand reaches into the stream." },
  { slug: "lighthouse",    number: 19, title: "Lighthouse",      tagline: "Beam finds the one red light." },
  { slug: "aquarium",      number: 20, title: "Aquarium",        tagline: "Cephalopod flashes red stripes." },
  { slug: "card-duel",     number: 21, title: "Card duel",       tagline: "Card flipped to reveal the joker." },
  { slug: "elevator",      number: 22, title: "Elevator",        tagline: "A hidden floor appears." },
  { slug: "satellite",     number: 23, title: "Satellite",       tagline: "Beams from cities to orbit." },
  { slug: "book",          number: 24, title: "The book",        tagline: "Quill writes: \"I don't know this one.\"" },
  { slug: "sky",           number: 25, title: "The sky",         tagline: "Red meteor freezes mid-arc." },
];

export const FRAUD_VARIANT_BY_SLUG: Record<string, FraudVariantMeta> = Object.fromEntries(
  FRAUD_VARIANTS.map((v) => [v.slug, v]),
);
