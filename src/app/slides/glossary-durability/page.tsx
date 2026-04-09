import { GlossaryLayout } from "../_components/glossary-layout";

export default function GlossaryDurabilitySlide() {
  return (
    <GlossaryLayout
      section="Durability & Replay"
      terms={[
        {
          term: "deterministic replay",
          definition:
            "After a restart, the system remembers what already finished and skips straight to where it left off.",
          prompt:
            "If the server crashes after charging the card but before notifying the restaurant, restart from the restaurant step — don't charge again",
        },
        {
          term: "checkpoint",
          definition:
            "A save point. Each completed step is a checkpoint — the system won't redo it on restart.",
          prompt:
            "Treat each API call as a save point so we never redo work that already succeeded",
        },
        {
          term: "idempotency key",
          definition:
            "A unique ID you send with a request so if it's sent twice, it only happens once. Like a 'don't duplicate this' tag.",
          prompt:
            "Make sure Stripe only charges the customer once even if our payment step retries three times",
        },
        {
          term: "step boundary",
          definition:
            "The line between 'deciding what to do' and 'actually doing it'. Data gets copied across this line, not shared.",
          prompt:
            "Split the workflow so each external call is its own step — that way they can retry independently",
        },
      ]}
    />
  );
}
