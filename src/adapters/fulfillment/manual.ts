import { toCsv } from "@/lib/csv";
import type { FulfillmentAdapter } from "./types";

const COLUMNS = [
  "order", "edition", "print_day", "sku", "title", "quantity", "ship_name", "ship_company", "address1", "address2",
  "city", "state", "zip", "country", "phone", "email", "fulfillment_id",
];

export function manualExport(label: string): FulfillmentAdapter {
  return {
    name: "manual",
    label,
    async submit(jobs) {
      const rows = jobs.flatMap((j) =>
        j.prints.map((p) => ({
          order: j.orderName,
          edition: j.editionNumber ? `${j.editionNumber}/${j.editionSize}` : "",
          print_day: p.day,
          sku: p.sku,
          title: p.title,
          quantity: 1,
          ship_name: j.shipTo.name,
          ship_company: j.shipTo.company ?? "",
          address1: j.shipTo.address1,
          address2: j.shipTo.address2 ?? "",
          city: j.shipTo.city,
          state: j.shipTo.province ?? "",
          zip: j.shipTo.zip,
          country: j.shipTo.countryCode ?? j.shipTo.country,
          phone: j.shipTo.phone ?? "",
          email: j.email,
          fulfillment_id: j.fulfillmentOrderId,
        })),
      );
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-");
      return { mode: "export", filename: `print-orders-${stamp}.csv`, csv: toCsv(rows, COLUMNS) };
    },
  };
}
