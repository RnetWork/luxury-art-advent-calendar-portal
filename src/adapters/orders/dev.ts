import type { OrdersAdapter } from "./types";

/** Demo: no Admin API. Webhook payloads (verified by HMAC) are the source of truth. */
export const devOrders: OrdersAdapter = {
  live: false,
  fetchOrder: async () => null,
  listCustomerOrderIds: async () => [],
};
