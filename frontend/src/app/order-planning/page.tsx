import OrderPlanningClient from "./OrderPlanningClient";

async function getPlans() {
  try {
    const res = await fetch("http://localhost:8000/api/order-plans/", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function OrderPlanningPage() {
  const plans = await getPlans();
  return <OrderPlanningClient initialPlans={plans} />;
}
