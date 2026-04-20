const PLACE_ORDER_BODY_PLAIN = `async function placeOrder(input) {
  const order    = await validateOrder(input)

  const payment  = await chargeCard(order)

  const accepted = await pingRestaurant(order)

  const driver   = await findDriver(order)

  const delivery = await trackDelivery(order, driver)

  await sendReceipts(order, payment)
  return { ok: true }
}`;

const PLACE_ORDER_BODY_DURABLE = `async function placeOrder(input) {
  "use workflow"

  const order    = await validateOrder(input)

  const payment  = await chargeCard(order)

  const accepted = await pingRestaurant(order)

  const driver   = await findDriver(order)

  const delivery = await trackDelivery(order, driver)

  await sendReceipts(order, payment)
  return { ok: true }
}`;

export const PLACE_ORDER_SETUP = `// placeOrder.ts — the starting point
${PLACE_ORDER_BODY_PLAIN}`;

export const PLACE_ORDER_DURABLE = `// placeOrder.ts — now durable
${PLACE_ORDER_BODY_DURABLE}`;

export type SpotlightLine = 5 | 7 | 9 | 11 | 13 | 15;
