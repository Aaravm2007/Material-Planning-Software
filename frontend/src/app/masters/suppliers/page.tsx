import SuppliersClient from "./SuppliersClient";

async function getData() {
  try {
    const res = await fetch("http://localhost:8000/api/suppliers/", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function SuppliersPage() {
  const suppliers = await getData();
  return <SuppliersClient initialSuppliers={suppliers} />;
}
