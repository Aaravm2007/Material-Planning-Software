import { apiGet } from "@/lib/apiFetch";
import SuppliersClient from "./SuppliersClient";

async function getData() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/suppliers/`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function SuppliersPage() {
  const suppliers = await getData();
  return <SuppliersClient initialSuppliers={suppliers} />;
}
