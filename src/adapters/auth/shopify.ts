import "server-only";
import { env } from "@/lib/env";
import { shopifyId } from "@/lib/shopify-order";

// Shopify Customer Account API: OAuth 2.0 authorization code + PKCE (confidential client).
// Docs: https://shopify.dev/docs/api/customer  (endpoints are discovered, not hard-coded)

export type LoginIdentity = { shopifyCustomerId: string; email: string; firstName: string | null; lastName: string | null };

type Discovery = { issuer: string; authorization_endpoint: string; token_endpoint: string; end_session_endpoint?: string };
let discoveryCache: { at: number; oidc: Discovery; graphqlApi: string } | null = null;

async function discover() {
  if (discoveryCache && Date.now() - discoveryCache.at < 3600_000) return discoveryCache;
  const domain = env.shopify.storeDomain();
  const [oidc, api] = await Promise.all([
    fetch(`https://${domain}/.well-known/openid-configuration`, { cache: "no-store" }).then((r) => r.json() as Promise<Discovery>),
    fetch(`https://${domain}/.well-known/customer-account-api`, { cache: "no-store" }).then((r) => r.json() as Promise<{ graphql_api: string }>),
  ]);
  discoveryCache = { at: Date.now(), oidc, graphqlApi: api.graphql_api };
  return discoveryCache;
}

export const shopifyAuthConfigured = () => Boolean(env.shopify.storeDomain() && env.shopify.customerClientId() && env.shopify.customerClientSecret());

export async function authorizeUrl(p: { state: string; nonce: string; challenge: string; redirectUri: string }) {
  const { oidc } = await discover();
  const url = new URL(oidc.authorization_endpoint);
  url.search = new URLSearchParams({
    scope: "openid email customer-account-api:full",
    client_id: env.shopify.customerClientId(),
    response_type: "code",
    redirect_uri: p.redirectUri,
    state: p.state,
    nonce: p.nonce,
    code_challenge: p.challenge,
    code_challenge_method: "S256",
  }).toString();
  return url.toString();
}

function decodeJwtPayload(jwt: string): Record<string, unknown> {
  const part = jwt.split(".")[1];
  if (!part) throw new Error("Malformed id_token");
  return JSON.parse(Buffer.from(part, "base64url").toString()) as Record<string, unknown>;
}

export async function exchangeCode(p: { code: string; verifier: string; redirectUri: string; nonce: string }): Promise<LoginIdentity> {
  const { oidc, graphqlApi } = await discover();
  const clientId = env.shopify.customerClientId();
  const res = await fetch(oidc.token_endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${env.shopify.customerClientSecret()}`).toString("base64")}`,
    },
    body: new URLSearchParams({ grant_type: "authorization_code", client_id: clientId, redirect_uri: p.redirectUri, code: p.code, code_verifier: p.verifier }),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Token exchange failed (${res.status})`);
  const tokens = (await res.json()) as { access_token: string; id_token?: string };

  // The id_token came straight from the token endpoint over TLS with client authentication (OIDC Core 3.1.3.7),
  // so we validate its claims; the signature check is optional in this flow.
  if (tokens.id_token) {
    const c = decodeJwtPayload(tokens.id_token);
    const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
    if (c.iss !== oidc.issuer || !aud.includes(clientId) || Number(c.exp) * 1000 < Date.now() || c.nonce !== p.nonce) {
      throw new Error("id_token claims did not validate");
    }
  }

  const q = await fetch(graphqlApi, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: tokens.access_token },
    body: JSON.stringify({ query: "{ customer { id firstName lastName emailAddress { emailAddress } } }" }),
    cache: "no-store",
  });
  const data = (await q.json()) as { data?: { customer?: { id: string; firstName: string | null; lastName: string | null; emailAddress: { emailAddress: string } | null } } };
  const c = data.data?.customer;
  if (!c?.emailAddress?.emailAddress) throw new Error("Could not read the customer from Shopify");
  return { shopifyCustomerId: shopifyId(c.id)!, email: c.emailAddress.emailAddress.toLowerCase(), firstName: c.firstName, lastName: c.lastName };
}
