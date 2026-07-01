import { apiGet } from "@/lib/apiFetch";
import ImportPlanningClient from "./ImportPlanningClient";

async function getRows(stage: string) {
  try {
    const res = await fetch(`http://localhost:8000/api/rows/stage/${stage}`, { cache: "no-store" });
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export default async function ImportPlanningPage() {
  const [pending, approved] = await Promise.all([
    getRows("pending_import"),
    getRows("approved_import"),
  ]);
  return <ImportPlanningClient initialPending={pending} initialApproved={approved} />;
}
