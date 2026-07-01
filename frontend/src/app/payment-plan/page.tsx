import PaymentPlanClient from "./PaymentPlanClient";

async function getData() {
  try {
    const res = await fetch("http://localhost:8000/api/rows/", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function PaymentPlanPage() {
  const rows = await getData();
  return <PaymentPlanClient initialRows={rows} />;
}
