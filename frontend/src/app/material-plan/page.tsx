import { apiGet } from "@/lib/apiFetch";
import MaterialPlanClient from "./MaterialPlanClient";

async function getRows() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/rows/`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export default async function MaterialPlanPage() {
  const rows = await getRows();
  return <MaterialPlanClient initialRows={rows} />;
}
