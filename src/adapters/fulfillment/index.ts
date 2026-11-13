import "server-only";
import { env } from "@/lib/env";
import { manualExport } from "./manual";
import type { FulfillmentAdapter } from "./types";

export function fulfillmentAdapter(): FulfillmentAdapter {
  const provider = env.fulfillment.provider();
  switch (provider) {
    case "manual":
      return manualExport(env.fulfillment.labName());
    // case "<lab>": return labApi;  ← add once the print lab confirms an API
    default:
      throw new Error(`Unknown FULFILLMENT_PROVIDER "${provider}"`);
  }
}
export type { PrintJob, SubmitResult, FulfillmentAdapter } from "./types";
