import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";
import { testDatabaseUrl } from "./tests/test-db-url.ts";

// Tests use their own database (…/advent_test), created + migrated in globalSetup.
const testUrl = testDatabaseUrl();

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    // DB tests share one Postgres database; run files one after another.
    fileParallelism: false,
    testTimeout: 60_000,
    env: {
      DATABASE_URL: testUrl,
      DATABASE_URL_UNPOOLED: testUrl,
      ADVENT_YEAR: "2026",
      EDITION_SIZE: "100",
      SHOPIFY_COLLECTION_VARIANT_IDS: "demo-variant-1",
      SHOPIFY_ADMIN_ACCESS_TOKEN: "",
      SHOPIFY_STORE_DOMAIN: "",
      SHOPIFY_WEBHOOK_SECRET: "test-webhook-secret",
      SUPABASE_URL: "",
      ADMIN_EMAILS: "curator@example.com",
      FULFILLMENT_PROVIDER: "manual",
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./tests/stubs/empty.ts", import.meta.url)),
    },
  },
});
