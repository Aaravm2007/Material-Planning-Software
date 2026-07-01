import { apiGet } from "@/lib/apiFetch";
import OrderPlanningClient from "./OrderPlanningClient";

async function getPlans() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/order-plans/`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function OrderPlanningPage() {
  const plans = await getPlans();
  return <OrderPlanningClient initialPlans={plans} />;
}
