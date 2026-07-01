import DueDateClient from "./DueDateClient";

async function getData() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/rows/stage/due_date`, { cache: "no-store" });
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function DueDatePage() {
  const rows = await getData();
  return <DueDateClient initialRows={rows} />;
}
