import ShippingLinesClient from "./ShippingLinesClient";

async function getShippingLines() {
  try {
    const res = await fetch("http://localhost:8000/api/shipping-lines/", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function ShippingLinesPage() {
  const lines = await getShippingLines();
  return <ShippingLinesClient initialLines={lines} />;
}
