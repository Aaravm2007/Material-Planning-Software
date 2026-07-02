"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";
import { usePolling } from "@/lib/usePolling";
import { exportToExcel } from "@/lib/exportExcel";

interface Row {
  id: number;
  uid: string;
  supplier_name: string | null;
  supplier_code: string | null;
  pi_number: string | null;
  po_number: string | null;
  rocket_item_code: string | null;
  po_total_value: string | null;
  bl_date: string | null;
  credit_time: string | null;
  confirmed_due_date: string | null;
  confirmed_payment_amt: string | null;
  confirmed_payment_exchange: string | null;
  workflow_status: string | null;
  [key: string]: string | null | number;
}

const TH: React.CSSProperties = {
  padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b",
  background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  padding: "9px 14px", fontSize: "13px", borderBottom: "1px solid #f4f4f5",
  color: "#09090b", whiteSpace: "nowrap",
};

const STAGE_LABELS: Record<string, string> = {
  po_pi: "PO/PI", pending_import: "Import ⏳", approved_import: "Import ✓",
  boe: "BOE", transportation: "Transport", due_date: "Due Date", complete: "Complete",
};

function calcEstimatedDueDate(row: Row): string | null {
  if (!row.bl_date || !row.credit_time) return null;
  const days = parseInt(row.credit_time as string, 10);
  if (isNaN(days)) return null;
  const d = new Date(row.bl_date as string);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date(new Date().toISOString().slice(0, 10));
}

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date(new Date().toISOString().slice(0, 10));
  const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 14;
}

export default function PaymentPlanClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [filter, setFilter] = useState<"all" | "upcoming" | "overdue">("all");

  async function fetchRows() {
    const res = await apiFetch(`${API}/api/rows/`);
    if (res.ok) setRows(await res.json());
  }
  useEffect(() => { fetchRows(); }, []);
  usePolling(fetchRows, 10_000);

  const rowsWithDates = rows
    .map((r) => ({ ...r, _est_due: calcEstimatedDueDate(r) }))
    .filter((r) => r._est_due || r.confirmed_due_date || r.confirmed_payment_amt);

  const filtered = rowsWithDates.filter((r) => {
    const due = r.confirmed_due_date ?? r._est_due;
    if (filter === "upcoming") return isDueSoon(due);
    if (filter === "overdue") return isOverdue(due);
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const da = a.confirmed_due_date ?? a._est_due ?? "9999";
    const db = b.confirmed_due_date ?? b._est_due ?? "9999";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>Payment Plan</h1>
        <div style={{ display: "flex", gap: "6px" }}>
          {(["all", "upcoming", "overdue"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              style={{
                padding: "5px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
                fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid",
                background: filter === f ? "#09090b" : "transparent",
                color: filter === f ? "#fff" : "#71717a",
                borderColor: filter === f ? "#09090b" : "#e4e4e7",
                textTransform: "capitalize",
              }}>
              {f === "upcoming" ? "Due ≤ 14 days" : f === "overdue" ? "Overdue" : "All"}
            </button>
          ))}
          <span style={{ marginLeft: "8px", fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa", alignSelf: "center", textTransform: "uppercase" }}>
            {sorted.length} rows
          </span>
          <button onClick={() => exportToExcel(sorted, "payment-plan", { uid: "UID", supplier_name: "Supplier", supplier_code: "Supplier Code", pi_number: "PI Number", po_number: "PO Number", rocket_item_code: "Item Code", po_total_value: "PO Total Value", bl_date: "BL Date", credit_time: "Credit Time (days)", confirmed_due_date: "Confirmed Due Date", confirmed_payment_amt: "Payment Amount", confirmed_payment_exchange: "Payment Exchange Rate", workflow_status: "Stage" })}
            style={{ padding: "5px 12px", borderRadius: "7px", border: "1px solid #e4e4e7", background: "transparent", fontSize: "12px", fontFamily: "var(--font-sans), sans-serif", color: "#71717a", cursor: "pointer", fontWeight: 600 }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#71717a"; }}>
            ↓ Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              <th style={TH}>UID</th>
              <th style={TH}>Supplier</th>
              <th style={TH}>Supp. Code</th>
              <th style={TH}>PI Number</th>
              <th style={TH}>Rocket Item Code</th>
              <th style={TH}>PO Number</th>
              <th style={TH}>PO Total Value</th>
              <th style={TH}>BL Date</th>
              <th style={TH}>Credit Time (days)</th>
              <th style={TH}>Est. Due Date</th>
              <th style={TH}>Confirmed Due Date</th>
              <th style={TH}>Payment Amt</th>
              <th style={TH}>Exchange Rate</th>
              <th style={TH}>Stage</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={15} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>
                  No payment records found
                </td>
              </tr>
            ) : sorted.map((row, i) => {
              const estDue = row._est_due;
              const confDue = row.confirmed_due_date as string | null;
              const due = confDue ?? estDue;
              const overdue = isOverdue(due);
              const soon = !overdue && isDueSoon(due);
              const rowBg = overdue ? "#fff5f5" : soon ? "#fffbeb" : "#fff";
              return (
                <tr key={row.uid}
                  onMouseEnter={(e) => (e.currentTarget.style.background = overdue ? "#fee2e2" : soon ? "#fef3c7" : "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = rowBg)}
                  style={{ background: rowBg }}>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>
                    {String(i + 1).padStart(3, "0")}
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>
                    {String(row.uid).slice(0, 8)}…
                  </td>
                  <td style={TD}>{row.supplier_name ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.supplier_code ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.pi_number ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.rocket_item_code ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.po_number ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.po_total_value ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.bl_date ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", textAlign: "center" }}>{row.credit_time ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", color: estDue ? (overdue && !confDue ? "#ef4444" : "#09090b") : "#d4d4d8" }}>
                    {estDue ?? "—"}
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontWeight: confDue ? 600 : 400, color: confDue ? (overdue ? "#ef4444" : "#09090b") : "#d4d4d8" }}>
                    {confDue ?? "—"}
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>
                    {row.confirmed_payment_amt ?? <span style={{ color: "#d4d4d8" }}>—</span>}
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>
                    {row.confirmed_payment_exchange ?? <span style={{ color: "#d4d4d8" }}>—</span>}
                  </td>
                  <td style={TD}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: "6px",
                      border: "1px solid #e4e4e7", background: "#f4f4f5",
                      fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#52525b",
                    }}>
                      {STAGE_LABELS[row.workflow_status as string] ?? row.workflow_status ?? "—"}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
