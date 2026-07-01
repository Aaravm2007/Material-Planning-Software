import { apiGet } from "@/lib/apiFetch";
import HedgingClient from "./HedgingClient";

async function getData() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/hedging/`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export default async function HedgingPage() {
  const records = await getData();
  return <HedgingClient initialRecords={records} />;
}
