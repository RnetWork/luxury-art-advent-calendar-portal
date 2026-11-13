import "server-only";
import { env } from "@/lib/env";
import { normalizeAddress, shopifyId, toCents } from "@/lib/shopify-order";
import type { AuthoritativeOrder, OrdersAdapter } from "./types";

async function adminGraphql<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const res = await fetch(`https://${env.shopify.storeDomain()}/admin/api/${env.shopify.apiVersion()}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": env.shopify.adminToken() },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Shopify Admin API ${res.status}`);
  const json = (await res.json()) as { data?: T; errors?: unknown };
  if (json.errors || !json.data) throw new Error(`Shopify Admin API error: ${JSON.stringify(json.errors).slice(0, 300)}`);
  return json.data;
}

type GqlOrder = {
  id: string;
  name: string;
  email: string | null;
  displayFinancialStatus: string | null;
  cancelledAt: string | null;
  totalPriceSet: { shopMoney: { amount: string; currencyCode: string } };
  totalRefundedSet: { shopMoney: { amount: string } };
  customer: { id: string; firstName: string | null; lastName: string | null } | null;
  shippingAddress: { name: string | null; company: string | null; address1: string | null; address2: string | null; city: string | null; province: string | null; zip: string | null; country: string | null; countryCodeV2: string | null; phone: string | null } | null;
  lineItems: { nodes: Array<{ quantity: number; variant: { id: string } | null }> };
};

const ORDER_QUERY = /* GraphQL */ `
  query Order($id: ID!) {
    order(id: $id) {
      id name email displayFinancialStatus cancelledAt
      totalPriceSet { shopMoney { amount currencyCode } }
      totalRefundedSet { shopMoney { amount } }
      customer { id firstName lastName }
      shippingAddress { name company address1 address2 city province zip country countryCodeV2 phone }
      lineItems(first: 50) { nodes { quantity variant { id } } }
    }
  }`;

export const shopifyOrders: OrdersAdapter = {
  live: true,
  async fetchOrder(shopifyOrderId) {
    const data = await adminGraphql<{ order: GqlOrder | null }>(ORDER_QUERY, { id: `gid://shopify/Order/${shopifyOrderId}` });
    const o = data.order;
    if (!o) return null;
    const a = o.shippingAddress;
    const order: AuthoritativeOrder = {
      shopifyOrderId: shopifyId(o.id)!,
      name: o.name,
      email: (o.email ?? "").toLowerCase(),
      customer: { id: shopifyId(o.customer?.id), firstName: o.customer?.firstName ?? null, lastName: o.customer?.lastName ?? null },
      financialStatus: (o.displayFinancialStatus ?? "PENDING").toLowerCase(),
      cancelledAt: o.cancelledAt ? new Date(o.cancelledAt) : null,
      totalCents: toCents(o.totalPriceSet.shopMoney.amount),
      refundedCents: toCents(o.totalRefundedSet.shopMoney.amount),
      currency: o.totalPriceSet.shopMoney.currencyCode,
      lineItems: o.lineItems.nodes.map((n) => ({ variantId: shopifyId(n.variant?.id) ?? "", quantity: n.quantity })),
      shippingAddress: a ? normalizeAddress({ ...a, country_code: a.countryCodeV2 }) : null,
    };
    return order;
  },
  async listCustomerOrderIds(shopifyCustomerId) {
    const data = await adminGraphql<{ customer: { orders: { nodes: Array<{ id: string }> } } | null }>(
      `query($id: ID!) { customer(id: $id) { orders(first: 20, sortKey: CREATED_AT, reverse: true) { nodes { id } } } }`,
      { id: `gid://shopify/Customer/${shopifyCustomerId}` },
    );
    return (data.customer?.orders.nodes ?? []).map((n) => shopifyId(n.id)!).filter(Boolean);
  },
};
