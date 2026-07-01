import HedgingClient from "./HedgingClient";

async function getData() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/hedging/`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function HedgingPage() {
  const records = await getData();
  return <HedgingClient initialRecords={records} />;
}
