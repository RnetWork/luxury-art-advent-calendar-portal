import type { ShippingAddress } from "@/db/schema";

export type PrintJob = {
  fulfillmentOrderId: string;
  orderName: string;
  editionNumber: number | null;
  editionSize: number;
  collectorName: string;
  email: string;
  shipTo: ShippingAddress;
  prints: Array<{ day: number; sku: string; title: string }>;
};

export type SubmitResult =
  | { mode: "export"; filename: string; csv: string }
  | { mode: "api"; references: Record<string, string> };

/**
 * A print lab. `manual` exports a CSV the owner sends to the lab; a real lab API implements the same
 * interface in src/adapters/fulfillment/<lab>.ts once the supplier confirms one.
 */
export interface FulfillmentAdapter {
  readonly name: string;
  readonly label: string;
  submit(jobs: PrintJob[]): Promise<SubmitResult>;
}
