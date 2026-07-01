import { apiGet } from "@/lib/apiFetch";
import CreditClient from "./CreditClient";

async function getCredits() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/credit/`);
    if (!res.ok) return [];
    return await res.json();
  } catch { return []; }
}

export default async function CreditPage() {
  const records = await getCredits();
  return <CreditClient initialRecords={records} />;
}
