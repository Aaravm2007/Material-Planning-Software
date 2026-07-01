import TransportationClient from "./TransportationClient";

async function getData() {
  try {
    const res = await fetch("http://localhost:8000/api/rows/stage/transportation", { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function TransportationPage() {
  const rows = await getData();
  return <TransportationClient initialRows={rows} />;
}
