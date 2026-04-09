import { GlossaryLayout } from "../_components/glossary-layout";

export default function GlossaryPatternsSlide() {
  return (
    <GlossaryLayout
      section="The Patterns"
      terms={[
        {
          term: "hooks & suspension",
          definition:
            "Pause a workflow until a human responds — zero cost while waiting. Wake it up with a link, button, or webhook.",
          prompt:
            "Pause the order until the restaurant accepts, then pause again until the driver confirms pickup",
        },
        {
          term: "saga & compensation",
          definition:
            "Each step registers an undo. If something fails later, roll back in reverse — refund, cancel, release.",
          prompt:
            "When a step fails, automatically undo everything that already happened in reverse order",
        },
        {
          term: "fan-out",
          definition:
            "Send one thing to many places at once. If one fails, the others still go through.",
          prompt:
            "Notify the customer, restaurant, driver, and support about a delay — all at once, independently",
        },
        {
          term: "timeout",
          definition:
            "Give something a deadline. If it doesn't happen in time, take a different path.",
          prompt:
            "Give the driver 2 minutes to accept — if they don't respond, cancel and try someone else",
        },
      ]}
    />
  );
}
