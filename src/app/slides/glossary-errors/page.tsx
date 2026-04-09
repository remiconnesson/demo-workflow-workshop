import { GlossaryLayout } from "../_components/glossary-layout";

export default function GlossaryErrorsSlide() {
  return (
    <GlossaryLayout
      section="Error Handling"
      terms={[
        {
          term: "FatalError",
          definition:
            "A 'give up now' error. Don't retry — this will never work. Start rolling back immediately.",
          prompt:
            "If the restaurant doesn't exist, don't keep retrying — immediately refund the customer and cancel everything",
        },
        {
          term: "RetryableError",
          definition:
            "A 'try again later' error. The service is probably just busy or temporarily down.",
          prompt:
            "If the delivery API is rate-limiting us, wait a bit and try again instead of failing the whole order",
        },
        {
          term: "exponential backoff",
          definition:
            "Wait longer between each retry — 1 second, then 4, then 9. Gives the struggling service time to recover.",
          prompt:
            "When retrying, wait a little longer each time so we don't hammer the API while it's struggling",
        },
        {
          term: "max retries",
          definition:
            "How many times to try before giving up. Default is 3 — enough to ride out a hiccup, fast enough to fail gracefully.",
          prompt:
            "Try the payment up to 5 times since the gateway sometimes has brief outages, but stop after that",
        },
      ]}
    />
  );
}
