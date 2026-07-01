import { apiGet } from "@/lib/apiFetch";
import ShippingLinesClient from "./ShippingLinesClient";

async function getShippingLines() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/shipping-lines/`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function ShippingLinesPage() {
  const lines = await getShippingLines();
  return <ShippingLinesClient initialLines={lines} />;
}
