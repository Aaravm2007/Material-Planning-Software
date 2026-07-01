import PoPiClient from "./PoPiClient";

async function getRows() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/rows/stage/po_pi`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function PoPiPage() {
  const rows = await getRows();
  return <PoPiClient initialRows={rows} />;
}
