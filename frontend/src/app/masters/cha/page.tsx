import ChaClient from "./ChaClient";

export const dynamic = "force-dynamic";

async function fetchCha() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/cha/`, { cache: "no-store" });
    return res.ok ? res.json() : [];
  } catch { return []; }
}

export default async function ChaPage() {
  const records = await fetchCha();
  return <ChaClient initialRecords={records} />;
}
