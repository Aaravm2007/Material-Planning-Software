import BoeClient from "./BoeClient";

async function getData() {
  try {
    const res = await fetch("http://localhost:8000/api/rows/stage/boe", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function BoePage() {
  const rows = await getData();
  return <BoeClient initialRows={rows} />;
}
