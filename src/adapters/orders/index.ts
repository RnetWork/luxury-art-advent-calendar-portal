import "server-only";
import { env } from "@/lib/env";
import { devOrders } from "./dev";
import { shopifyOrders } from "./shopify";
import type { OrdersAdapter } from "./types";

export function ordersAdapter(): OrdersAdapter {
  return env.shopify.adminToken() && env.shopify.storeDomain() ? shopifyOrders : devOrders;
}
export type { OrdersAdapter, AuthoritativeOrder } from "./types";
