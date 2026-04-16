export const DISPUTE_CODE = `async function placeOrder(orderId: string) {
  "use workflow"

  // ...prior steps each pushed their undo onto the saga.

  // Open a post-delivery dispute window.
  const disputeHook = createHook<{ reason: string }>({
    token: \`order:\${orderId}:delivery-dispute\`,
  })

  const verdict = await Promise.race([
    disputeHook.then((d) => ({ kind: "disputed" as const, ...d })),
    sleep("24h").then(() => ({ kind: "ok" as const })),
  ])

  if (verdict.kind === "disputed") {
    // Workflow catch {} unwinds every compensation in reverse.
    throw new Error(\`Disputed: \${verdict.reason}\`)
  }
}`;
