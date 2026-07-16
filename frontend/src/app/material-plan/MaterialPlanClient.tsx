"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect, useRef } from "react";
import { SHIPMENT_STATUSES } from "@/app/import-planning/ImportPlanningClient";
import { exportToExcel } from "@/lib/exportExcel";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";
import { useDensity } from "@/components/DensityContext";

const MATPLAN_COL_DEFS: ColDef[] = [
  { key: "workflow_status", label: "Stage",           type: "select", options: ["po_pi","pending_import","approved_import","boe","transportation","due_date","complete"] },
  { key: "shipment_status", label: "Shipment Status", type: "select", options: ["Pre-Shipment","Shipped","At Destination Port","Under Customs Clearance","Customs Cleared","In Transit to Warehouse","Received"] },
  { key: "allocated_month", label: "Allocated Month", type: "text"   },
  { key: "supplier_name",   label: "Supplier",        type: "text"   },
  { key: "pi_number",       label: "PI Number",       type: "text"   },
  { key: "pi_date",         label: "PI Date",         type: "date"   },
  { key: "pi_quantity",     label: "PI Quantity",     type: "amount" },
  { key: "etd",             label: "ETD",             type: "date"   },
  { key: "confirmed_eta",   label: "Confirmed ETA",   type: "date"   },
  { key: "estimated_eta",   label: "Estimated ETA",   type: "date"   },
  { key: "port",            label: "Port",            type: "text"   },
];

interface Row {
  id: number;
  uid: string;
  workflow_status: string | null;
  shipment_status: string | null;
  allocated_month: string | null;
  supplier_name: string | null;
  pi_number: string | null;
  pi_date: string | null;
  pi_quantity: string | null;
  confirmed_exworks: string | null;
  tentative_exworks_at_po_time: string | null;
  etd: string | null;
  confirmed_eta: string | null;
  estimated_eta: string | null;
  port: string | null;
  [key: string]: string | null | number;
}

const POLL_MS = 15_000;

const STAGE_LABELS: Record<string, string> = {
  po_pi:          "PO/PI",
  pending_import: "Import ⏳",
  approved_import:"Import ✓",
  boe:            "BOE",
  transportation: "Transport",
  due_date:       "Due Date",
  complete:       "Complete",
};

const STAGE_COLOR: Record<string, { bg: string; color: string; border: string }> = {
  po_pi:          { bg: "#f4f4f5", color: "#71717a",  border: "#e4e4e7" },
  pending_import: { bg: "#fffbeb", color: "#92400e",  border: "#fcd34d" },
  approved_import:{ bg: "#f0fdf4", color: "#166534",  border: "#86efac" },
  boe:            { bg: "#eff6ff", color: "#1d4ed8",  border: "#93c5fd" },
  transportation: { bg: "#faf5ff", color: "#6b21a8",  border: "#d8b4fe" },
  due_date:       { bg: "#fff7ed", color: "#9a3412",  border: "#fdba74" },
  complete:       { bg: "#f0fdf4", color: "#166534",  border: "#86efac" },
};

function exworks(row: Row): { value: string; tentative: boolean } | null {
  if (row.confirmed_exworks) return { value: row.confirmed_exworks, tentative: false };
  if (row.tentative_exworks_at_po_time) return { value: row.tentative_exworks_at_po_time, tentative: true };
  return null;
}

function eta(row: Row): { value: string; tentative: boolean } | null {
  if (row.confirmed_eta) return { value: row.confirmed_eta, tentative: false };
  if (row.estimated_eta) return { value: row.estimated_eta, tentative: true };
  return null;
}

export default function MaterialPlanClient({ initialRows }: { initialRows: Row[] }) {
  const { compact } = useDensity();
  const TH: React.CSSProperties = {
    padding: compact ? "4px 8px" : "10px 16px", textAlign: "left", fontSize: "11px", fontWeight: 600,
    letterSpacing: "0.07em", textTransform: "uppercase", color: "#09090b",
    background: "#fafafa", borderBottom: "1px solid #b8b8bf", whiteSpace: "nowrap",
    fontFamily: "var(--font-sans), sans-serif",
  };
  const TD: React.CSSProperties = {
    padding: compact ? "4px 8px" : "10px 16px", fontSize: "13px", borderBottom: "1px solid #d4d4d8",
    color: "#09090b", whiteSpace: "nowrap", fontFamily: "var(--font-sans), sans-serif",
  };
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const { filteredRows, filters, sort, distinctValues, setFilter, setSort } =
    useTableState(rows as unknown as Record<string, unknown>[], MATPLAN_COL_DEFS, "material_plan");

  async function fetchRows() {
    try {
      const res = await apiFetch(`${API}/api/rows/`, { cache: "no-store" });
      if (res.ok) { setRows(await res.json()); setLastUpdated(new Date()); }
    } catch {}
  }

  useEffect(() => {
    fetchRows();
    intervalRef.current = setInterval(fetchRows, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") fetchRows(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Exclude complete rows (filteredRows already apply any user filters)
  const filtered = (filteredRows as Row[]).filter((r) => r.workflow_status !== "complete");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: "0 0 2px" }}>
            Material Plan
          </h1>
          <p style={{ margin: 0, fontSize: "12px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa" }}>
            {filtered.length} active shipment{filtered.length !== 1 ? "s" : ""} · {lastUpdated.toLocaleTimeString()}
          </p>
        </div>
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <button onClick={fetchRows}
            style={{ padding: "6px 12px", borderRadius: "7px", border: "1px solid #e4e4e7", background: "transparent", fontSize: "11px", fontFamily: "var(--font-sans), sans-serif", color: "#71717a", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#71717a"; }}>
            ↺ Refresh
          </button>
          <button onClick={() => exportToExcel(filtered, "material-plan", Object.fromEntries(MATPLAN_COL_DEFS.map(c => [c.key, c.label])))}
            style={{ padding: "6px 12px", borderRadius: "7px", border: "1px solid #e4e4e7", background: "transparent", fontSize: "11px", fontFamily: "var(--font-sans), sans-serif", color: "#71717a", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#71717a"; }}>
            ↓ Export
          </button>
        </div>
      </div>

      {/* Table */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: compact ? undefined : "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              {[
                { key: "workflow_status", label: "Stage" },

                { key: "shipment_status", label: "Shipment Status" },
                { key: "allocated_month", label: "Allocated Month" },
                { key: "supplier_name",   label: "Supplier" },
                { key: "pi_number",       label: "PI Number" },
                { key: "pi_date",         label: "PI Date" },
                { key: "pi_quantity",     label: "PI Quantity" },
                { key: "_exworks",        label: "Ex-Works" },
                { key: "etd",             label: "ETD" },
                { key: "_eta",            label: "ETA" },
                { key: "port",            label: "Port" },
              ].map((c) => {
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
            <InlineFilters colDefs={MATPLAN_COL_DEFS} filters={filters} distinctValues={distinctValues} onFilter={setFilter} leadingCells={1} />
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>
                  {"No active shipments"}
                </td>
              </tr>
            ) : filtered.map((row, i) => {
              const ew = exworks(row);
              const et = eta(row);
              const stage = row.workflow_status ?? "";
              const stageStyle = STAGE_COLOR[stage] ?? STAGE_COLOR.po_pi;

              return (
                <tr key={row.uid}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                  <td style={{ ...TD, color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", fontSize: "11px" }}>
                    {String(i + 1).padStart(3, "0")}
                  </td>
                  <td style={TD}>
                    <span style={{
                      display: "inline-block", padding: "2px 8px", borderRadius: "6px",
                      fontSize: "11px", fontWeight: 600, fontFamily: "var(--font-mono), monospace",
                      background: stageStyle.bg, color: stageStyle.color, border: `1px solid ${stageStyle.border}`,
                      whiteSpace: "nowrap",
                    }}>
                      {STAGE_LABELS[stage] ?? stage}
                    </span>
                  </td>
                  <td style={TD}>
                    {(() => {
                      const ss = row.shipment_status;
                      if (!ss) return <span style={{ color: "#d4d4d8" }}>—</span>;
                      const meta = SHIPMENT_STATUSES.find((s) => s.value === ss);
                      return (
                        <span style={{
                          display: "inline-block", padding: "2px 10px", borderRadius: "6px",
                          fontSize: "11px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif",
                          background: meta?.bg ?? "#f4f4f5", color: meta?.color ?? "#71717a",
                          border: `1px solid ${meta?.border ?? "#e4e4e7"}`, whiteSpace: "nowrap",
                        }}>
                          {ss}
                        </span>
                      );
                    })()}
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>
                    {row.allocated_month ?? <span style={{ color: "#d4d4d8" }}>—</span>}
                  </td>
                  <td style={TD}>{row.supplier_name ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontWeight: 600 }}>
                    {row.pi_number ?? <span style={{ color: "#d4d4d8", fontWeight: 400 }}>—</span>}
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>
                    {row.pi_date ?? <span style={{ color: "#d4d4d8" }}>—</span>}
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>
                    {row.pi_quantity ?? <span style={{ color: "#d4d4d8" }}>—</span>}
                  </td>
                  <td style={TD}>
                    {ew ? (
                      <span>
                        <span style={{ fontFamily: "var(--font-mono), monospace" }}>{ew.value}</span>
                        {ew.tentative && (
                          <span style={{ marginLeft: "6px", fontSize: "10px", color: "#a1a1aa", fontFamily: "var(--font-sans), sans-serif" }}>(tentative)</span>
                        )}
                      </span>
                    ) : <span style={{ color: "#d4d4d8" }}>—</span>}
                  </td>
                  <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>
                    {row.etd ?? <span style={{ color: "#d4d4d8" }}>—</span>}
                  </td>
                  <td style={TD}>
                    {et ? (
                      <span>
                        <span style={{ fontFamily: "var(--font-mono), monospace" }}>{et.value}</span>
                        {et.tentative && (
                          <span style={{ marginLeft: "6px", fontSize: "10px", color: "#a1a1aa", fontFamily: "var(--font-sans), sans-serif" }}>(tentative)</span>
                        )}
                      </span>
                    ) : <span style={{ color: "#d4d4d8" }}>—</span>}
                  </td>
                  <td style={TD}>{row.port ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
