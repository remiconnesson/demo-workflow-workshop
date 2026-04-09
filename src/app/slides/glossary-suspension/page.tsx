import { GlossaryLayout } from "../_components/glossary-layout";

export default function GlossarySuspensionSlide() {
  return (
    <GlossaryLayout
      section="Suspension & Hooks"
      terms={[
        {
          term: "zero-cost suspension",
          definition:
            "The workflow pauses and nothing runs — no server, no container, no bill. It just waits until something wakes it up.",
          prompt:
            "After sending the approval email, pause the whole workflow until someone responds — it shouldn't cost anything while waiting",
        },
        {
          term: "createHook",
          definition:
            "Puts the workflow to sleep at a named pause point. Anyone with the name can wake it up later with data.",
          prompt:
            "Pause the order after notifying the restaurant and wait for them to accept or reject before continuing",
        },
        {
          term: "deterministic token",
          definition:
            "A predictable name for the pause point — like 'order-123-restaurant-accept'. You can put it in a link, button, or webhook.",
          prompt:
            "Make the pause point name based on the order ID so we can put it in a Slack button that resumes the workflow",
        },
        {
          term: "approval gate",
          definition:
            "Wait for someone to say yes or no. If nobody responds in time, do something else automatically.",
          prompt:
            "Wait up to one hour for the manager to approve the order — if they don't respond, cancel it and refund the customer",
        },
      ]}
    />
  );
}
