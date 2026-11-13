import { ingestShopifyWebhook } from "@/server/orders";

// Shopify → us. Raw body is required for the HMAC, so read text() before parsing.
export async function POST(req: Request) {
  const rawBody = await req.text();
  const result = await ingestShopifyWebhook({
    rawBody,
    hmac: req.headers.get("x-shopify-hmac-sha256"),
    topic: req.headers.get("x-shopify-topic"),
    webhookId: req.headers.get("x-shopify-webhook-id") ?? req.headers.get("x-shopify-event-id"),
    shopDomain: req.headers.get("x-shopify-shop-domain"),
  });
  return new Response(result.body, { status: result.status, headers: { "Content-Type": "text/plain" } });
}
