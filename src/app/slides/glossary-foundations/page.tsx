import { GlossaryLayout } from "../_components/glossary-layout";

export default function GlossaryBasicsSlide() {
  return (
    <GlossaryLayout
      section="The Basics"
      terms={[
        {
          term: "durable execution",
          definition:
            "Code that picks up where it left off after a crash — no lost progress, no half-done work.",
          prompt:
            "Make it so if the server restarts mid-order, it picks up where it left off instead of starting over",
        },
        {
          term: "checkpoint",
          definition:
            "A save point. Each completed step is a checkpoint — the system won't redo it on restart.",
          prompt:
            "Treat each API call as a save point so we never redo work that already succeeded",
        },
        {
          term: "idempotency",
          definition:
            "Doing something twice has the same effect as doing it once. Retry-safe by design.",
          prompt:
            "Make sure Stripe only charges the customer once even if our payment step retries three times",
        },
        {
          term: "fatal vs retryable",
          definition:
            "Some errors mean 'stop everything'. Others mean 'wait a bit and try again'. Know the difference.",
          prompt:
            "If the restaurant doesn't exist, stop immediately. If the API is just slow, wait and retry",
        },
      ]}
    />
  );
}
