import { GlossaryLayout } from "../_components/glossary-layout";

export default function GlossarySagaSlide() {
  return (
    <GlossaryLayout
      section="Saga & Compensation"
      terms={[
        {
          term: "compensation stack",
          definition:
            "A to-do list of undo actions that grows as the order progresses. If something fails, work through the list backwards.",
          prompt:
            "After each step succeeds, remember how to undo it — so if a later step fails we can reverse everything in order",
        },
        {
          term: "LIFO unwind",
          definition:
            "Undo in reverse order — last thing done is the first thing undone. Release the driver before canceling the restaurant before refunding.",
          prompt:
            "When rolling back, undo the most recent step first and work backwards to the beginning",
        },
        {
          term: "forward recovery",
          definition:
            "Instead of undoing everything, just skip the broken step and keep going. The delivery already happened — don't recall it because the receipt email failed.",
          prompt:
            "If the receipt email fails, log it and move on — don't roll back the whole delivery just because of an email",
        },
        {
          term: "distributed transaction",
          definition:
            "An operation that touches multiple services (payment, kitchen, delivery) and needs to either fully complete or fully undo.",
          prompt:
            "The order touches Stripe, the restaurant system, and the driver app — make sure they all succeed or all get reversed",
        },
      ]}
    />
  );
}
