import CreditClient from "./CreditClient";

async function getCredits() {
  try {
    const res = await fetch("http://localhost:8000/api/credit/", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function CreditPage() {
  const records = await getCredits();
  return <CreditClient initialRecords={records} />;
}
