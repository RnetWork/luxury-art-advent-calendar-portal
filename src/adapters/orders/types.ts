import type { NormalizedOrder } from "@/lib/shopify-order";

export type AuthoritativeOrder = NormalizedOrder & { refundedCents: number };

export interface OrdersAdapter {
  /** True when orders are re-read from Shopify's Admin API (defence in depth against forged/out-of-order events). */
  readonly live: boolean;
  fetchOrder(shopifyOrderId: string): Promise<AuthoritativeOrder | null>;
  /** Ids of a customer's orders (used at login to recover from a missed webhook). */
  listCustomerOrderIds(shopifyCustomerId: string): Promise<string[]>;
}
