import { apiGet } from "@/lib/apiFetch";
import TransportationClient from "./TransportationClient";

async function getData() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/rows/stage/transportation`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function TransportationPage() {
  const rows = await getData();
  return <TransportationClient initialRows={rows} />;
}
