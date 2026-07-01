import { apiGet } from "@/lib/apiFetch";
import PaymentPlanClient from "./PaymentPlanClient";

async function getData() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/rows/`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export default async function PaymentPlanPage() {
  const rows = await getData();
  return <PaymentPlanClient initialRows={rows} />;
}
