import { apiGet } from "@/lib/apiFetch";
import PortsClient from "./PortsClient";

async function getPorts() {
  try {
    const res = await apiGet(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/ports/`);
    if (!res.ok) return [];
    return res.json();
  } catch { return []; }
}

export default async function PortsPage() {
  const ports = await getPorts();
  return <PortsClient initialPorts={ports} />;
}
