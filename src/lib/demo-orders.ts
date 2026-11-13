// Shopify-shaped (REST webhook) payloads for the demo, the event simulator and tests.

export type DemoPersona = {
  key: string;
  customerId: string;
  email: string;
  firstName: string;
  lastName: string;
  city: string;
  province: string;
  zip: string;
  address1: string;
};

export const DEMO_PERSONAS: DemoPersona[] = [
  { key: "eleanor", customerId: "7001", email: "eleanor.whitfield@example.com", firstName: "Eleanor", lastName: "Whitfield", address1: "18 Gramercy Park S", city: "New York", province: "NY", zip: "10003" },
  { key: "james", customerId: "7002", email: "james.okafor@example.com", firstName: "James", lastName: "Okafor", address1: "2201 Pacific Ave", city: "San Francisco", province: "CA", zip: "94115" },
  { key: "sofia", customerId: "7003", email: "sofia.marchetti@example.com", firstName: "Sofia", lastName: "Marchetti", address1: "77 Beacon St", city: "Boston", province: "MA", zip: "02108" },
  { key: "daniel", customerId: "7004", email: "daniel.reyes@example.com", firstName: "Daniel", lastName: "Reyes", address1: "410 N Lake Shore Dr", city: "Chicago", province: "IL", zip: "60611" },
  { key: "margaret", customerId: "7005", email: "margaret.chen@example.com", firstName: "Margaret", lastName: "Chen", address1: "1500 Ocean Dr", city: "Miami Beach", province: "FL", zip: "33139" },
];

const FIRST = ["Amelia", "Theodore", "Clara", "Julian", "Beatrice", "Leon", "Vivienne", "Oscar", "Harriet", "Felix", "Imogen", "Arthur", "Rosalind", "Sebastian", "Iris", "Hugo", "Celia", "Rafael"];
const LAST = ["Ashford", "Bellamy", "Castellano", "Delacroix", "Everett", "Fairchild", "Grayson", "Hollis", "Ingram", "Kingsley", "Lancaster", "Montague", "Northcott", "Pemberton", "Quinlan", "Rothwell", "Sinclair", "Thorne"];
const CITIES: Array<[string, string, string]> = [["Greenwich", "CT", "06830"], ["Aspen", "CO", "81611"], ["Palm Beach", "FL", "33480"], ["Seattle", "WA", "98101"], ["Austin", "TX", "78701"], ["Santa Fe", "NM", "87501"], ["Charleston", "SC", "29401"], ["Los Angeles", "CA", "90069"], ["Nantucket", "MA", "02554"]];

/** Extra synthetic collectors to make the admin dashboard look like a real release. */
export function extraPersonas(n: number): DemoPersona[] {
  return Array.from({ length: n }, (_, i) => {
    const first = FIRST[i % FIRST.length]!;
    const last = LAST[(i * 7) % LAST.length]!;
    const [city, province, zip] = CITIES[i % CITIES.length]!;
    return { key: `extra${i}`, customerId: String(8000 + i), email: `${first}.${last}${i}@example.com`.toLowerCase(), firstName: first, lastName: last, address1: `${100 + i * 7} Collector Lane`, city, province, zip };
  });
}

export function demoOrderPayload(p: DemoPersona, opts: { orderId: string; name: string; financialStatus: string; cancelledAt?: string | null; variantId: string; quantity?: number; withAddress?: boolean }) {
  return {
    id: Number(opts.orderId),
    admin_graphql_api_id: `gid://shopify/Order/${opts.orderId}`,
    name: opts.name,
    email: p.email,
    financial_status: opts.financialStatus,
    cancelled_at: opts.cancelledAt ?? null,
    total_price: (4999 * (opts.quantity ?? 1)).toFixed(2),
    currency: "USD",
    customer: { id: Number(p.customerId), email: p.email, first_name: p.firstName, last_name: p.lastName },
    line_items: [{ variant_id: opts.variantId, quantity: opts.quantity ?? 1, title: "The Twenty-Four — Collector Edition" }],
    shipping_address:
      opts.withAddress === false
        ? null
        : { first_name: p.firstName, last_name: p.lastName, name: `${p.firstName} ${p.lastName}`, address1: p.address1, address2: null, city: p.city, province: p.province, zip: p.zip, country: "United States", country_code: "US", phone: "+1 212 555 0100" },
  };
}

export function demoRefundPayload(opts: { refundId: string; orderId: string; amount: string }) {
  return { id: Number(opts.refundId), order_id: Number(opts.orderId), transactions: [{ amount: opts.amount, kind: "refund", status: "success" }] };
}
