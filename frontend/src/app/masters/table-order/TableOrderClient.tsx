"use client";
import { useState, useEffect } from "react";
import { API, apiFetch } from "@/lib/apiFetch";
import { useRole } from "@/components/RoleContext";
import { applyColumnOrder } from "@/lib/columnOrder";

import { PO_PI_COLS_BASE } from "@/app/po-pi/PoPiClient";
import { BOE_FILTER_DEFS_BASE } from "@/app/boe/BoeClient";
import { TRANSPORT_COL_DEFS_BASE } from "@/app/transportation/TransportationClient";
import { DUEDATE_COL_DEFS_BASE } from "@/app/due-date/DueDateClient";
import { APPROVED_COL_DEFS_BASE } from "@/app/import-planning/ImportPlanningClient";
import { ORDER_PLANNING_COLS_BASE } from "@/app/order-planning/OrderPlanningClient";
import { COLUMNS as MASTER_COLUMNS } from "@/components/DataTable";

interface ColInfo { key: string; label: string }
interface TableDef { id: string; label: string; cols: ColInfo[] }

const TABLE_DEFS: TableDef[] = [
  { id: "master_table",    label: "Master Table",     cols: MASTER_COLUMNS },
  { id: "order_planning",  label: "Order Planning",   cols: ORDER_PLANNING_COLS_BASE },
  { id: "po_pi",           label: "PO / PI",          cols: PO_PI_COLS_BASE },
  { id: "import_planning", label: "Freight Planning", cols: APPROVED_COL_DEFS_BASE },
  { id: "boe",             label: "BOE",              cols: BOE_FILTER_DEFS_BASE },
  { id: "transportation",  label: "Transportation",   cols: TRANSPORT_COL_DEFS_BASE },
  { id: "due_date",        label: "Due Date",         cols: DUEDATE_COL_DEFS_BASE },
];

const btnStyle = (v: "primary" | "ghost"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(v === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
                        { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

export default function TableOrderClient() {
  const { role } = useRole();
  const isExpert = role === "expert";
  const [activeId, setActiveId] = useState(TABLE_DEFS[0].id);
  const [draft, setDraft] = useState<ColInfo[]>([]);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const activeDef = TABLE_DEFS.find((t) => t.id === activeId)!;

  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    setSaveError(null);
    setSavedAt(null);
    apiFetch(`${API}/api/table-order/${activeId}`)
      .then((res) => (res.ok ? res.json() : { column_order: null }))
      .then((data) => {
        if (cancelled) return;
        setDraft(applyColumnOrder(activeDef.cols, data.column_order ?? null));
        setLoaded(true);
      })
      .catch(() => {
        if (cancelled) return;
        setDraft(activeDef.cols);
        setLoaded(true);
      });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  function handleDrop(targetIndex: number) {
    if (dragIndex === null || dragIndex === targetIndex) return;
    setDraft((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(targetIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    const res = await apiFetch(`${API}/api/table-order/${activeId}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column_order: draft.map((c) => c.key) }),
    });
    if (res.ok) {
      setSavedAt(Date.now());
    } else if (res.status === 403) {
      setSaveError("You don't have permission to save this (expert access required).");
    } else {
      setSaveError("Save failed — please try again.");
    }
    setSaving(false);
  }

  function handleReset() {
    setDraft(activeDef.cols);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>Table Order</h1>
        <p style={{ margin: "6px 0 0", fontSize: "12px", color: "#71717a" }}>
          {isExpert
            ? "Drag columns to reorder them, then Save. The new order applies for everyone."
            : "Current column order for each table (read-only — only experts can change it)."}
        </p>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: "flex", gap: "12px", overflow: "hidden" }}>
        <div style={{ width: "200px", flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", overflow: "auto", background: "#fff" }}>
          {TABLE_DEFS.map((t) => (
            <button key={t.id} onClick={() => setActiveId(t.id)}
              style={{
                display: "block", width: "100%", textAlign: "left", padding: "10px 14px",
                border: "none", borderBottom: "1px solid #f4f4f5", cursor: "pointer",
                background: t.id === activeId ? "#f4f4f5" : "transparent",
                fontWeight: t.id === activeId ? 600 : 400,
                fontSize: "13px", fontFamily: "var(--font-sans), sans-serif",
                color: "#09090b",
              }}>
              {t.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 0, border: "1px solid #e4e4e7", borderRadius: "12px", overflow: "auto", background: "#fff", padding: "8px" }}>
          {!loaded ? (
            <div style={{ padding: "24px", color: "#a1a1aa", fontSize: "13px" }}>Loading…</div>
          ) : (
            <ol style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "4px" }}>
              {draft.map((col, i) => (
                <li key={col.key}
                  draggable={isExpert}
                  onDragStart={() => setDragIndex(i)}
                  onDragOver={(e) => { if (isExpert) e.preventDefault(); }}
                  onDrop={() => handleDrop(i)}
                  style={{
                    display: "flex", alignItems: "center", gap: "10px",
                    padding: "9px 12px", borderRadius: "8px", border: "1px solid #e4e4e7",
                    background: "#fafafa", fontSize: "13px", fontFamily: "var(--font-sans), sans-serif",
                    cursor: isExpert ? "grab" : "default",
                  }}>
                  <span style={{ width: "20px", textAlign: "right", color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", fontSize: "11px" }}>{i + 1}</span>
                  {isExpert && <span style={{ color: "#d4d4d8" }}>⠿</span>}
                  <span style={{ color: "#09090b" }}>{col.label}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {isExpert && (
        <div style={{ flexShrink: 0, display: "flex", gap: "12px", justifyContent: "flex-end", alignItems: "center" }}>
          {saveError && <span style={{ fontSize: "12px", color: "#ef4444" }}>{saveError}</span>}
          {!saveError && savedAt && <span style={{ fontSize: "12px", color: "#16a34a" }}>Saved</span>}
          <button style={btnStyle("ghost")} onClick={handleReset}>Reset to Default</button>
          <button style={btnStyle("primary")} onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save Order"}</button>
        </div>
      )}
    </div>
  );
}
