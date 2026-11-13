export const CARRIERS = ["UPS", "FedEx", "USPS", "DHL"] as const;
export type Carrier = (typeof CARRIERS)[number];

export function trackingUrl(carrier: string | null | undefined, number: string | null | undefined): string | null {
  if (!carrier || !number) return null;
  const n = encodeURIComponent(number.trim());
  switch (carrier) {
    case "UPS":
      return `https://www.ups.com/track?tracknum=${n}`;
    case "FedEx":
      return `https://www.fedex.com/fedextrack/?trknbr=${n}`;
    case "USPS":
      return `https://tools.usps.com/go/TrackConfirmAction?tLabels=${n}`;
    case "DHL":
      return `https://www.dhl.com/us-en/home/tracking/tracking-express.html?tracking-id=${n}`;
    default:
      return null;
  }
}
