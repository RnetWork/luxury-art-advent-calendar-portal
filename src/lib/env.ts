import "server-only";

// Read lazily so tests (and the dev server) see the current process.env.
const str = (k: string) => (process.env[k] ?? "").trim();
const list = (k: string) =>
  str(k)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

export const env = {
  appUrl: () => str("APP_URL") || "http://localhost:3100",
  /** Demo features (mock login, demo clock, event simulator). Never on in Vercel production. */
  demoMode: () => str("DEMO_MODE") === "true" && str("VERCEL_ENV") !== "production",
  adventYear: () => Number(str("ADVENT_YEAR") || new Date().getUTCFullYear()),
  editionSize: () => Number(str("EDITION_SIZE") || 100),
  adminEmails: () => list("ADMIN_EMAILS").map((e) => e.toLowerCase()),
  sessionSecret: () => {
    const s = str("SESSION_SECRET");
    if (s.length >= 32) return s;
    if (env.demoMode() || process.env.NODE_ENV === "test") return "dev-only-session-secret-change-me-0000";
    throw new Error("SESSION_SECRET must be set (32+ chars)");
  },
  shopify: {
    storeDomain: () => str("SHOPIFY_STORE_DOMAIN"),
    apiVersion: () => str("SHOPIFY_API_VERSION") || "2026-07",
    shopId: () => str("SHOPIFY_SHOP_ID"),
    customerClientId: () => str("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID"),
    customerClientSecret: () => str("SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_SECRET"),
    adminToken: () => str("SHOPIFY_ADMIN_ACCESS_TOKEN"),
    /** Webhook HMAC key. Falls back to a local secret only in demo mode / tests. */
    webhookSecret: () => {
      const s = str("SHOPIFY_WEBHOOK_SECRET");
      if (s) return s;
      if (env.demoMode() || process.env.NODE_ENV === "test") return "dev-webhook-secret";
      return "";
    },
    collectionVariantIds: () => list("SHOPIFY_COLLECTION_VARIANT_IDS"),
  },
  supabase: {
    url: () => str("SUPABASE_URL"),
    serviceKey: () => str("SUPABASE_SERVICE_ROLE_KEY"),
    bucket: () => str("SUPABASE_STORAGE_BUCKET") || "artworks",
  },
  fulfillment: {
    provider: () => str("FULFILLMENT_PROVIDER") || "manual",
    labName: () => str("PRINT_LAB_NAME") || "Print lab (manual export)",
    skuPrefix: () => str("PRINT_SKU_PREFIX") || "ADV",
  },
};
