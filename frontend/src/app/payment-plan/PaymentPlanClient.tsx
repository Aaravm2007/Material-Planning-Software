"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect } from "react";
import { usePolling } from "@/lib/usePolling";
import { exportToExcel } from "@/lib/exportExcel";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";

interface Row {
  id: number;
  uid: string;
  supplier_name: string | null;
  supplier_code: string | null;
  pi_number: string | null;
  pi_total_value: string | null;
  currency: string | null;
  exchange_rate: string | null;
  rocket_item_code: string | null;
  po_total_value: string | null;
  advance_inr: string | null;
  bl_date: string | null;
  credit_time: string | null;
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

const PAYMENT_COLS_BASE = [
  { key: "supplier_name", label: "Supplier" },
  { key: "supplier_code", label: "Supp. Code" },
  { key: "pi_number", label: "PI Number" },
  { key: "rocket_item_code", label: "Rocket Item Code" },
  { key: "pi_total_value", label: "PI Total Value" },
  { key: "currency", label: "Currency" },
  { key: "exchange_rate", label: "Exchange Rate" },
  { key: "po_total_value", label: "Amount in INR" },
  { key: "advance_inr", label: "Advance (INR)" },
  { key: "bl_date", label: "BL Date" },
  { key: "credit_time", label: "Credit Time (days)" },
  { key: "_est_due", label: "Completed Payment Date" },
  { key: "confirmed_payment_amt", label: "Payment Amt" },
  { key: "confirmed_payment_exchange", label: "Payment Exchange Rate" },
  { key: "workflow_status", label: "Stage" },
];

const PAYMENT_COL_DEFS: ColDef[] = [
  { key: "supplier_name", label: "Supplier", type: "text" },
  { key: "supplier_code", label: "Supp. Code", type: "text" },
  { key: "pi_number", label: "PI Number", type: "text" },
  { key: "rocket_item_code", label: "Rocket Item Code", type: "text" },
  { key: "pi_total_value", label: "PI Total Value", type: "amount" },
  { key: "currency", label: "Currency", type: "select", options: ["USD", "INR", "CNY"] },
  { key: "exchange_rate", label: "Exchange Rate", type: "amount" },
  { key: "po_total_value", label: "Amount in INR", type: "amount" },
  { key: "advance_inr", label: "Advance (INR)", type: "amount" },
  { key: "bl_date", label: "BL Date", type: "date" },
  { key: "credit_time", label: "Credit Time (days)", type: "amount" },
  { key: "_est_due", label: "Completed Payment Date", type: "date" },
  { key: "confirmed_payment_amt", label: "Payment Amt", type: "amount" },
  { key: "confirmed_payment_exchange", label: "Payment Exchange Rate", type: "amount" },
  { key: "workflow_status", label: "Stage", type: "select", options: Object.keys(STAGE_LABELS) },
];

function calcEstimatedDueDate(row: Row): string | null {
  if (!row.bl_date || !row.credit_time) return null;
  const days = parseInt(row.credit_time as string, 10);
  if (isNaN(days)) return null;
  const d = new Date(row.bl_date as string);
  if (isNaN(d.getTime())) return null;
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function isOverdue(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d < new Date(new Date().toISOString().slice(0, 10));
}

function isDueSoon(dateStr: string | null): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
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
    .filter((r) => r._est_due || r.confirmed_payment_amt);

  const quickFiltered = rowsWithDates.filter((r) => {
    const due = r._est_due;
    if (filter === "upcoming") return isDueSoon(due);
    if (filter === "overdue") return isOverdue(due);
    return true;
  });

  // Default order (soonest payment first) — overridden once a column sort is applied.
  const dateSorted = [...quickFiltered].sort((a, b) => {
    const da = a._est_due ?? "9999";
    const db = b._est_due ?? "9999";
    return da < db ? -1 : da > db ? 1 : 0;
  });

  const { filteredRows, filters, sort, distinctValues, setFilter: setColFilter, setSort } =
    useTableState(dateSorted as unknown as Record<string, unknown>[], PAYMENT_COL_DEFS, "payment_plan");
  const sorted = filteredRows as unknown as (Row & { _est_due: string | null })[];

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
          <button onClick={() => exportToExcel(sorted, "payment-plan", Object.fromEntries(PAYMENT_COLS_BASE.map(c => [c.key, c.label])))}
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
              {PAYMENT_COLS_BASE.map((c) => {
                const isSorted = sort?.key === c.key;
                return (
                  <th key={c.key} style={{ ...TH, cursor: "pointer", userSelect: "none" }} onClick={() => setSort(c.key)}>
                    {c.label}
                    <span style={{ marginLeft: "4px", fontSize: "9px", display: "inline-flex", flexDirection: "column", lineHeight: "9px", verticalAlign: "middle", gap: "1px" }}>
                      <span style={{ color: isSorted && sort?.dir === "asc" ? "#09090b" : "#d4d4d8" }}>▲</span>
                      <span style={{ color: isSorted && sort?.dir === "desc" ? "#09090b" : "#d4d4d8" }}>▼</span>
                    </span>
                  </th>
                );
              })}
            </tr>
            <InlineFilters colDefs={PAYMENT_COL_DEFS} filters={filters} distinctValues={distinctValues} onFilter={setColFilter} leadingCells={1} />
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={PAYMENT_COLS_BASE.length + 1} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>
                  No payment records found
                </td>
              </tr>
            ) : sorted.map((row, i) => {
              const estDue = row._est_due;
              const due = estDue;
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
                  <td style={TD}>{row.supplier_name ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.supplier_code ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.pi_number ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.rocket_item_code ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.pi_total_value ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.currency ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.exchange_rate ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.po_total_value ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.advance_inr ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{row.bl_date ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", textAlign: "center" }}>{row.credit_time ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", color: estDue ? (overdue ? "#ef4444" : "#09090b") : "#d4d4d8" }}>
                    {estDue ?? "—"}
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
