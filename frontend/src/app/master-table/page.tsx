import { apiGet } from "@/lib/apiFetch";
import MasterTableClient from "./MasterTableClient";

async function getRows() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/rows/`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function MasterTablePage() {
  const rows = await getRows();
  return <MasterTableClient initialRows={rows} />;
}
