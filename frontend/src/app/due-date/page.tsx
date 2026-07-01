import { apiGet } from "@/lib/apiFetch";
import DueDateClient from "./DueDateClient";

async function getData() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/rows/stage/due_date`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export default async function DueDatePage() {
  const rows = await getData();
  return <DueDateClient initialRows={rows} />;
}
