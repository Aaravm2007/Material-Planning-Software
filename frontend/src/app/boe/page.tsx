import { apiGet } from "@/lib/apiFetch";
import BoeClient from "./BoeClient";

async function getData() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/rows/stage/boe`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export default async function BoePage() {
  const rows = await getData();
  return <BoeClient initialRows={rows} />;
}
