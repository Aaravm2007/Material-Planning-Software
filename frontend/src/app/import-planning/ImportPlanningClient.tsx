"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState } from "react";
import { useRole } from "@/components/RoleContext";
import AmountInput from "@/components/AmountInput";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";

const PENDING_COL_DEFS: ColDef[] = [
  { key: "supplier_name",    label: "Supplier",      type: "text" },
  { key: "supplier_code",    label: "Supp. Code",    type: "text" },
  { key: "pi_number",        label: "PI Number",     type: "text" },
  { key: "rocket_item_code", label: "Item Code",     type: "text" },
];

const APPROVED_COL_DEFS: ColDef[] = [
  { key: "shipment_status",              label: "Status",          type: "select", options: ["Pre-Shipment","Shipped","At Destination Port","Under Customs Clearance","Customs Cleared","In Transit to Warehouse","Received"] },
  { key: "supplier_name",                label: "Supplier",        type: "text"   },
  { key: "supplier_code",                label: "Supp. Code",      type: "text"   },
  { key: "pi_number",                    label: "PI Number",       type: "text"   },
  { key: "etd",                          label: "ETD",             type: "date"   },
  { key: "port",                         label: "Port",            type: "text"   },
  { key: "shipping_company",             label: "Shipping Co.",    type: "text"   },
  { key: "freight_charges",              label: "Freight",         type: "amount" },
  { key: "estimated_destination_charges",label: "Dest. Charges",   type: "amount" },
  { key: "bl_no",                        label: "BL No",           type: "text"   },
  { key: "bl_date",                      label: "BL Date",         type: "date"   },
  { key: "insurance",                    label: "Insurance",       type: "amount" },
  { key: "estimated_eta",                label: "Est. ETA",        type: "date"   },
  { key: "confirmed_eta",                label: "Conf. ETA",       type: "date"   },
];

interface Row { id: number; uid: string; supplier_name: string | null; supplier_code: string | null; rocket_item_code: string | null; [key: string]: string | null | number; }
interface ShippingOption { id: number; uid: string; name: string | null; shipping_line: string | null; freight: string | null; etd: string | null; eta: string | null; port: string | null; currency: string | null; exchange_rate: string | null; }
interface ShippingLine { id: number; name: string; }
interface Port { id: number; name: string; }


export const SHIPMENT_STATUSES = [
  { value: "Pre-Shipment",           color: "#71717a", bg: "#f4f4f5", border: "#e4e4e7" },
  { value: "Shipped",                color: "#1d4ed8", bg: "#eff6ff", border: "#93c5fd" },
  { value: "At Destination Port",    color: "#92400e", bg: "#fffbeb", border: "#fcd34d" },
  { value: "Under Customs Clearance",color: "#9a3412", bg: "#fff7ed", border: "#fdba74" },
  { value: "Customs Cleared",        color: "#166534", bg: "#f0fdf4", border: "#86efac" },
  { value: "In Transit to Warehouse",color: "#6b21a8", bg: "#faf5ff", border: "#d8b4fe" },
  { value: "Received",               color: "#166534", bg: "#dcfce7", border: "#4ade80" },
];

const btnStyle = (variant: "primary" | "danger" | "ghost" | "action" | "expert"): React.CSSProperties => ({
  padding: "5px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(variant === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     variant === "expert"   ? { background: "#18181b", color: "#a1a1aa", borderColor: "#3f3f46" } :
     variant === "danger"   ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
     variant === "action"   ? { background: "#f4f4f5", color: "#09090b", borderColor: "#e4e4e7" } :
                               { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  padding: "6px 9px", borderRadius: "6px", border: "1px solid #e4e4e7",
  fontSize: "12px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa",
};

const TH: React.CSSProperties = {
  padding: "9px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600,
  letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b",
  background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap",
};
const TD: React.CSSProperties = {
  padding: "9px 14px", fontSize: "13px", borderBottom: "1px solid #f4f4f5",
  color: "#09090b", whiteSpace: "nowrap",
};

export default function ImportPlanningClient({
  initialPending, initialApproved,
}: { initialPending: Row[]; initialApproved: Row[] }) {
  const { role } = useRole();
  const dedup = (rows: Row[]) => rows.filter((r, i, a) => a.findIndex((x) => x.uid === r.uid) === i);
  const [pending, setPending] = useState<Row[]>(dedup(initialPending));
  const [approved, setApproved] = useState<Row[]>(dedup(initialApproved));

  const pendingFilter = useTableState(pending as unknown as Record<string, unknown>[], PENDING_COL_DEFS, "import_pending");
  const approvedFilter = useTableState(approved as unknown as Record<string, unknown>[], APPROVED_COL_DEFS, "import_approved");

  // Shipping options dialog state
  const [dialogRow, setDialogRow] = useState<Row | null>(null);
  const [options, setOptions] = useState<ShippingOption[]>([]);
  const [newOpt, setNewOpt] = useState({ name: "", shipping_line: "", freight: "", etd: "", eta: "", port: "", currency: "", exchange_rate: "" });
  const [editOptId, setEditOptId] = useState<number | null>(null);
  const [editOptForm, setEditOptForm] = useState<Record<string, string>>({});
  const [ports, setPorts] = useState<Port[]>([]);
  const [addingOpt, setAddingOpt] = useState(false);
  const [shippingLines, setShippingLines] = useState<ShippingLine[]>([]);
  const [dialogAgents, setDialogAgents] = useState<string[]>([]);
  const [freightHistory, setFreightHistory] = useState<{ date: string; freight_charge: string }[]>([]);
  const [freightHistoryLine, setFreightHistoryLine] = useState<string | null>(null);

  // Warehousing modal state
  const [warehousingRow, setWarehousingRow] = useState<Row | null>(null);
  const [warehousingChoice, setWarehousingChoice] = useState<"inbond" | "home_consumption" | "">("");

  // Approved edit modal state
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState({ confirmed_shipping_time: "", estimated_destination_charges: "", bl_no: "", bl_date: "", insurance: "", confirmed_eta: "", port: "" });
  const [editSaving, setEditSaving] = useState(false);

  async function fetchAgentsForLine(lineName: string) {
    const sl = shippingLines.find((s) => s.name === lineName);
    if (!sl) { setDialogAgents([]); return; }
    const res = await apiFetch(`${API}/api/shipping-lines/${sl.id}/agents`);
    const data = res.ok ? await res.json() : [];
    setDialogAgents(Array.isArray(data) ? data.map((a: { agent_name: string }) => a.agent_name) : []);
  }

  async function openDialog(row: Row) {
    setDialogRow(row);
    setDialogAgents([]);
    setFreightHistory([]);
    setFreightHistoryLine(null);
    const [optRes, slRes, portRes] = await Promise.all([
      apiFetch(`${API}/api/shipping-options/${row.uid}`),
      apiFetch(`${API}/api/shipping-lines/`),
      apiFetch(`${API}/api/ports/`),
    ]);
    setOptions(optRes.ok ? await optRes.json() : []);
    const slData = slRes.ok ? await slRes.json() : [];
    setShippingLines(Array.isArray(slData) ? slData : []);
    const portData = portRes.ok ? await portRes.json() : [];
    setPorts(Array.isArray(portData) ? portData : []);
  }

  async function toggleFreightHistory(lineName: string) {
    if (freightHistoryLine === lineName) {
      setFreightHistoryLine(null);
      setFreightHistory([]);
      return;
    }
    const sl = shippingLines.find((s) => s.name === lineName);
    if (!sl) return;
    const res = await apiFetch(`${API}/api/shipping-lines/${sl.id}/freights`);
    const data = res.ok ? await res.json() : [];
    setFreightHistory(Array.isArray(data) ? data : []);
    setFreightHistoryLine(lineName);
  }

  async function handleAddOption() {
    if (!dialogRow) return;
    setAddingOpt(true);

    // Auto-save new agent to masters
    const agentName = newOpt.name.trim();
    if (agentName && newOpt.shipping_line && !dialogAgents.includes(agentName)) {
      const sl = shippingLines.find((s) => s.name === newOpt.shipping_line);
      if (sl) {
        await apiFetch(`${API}/api/shipping-lines/${sl.id}/agents`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ agent_name: agentName }),
        });
        setDialogAgents((a) => [...a, agentName].sort());
      }
    }

    const res = await apiFetch(`${API}/api/shipping-options/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uid: dialogRow.uid, ...newOpt }),
    });
    if (res.ok) {
      const created = await res.json();
      setOptions((o) => [...o, created]);
      setNewOpt({ name: "", shipping_line: "", freight: "", etd: "", eta: "", port: "", currency: "", exchange_rate: "" });
    }
    setAddingOpt(false);
  }

  function startEditOpt(opt: ShippingOption) {
    setEditOptId(opt.id);
    setEditOptForm({
      name: opt.name ?? "",
      shipping_line: opt.shipping_line ?? "",
      freight: opt.freight ?? "",
      etd: opt.etd ?? "",
      eta: opt.eta ?? "",
      port: opt.port ?? "",
      currency: opt.currency ?? "",
      exchange_rate: opt.exchange_rate ?? "",
    });
  }

  async function handleSaveOpt() {
    if (editOptId === null) return;
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(editOptForm)) body[k] = v;
    const res = await apiFetch(`${API}/api/shipping-options/${editOptId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setOptions((o) => o.map((x) => x.id === editOptId ? updated : x));
      setEditOptId(null);
    }
  }

  async function handleDeleteOpt(optId: number) {
    await apiFetch(`${API}/api/shipping-options/${optId}`, { method: "DELETE" });
    setOptions((o) => o.filter((x) => x.id !== optId));
    if (editOptId === optId) setEditOptId(null);
  }

  async function handleSelectOption(optId: number) {
    const res = await apiFetch(`${API}/api/shipping-options/${optId}/select`, { method: "POST" });
    if (res.ok && dialogRow) {
      const moved = pending.find((r) => r.uid === dialogRow.uid);
      const opt = options.find((o) => o.id === optId);
      if (moved) {
        // Compute freight in INR (mirrors backend select_shipping_option logic)
        let freightInr: string | null = opt?.freight ?? null;
        if (opt?.freight && opt?.currency && opt.currency !== "INR" && opt?.exchange_rate) {
          const computed = parseFloat(opt.freight) * parseFloat(opt.exchange_rate);
          if (!isNaN(computed)) freightInr = computed.toFixed(2);
        }
        const updatedRow = {
          ...moved,
          workflow_status: "approved_import",
          etd: opt?.etd ?? moved.etd,
          port: opt?.port ?? moved.port,
          freight_charges: freightInr ?? moved.freight_charges,
          shipping_company: opt?.shipping_line ?? moved.shipping_company,
          estimated_eta: opt?.eta ?? moved.estimated_eta,
          confirmed_shipping_time: opt?.name ?? moved.confirmed_shipping_time,
        };
        setPending((p) => p.filter((r) => r.uid !== dialogRow.uid));
        setApproved((a) => [updatedRow, ...a.filter((r) => r.uid !== dialogRow.uid)]);
      }
      setDialogRow(null);
    }
  }

  async function handleWarehousing() {
    if (!warehousingRow || !warehousingChoice) return;
    const patch = warehousingChoice === "inbond"
      ? { inbond: "Y", home_consumption: "N", workflow_status: "boe" }
      : { inbond: "N", home_consumption: "Y", workflow_status: "boe" };
    const res = await apiFetch(`${API}/api/rows/${warehousingRow.uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      setApproved((a) => a.filter((r) => r.uid !== warehousingRow.uid));
      setWarehousingRow(null);
      setWarehousingChoice("");
    }
  }

  async function handleSkipWarehousing() {
    if (!warehousingRow) return;
    await apiFetch(`${API}/api/rows/${warehousingRow.uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "boe" }),
    });
    setApproved((a) => a.filter((r) => r.uid !== warehousingRow.uid));
    setWarehousingRow(null);
  }

  async function handleBackToPoPi(uid: string) {
    const res = await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "po_pi" }),
    });
    if (res.ok) setPending((p) => p.filter((r) => r.uid !== uid));
  }

  async function handleReapproval(row: Row) {
    const res = await apiFetch(`${API}/api/rows/${row.uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "pending_import" }),
    });
    if (res.ok) {
      setApproved((a) => a.filter((r) => r.uid !== row.uid));
      setPending((p) => [{ ...row, workflow_status: "pending_import" }, ...p]);
    }
  }

  async function openEditModal(row: Row) {
    setEditRow(row);
    setEditForm({
      confirmed_shipping_time: (row.confirmed_shipping_time as string) ?? "",
      estimated_destination_charges: (row.estimated_destination_charges as string) ?? "",
      bl_no: (row.bl_no as string) ?? "",
      bl_date: (row.bl_date as string) ?? "",
      insurance: (row.insurance as string) ?? "",
      confirmed_eta: (row.confirmed_eta as string) ?? "",
      port: (row.port as string) ?? "",
    });
    if (ports.length === 0) {
      const res = await apiFetch(`${API}/api/ports/`);
      const data = res.ok ? await res.json() : [];
      setPorts(Array.isArray(data) ? data : []);
    }
  }

  async function handleShipmentStatus(uid: string, status: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shipment_status: status }),
    });
    setApproved((a) => a.map((r) => r.uid === uid ? { ...r, shipment_status: status } : r));
  }

  async function handleSaveEdit() {
    if (!editRow) return;
    setEditSaving(true);
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(editForm)) if (v.trim()) body[k] = v.trim();
    const res = await apiFetch(`${API}/api/rows/${editRow.uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      setApproved((a) => a.map((r) => r.uid === editRow.uid ? { ...r, ...body } : r));
      setEditRow(null);
    }
    setEditSaving(false);
  }

  const APPROVED_COLS = [
    { key: "shipment_status", label: "Status" },
    { key: "uid", label: "UID" },
    { key: "supplier_name", label: "Supplier" },
    { key: "supplier_code", label: "Supp. Code" },
    { key: "pi_number", label: "PI Number" },
    { key: "etd", label: "ETD" },
    { key: "port", label: "Port" },
    { key: "confirmed_shipping_time", label: "Shipping Time" },
    { key: "shipping_company", label: "Shipping Co." },
    { key: "estimated_destination_charges", label: "Dest. Charges" },
    { key: "freight_charges", label: "Freight" },
    { key: "bl_no", label: "BL No" },
    { key: "bl_date", label: "BL Date" },
    { key: "insurance", label: "Insurance" },
    { key: "estimated_eta", label: "Est. ETA" },
    { key: "confirmed_eta", label: "Conf. ETA" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      {/* Header */}
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", background: "#fafafa", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>Import Planning</h1>
        <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa", textTransform: "uppercase" }}>
          Role: <strong style={{ color: role === "expert" ? "#09090b" : "#71717a" }}>{role}</strong>
        </span>
      </div>

      {/* Two panels */}
      <div style={{ flex: 1, minHeight: 0, display: "grid", gridTemplateColumns: "1fr 2fr", gap: "12px", overflow: "hidden" }}>
        {/* Pending */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, border: "1px solid #e4e4e7", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e4e4e7", background: "#fafafa", fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            ⏳ Pending ({pendingFilter.filteredCount < pending.length ? `${pendingFilter.filteredCount} / ${pending.length}` : pending.length})
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {[{ key: "uid", label: "UID" }, { key: "supplier_name", label: "Supplier" }, { key: "supplier_code", label: "Supplier Code" }, { key: "pi_number", label: "PI Number" }, { key: "rocket_item_code", label: "Item Code" }].map((c) => {
                    const isSorted = pendingFilter.sort?.key === c.key;
                    return (
                      <th key={c.key} style={{ ...TH, cursor: "pointer", userSelect: "none" }} onClick={() => pendingFilter.setSort(c.key)}>
                        {c.label}
                        <span style={{ marginLeft: "4px", fontSize: "9px", display: "inline-flex", flexDirection: "column", lineHeight: "9px", verticalAlign: "middle", gap: "1px" }}>
                          <span style={{ color: isSorted && pendingFilter.sort?.dir === "asc" ? "#09090b" : "#d4d4d8" }}>▲</span>
                          <span style={{ color: isSorted && pendingFilter.sort?.dir === "desc" ? "#09090b" : "#d4d4d8" }}>▼</span>
                        </span>
                      </th>
                    );
                  })}
                  <th style={{ ...TH, textAlign: "right" }}></th>
                </tr>
                <InlineFilters colDefs={PENDING_COL_DEFS} filters={pendingFilter.filters} distinctValues={pendingFilter.distinctValues} onFilter={pendingFilter.setFilter} trailingCells={1} />
              </thead>
              <tbody>
                {pendingFilter.filteredRows.length === 0 ? (
                  <tr><td colSpan={6} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "40px" }}>{pending.length === 0 ? "No pending rows" : "No results match filters"}</td></tr>
                ) : (pendingFilter.filteredRows as Row[]).map((row) => (
                  <tr key={row.uid} style={{ cursor: "pointer" }}
                    onDoubleClick={() => openDialog(row)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                    <td style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{String(row.uid).slice(0, 8)}…</td>
                    <td style={TD}>{row.supplier_name ?? "—"}</td>
                    <td style={TD}>{row.supplier_code ?? "—"}</td>
                    <td style={TD}>{row.pi_number ?? "—"}</td>
                    <td style={TD}>{row.rocket_item_code ?? "—"}</td>
                    <td style={{ ...TD, textAlign: "right" }}>
                      <button style={btnStyle("ghost")} onClick={(e) => { e.stopPropagation(); handleBackToPoPi(row.uid as string); }}>← PO/PI</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {pending.length > 0 && <p style={{ textAlign: "center", fontSize: "11px", color: "#a1a1aa", margin: "8px", fontFamily: "var(--font-mono), monospace" }}>double-click a row to open shipping options</p>}
          </div>
        </div>

        {/* Approved */}
        <div style={{ display: "flex", flexDirection: "column", minHeight: 0, border: "1px solid #e4e4e7", borderRadius: "12px", overflow: "hidden" }}>
          <div style={{ padding: "12px 16px", borderBottom: "1px solid #e4e4e7", background: "#fafafa", fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            ✓ Approved ({approvedFilter.filteredCount < approved.length ? `${approvedFilter.filteredCount} / ${approved.length}` : approved.length})
          </div>
          <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
            <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
              <thead className="sticky top-0 z-10">
                <tr>
                  {APPROVED_COLS.map((c) => {
                    const isSorted = approvedFilter.sort?.key === c.key;
                    return (
                      <th key={c.key} style={{ ...TH, cursor: "pointer", userSelect: "none" }} onClick={() => approvedFilter.setSort(c.key)}>
                        {c.label}
                        <span style={{ marginLeft: "4px", fontSize: "9px", display: "inline-flex", flexDirection: "column", lineHeight: "9px", verticalAlign: "middle", gap: "1px" }}>
                          <span style={{ color: isSorted && approvedFilter.sort?.dir === "asc" ? "#09090b" : "#d4d4d8" }}>▲</span>
                          <span style={{ color: isSorted && approvedFilter.sort?.dir === "desc" ? "#09090b" : "#d4d4d8" }}>▼</span>
                        </span>
                      </th>
                    );
                  })}
                  <th style={{ ...TH, textAlign: "right" }}>Actions</th>
                </tr>
                <InlineFilters colDefs={APPROVED_COL_DEFS} filters={approvedFilter.filters} distinctValues={approvedFilter.distinctValues} onFilter={approvedFilter.setFilter} trailingCells={1} />
              </thead>
              <tbody>
                {approvedFilter.filteredRows.length === 0 ? (
                  <tr><td colSpan={APPROVED_COLS.length + 1} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "40px" }}>{approved.length === 0 ? "No approved rows" : "No results match filters"}</td></tr>
                ) : (approvedFilter.filteredRows as Row[]).map((row) => (
                  <tr key={row.uid}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                    {APPROVED_COLS.map((c) => {
                      if (c.key === "shipment_status") {
                        const cur = (row.shipment_status as string) ?? "";
                        const meta = SHIPMENT_STATUSES.find((s) => s.value === cur);
                        return (
                          <td key={c.key} style={{ ...TD, padding: "6px 10px" }}>
                            <select
                              value={cur}
                              onChange={(e) => handleShipmentStatus(row.uid as string, e.target.value)}
                              style={{
                                padding: "3px 8px", borderRadius: "6px", fontSize: "11px", fontWeight: 600,
                                fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", outline: "none",
                                border: `1px solid ${meta?.border ?? "#e4e4e7"}`,
                                background: meta?.bg ?? "#f4f4f5",
                                color: meta?.color ?? "#71717a",
                                minWidth: "160px",
                              }}>
                              <option value="">— set status —</option>
                              {SHIPMENT_STATUSES.map((s) => (
                                <option key={s.value} value={s.value}>{s.value}</option>
                              ))}
                            </select>
                          </td>
                        );
                      }
                      return (
                        <td key={c.key} style={{ ...TD, fontFamily: c.key === "uid" ? "var(--font-mono), monospace" : undefined, fontSize: c.key === "uid" ? "11px" : undefined, color: c.key === "uid" ? "#a1a1aa" : "#09090b" }}>
                          {c.key === "uid" ? String(row.uid).slice(0, 8) + "…" : (row[c.key] as string) ?? <span style={{ color: "#d4d4d8" }}>—</span>}
                        </td>
                      );
                    })}
                    <td style={{ ...TD, textAlign: "right" }}>
                      <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                        <button style={btnStyle("action")} onClick={() => openEditModal(row)}>Edit Fields</button>
                        <button style={btnStyle("ghost")} onClick={() => handleReapproval(row)}>↩ Re-approve</button>
                        <button style={btnStyle("action")} onClick={() => { setWarehousingRow(row); setWarehousingChoice(""); }}>Warehousing →</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Shipping Options Dialog */}
      {dialogRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "min(1000px, 92vw)", maxHeight: "85vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>
                Shipping Options — {dialogRow.supplier_name ?? dialogRow.uid}
              </h2>
              <button style={btnStyle("ghost")} onClick={() => setDialogRow(null)}>✕ Close</button>
            </div>

            {/* Options table */}
            <table style={{ borderCollapse: "collapse", width: "100%", tableLayout: "auto" }}>
              <thead>
                <tr>
                  {["Name", "Shipping Line", "Freight", "Freight (INR)", "ETD", "ETA", "Port", "Currency", "Exch. Rate", "Actions"].map((h) => (
                    <th key={h} style={{ ...TH, background: "#f4f4f5" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {options.length === 0 && (
                  <tr><td colSpan={10} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "24px" }}>No options yet — add below</td></tr>
                )}
                {options.map((opt) => {
                  const isEditing = editOptId === opt.id;
                  if (isEditing) {
                    return (
                      <tr key={opt.id} style={{ background: "#fffbeb" }}>
                        <td style={{ padding: "5px 8px" }}><input style={{ ...inputStyle, width: "110px" }} value={editOptForm.name} onChange={(e) => setEditOptForm((f) => ({ ...f, name: e.target.value }))} /></td>
                        <td style={{ padding: "5px 8px" }}>
                          <select style={{ ...inputStyle, width: "120px" }} value={editOptForm.shipping_line} onChange={(e) => setEditOptForm((f) => ({ ...f, shipping_line: e.target.value }))}>
                            <option value="">—</option>
                            {shippingLines.map((sl) => <option key={sl.id} value={sl.name}>{sl.name}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "5px 8px" }}><AmountInput style={{ ...inputStyle, width: "90px" }} value={editOptForm.freight} onChange={(raw) => setEditOptForm((f) => ({ ...f, freight: raw }))} /></td>
                        <td style={{ padding: "5px 8px", fontFamily: "var(--font-mono), monospace", fontSize: "12px", color: "#52525b" }}>
                          {(() => { const f = parseFloat(editOptForm.freight) || 0; const r = parseFloat(editOptForm.exchange_rate) || 0; const inr = editOptForm.currency === "INR" ? f : (f && r ? parseFloat((f * r).toFixed(2)) : 0); return inr ? inr.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : <span style={{ color: "#d4d4d8" }}>—</span>; })()}
                        </td>
                        <td style={{ padding: "5px 8px" }}><input type="date" style={{ ...inputStyle, width: "130px" }} value={editOptForm.etd} onChange={(e) => setEditOptForm((f) => ({ ...f, etd: e.target.value }))} /></td>
                        <td style={{ padding: "5px 8px" }}><input type="date" style={{ ...inputStyle, width: "130px" }} value={editOptForm.eta} onChange={(e) => setEditOptForm((f) => ({ ...f, eta: e.target.value }))} /></td>
                        <td style={{ padding: "5px 8px" }}>
                          <input type="text" list="dialog-ports-list" style={{ ...inputStyle, width: "110px" }} value={editOptForm.port} onChange={(e) => setEditOptForm((f) => ({ ...f, port: e.target.value }))} />
                        </td>
                        <td style={{ padding: "5px 8px" }}>
                          <select style={{ ...inputStyle, width: "80px" }} value={editOptForm.currency} onChange={(e) => setEditOptForm((f) => ({ ...f, currency: e.target.value, exchange_rate: e.target.value === "INR" ? "" : f.exchange_rate }))}>
                            <option value="">—</option>
                            <option value="USD">USD</option>
                            <option value="INR">INR</option>
                            <option value="CNY">CNY</option>
                          </select>
                        </td>
                        <td style={{ padding: "5px 8px" }}>
                          {editOptForm.currency && editOptForm.currency !== "INR"
                            ? <input style={{ ...inputStyle, width: "90px" }} placeholder={`1 ${editOptForm.currency} = ? INR`} value={editOptForm.exchange_rate} onChange={(e) => setEditOptForm((f) => ({ ...f, exchange_rate: e.target.value }))} />
                            : <span style={{ fontSize: "11px", color: "#d4d4d8" }}>—</span>}
                        </td>
                        <td style={{ padding: "5px 8px" }}>
                          <div style={{ display: "flex", gap: "4px" }}>
                            <button style={btnStyle("primary")} onClick={handleSaveOpt}>Save</button>
                            <button style={btnStyle("ghost")} onClick={() => setEditOptId(null)}>✕</button>
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  return (
                    <tr key={opt.id}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                      <td style={TD}>{opt.name ?? "—"}</td>
                      <td style={TD}>{opt.shipping_line ?? "—"}</td>
                      <td style={TD}>{opt.freight ?? "—"}</td>
                      <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>
                        {(() => { const f = parseFloat(opt.freight ?? "") || 0; const r = parseFloat(opt.exchange_rate ?? "") || 0; const inr = opt.currency === "INR" ? f : (f && r ? parseFloat((f * r).toFixed(2)) : 0); return inr ? inr.toLocaleString() : <span style={{ color: "#d4d4d8" }}>—</span>; })()}
                      </td>
                      <td style={TD}>{opt.etd ?? "—"}</td>
                      <td style={TD}>{opt.eta ?? "—"}</td>
                      <td style={TD}>{opt.port ?? "—"}</td>
                      <td style={TD}>{opt.currency ?? "—"}</td>
                      <td style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{opt.exchange_rate ?? "—"}</td>
                      <td style={TD}>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {role === "expert" && (
                            <button style={btnStyle("expert")} onClick={() => handleSelectOption(opt.id)}>Select</button>
                          )}
                          <button style={btnStyle("action")} onClick={() => startEditOpt(opt)}>Edit</button>
                          <button style={btnStyle("danger")} onClick={() => handleDeleteOpt(opt.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {/* Add row inline */}
                <tr style={{ background: "#fafafa" }}>
                  <td style={{ padding: "6px 8px" }}>
                    <input type="text" list="dialog-agents-list"
                      style={{ ...inputStyle, width: "110px" }}
                      placeholder={newOpt.shipping_line ? "Agent name…" : "Pick line first"}
                      disabled={!newOpt.shipping_line}
                      value={newOpt.name}
                      onChange={(e) => setNewOpt({ ...newOpt, name: e.target.value })} />
                    <datalist id="dialog-agents-list">
                      {dialogAgents.map((a) => <option key={a} value={a} />)}
                    </datalist>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                      <select style={{ ...inputStyle, width: "110px" }} value={newOpt.shipping_line} onChange={(e) => {
                        const name = e.target.value;
                        setNewOpt({ ...newOpt, shipping_line: name, name: "" });
                        setDialogAgents([]);
                        if (name) {
                          const sl = shippingLines.find((s) => s.name === name);
                          if (sl) apiFetch(`${API}/api/shipping-lines/${sl.id}/agents`).then((r) => r.ok ? r.json() : []).then((d) => setDialogAgents(Array.isArray(d) ? d.map((a: { agent_name: string }) => a.agent_name) : []));
                        }
                      }}>
                        <option value="">— company —</option>
                        {shippingLines.map((sl) => <option key={sl.id} value={sl.name}>{sl.name}</option>)}
                      </select>
                      {newOpt.shipping_line && (
                        <button title="View freight history" onClick={() => toggleFreightHistory(newOpt.shipping_line)}
                          style={{ padding: "4px 7px", borderRadius: "5px", fontSize: "11px", fontFamily: "var(--font-mono), monospace", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
                            background: freightHistoryLine === newOpt.shipping_line ? "#09090b" : "#f4f4f5",
                            color: freightHistoryLine === newOpt.shipping_line ? "#fff" : "#52525b",
                            borderColor: freightHistoryLine === newOpt.shipping_line ? "#09090b" : "#e4e4e7" }}>
                          {freightHistoryLine === newOpt.shipping_line ? "✕" : "↗"}
                        </button>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: "6px 8px" }}><AmountInput style={{ ...inputStyle, width: "90px" }} placeholder="Freight" value={newOpt.freight} onChange={(raw) => setNewOpt({ ...newOpt, freight: raw })} /></td>
                  <td style={{ padding: "6px 8px", fontFamily: "var(--font-mono), monospace", fontSize: "12px", color: "#52525b" }}>
                    {(() => { const f = parseFloat(newOpt.freight) || 0; const r = parseFloat(newOpt.exchange_rate) || 0; const inr = newOpt.currency === "INR" ? f : (f && r ? parseFloat((f * r).toFixed(2)) : 0); return inr ? inr.toLocaleString("en-IN", { maximumFractionDigits: 2 }) : <span style={{ color: "#d4d4d8" }}>—</span>; })()}
                  </td>
                  <td style={{ padding: "6px 8px" }}><input type="date" style={{ ...inputStyle, width: "130px" }} value={newOpt.etd} onChange={(e) => setNewOpt({ ...newOpt, etd: e.target.value })} /></td>
                  <td style={{ padding: "6px 8px" }}><input type="date" style={{ ...inputStyle, width: "130px" }} value={newOpt.eta} onChange={(e) => setNewOpt({ ...newOpt, eta: e.target.value })} /></td>
                  <td style={{ padding: "6px 8px" }}>
                    <input type="text" list="dialog-ports-list" style={{ ...inputStyle, width: "110px" }} placeholder="Port…" value={newOpt.port} onChange={(e) => setNewOpt({ ...newOpt, port: e.target.value })} />
                    <datalist id="dialog-ports-list">
                      {ports.map((p) => <option key={p.id} value={p.name} />)}
                    </datalist>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <select style={{ ...inputStyle, width: "80px" }} value={newOpt.currency} onChange={(e) => setNewOpt({ ...newOpt, currency: e.target.value, exchange_rate: e.target.value === "INR" ? "" : newOpt.exchange_rate })}>
                      <option value="">—</option>
                      <option value="USD">USD</option>
                      <option value="INR">INR</option>
                      <option value="CNY">CNY</option>
                    </select>
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    {newOpt.currency && newOpt.currency !== "INR"
                      ? <input type="text" style={{ ...inputStyle, width: "90px" }} placeholder={`1 ${newOpt.currency} = ? INR`} value={newOpt.exchange_rate} onChange={(e) => setNewOpt({ ...newOpt, exchange_rate: e.target.value })} />
                      : <span style={{ fontSize: "11px", color: "#d4d4d8", padding: "0 8px" }}>—</span>}
                  </td>
                  <td style={{ padding: "6px 8px" }}>
                    <button style={btnStyle("primary")} onClick={handleAddOption} disabled={addingOpt}>{addingOpt ? "…" : "Add"}</button>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Freight history panel */}
            {freightHistoryLine && (
              <div style={{ border: "1px solid #e4e4e7", borderRadius: "10px", overflow: "hidden" }}>
                <div style={{ padding: "8px 14px", background: "#fafafa", borderBottom: "1px solid #e4e4e7", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", color: "#09090b" }}>
                    Freight history — <span style={{ fontFamily: "var(--font-mono), monospace" }}>{freightHistoryLine}</span>
                  </span>
                  <span style={{ fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#a1a1aa" }}>{freightHistory.length} record{freightHistory.length !== 1 ? "s" : ""}</span>
                </div>
                {freightHistory.length === 0 ? (
                  <p style={{ margin: 0, padding: "16px 14px", fontSize: "12px", color: "#d4d4d8", fontFamily: "var(--font-sans), sans-serif", textAlign: "center" }}>No freight records yet</p>
                ) : (
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ ...TH, padding: "6px 14px", fontSize: "10px" }}>Date</th>
                        <th style={{ ...TH, padding: "6px 14px", fontSize: "10px" }}>Freight Charge</th>
                      </tr>
                    </thead>
                    <tbody>
                      {freightHistory.map((fr, i) => (
                        <tr key={i}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                          <td style={{ ...TD, padding: "7px 14px", fontSize: "12px", fontFamily: "var(--font-mono), monospace" }}>{fr.date}</td>
                          <td style={{ ...TD, padding: "7px 14px", fontSize: "12px", fontFamily: "var(--font-mono), monospace" }}>{fr.freight_charge}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Approved edit modal */}
      {editRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "420px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Edit Import Fields</h2>
            <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa", fontFamily: "var(--font-mono), monospace" }}>{String(editRow.uid).slice(0, 8)}… — {editRow.supplier_name ?? ""}</p>
            {[
              { key: "confirmed_shipping_time",      label: "Shipping Time",        type: "text" },
              { key: "estimated_destination_charges", label: "Destination Charges",  type: "text" },
              { key: "bl_no",                         label: "BL No",                type: "text" },
              { key: "bl_date",                       label: "BL Date",              type: "date" },
              { key: "insurance",                     label: "Insurance",            type: "text" },
              { key: "confirmed_eta",                 label: "Confirmed ETA",        type: "date" },
              { key: "port",                          label: "Port",                 type: "port" },
            ].map((f) => (
              <label key={f.key} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                {f.label}
                {f.type === "port" ? (
                  <>
                    <input type="text" list="edit-ports-list"
                      style={{ padding: "7px 10px", borderRadius: "7px", border: "1px solid #e4e4e7", fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa", color: "#09090b" }}
                      placeholder="Select or type port…"
                      value={editForm.port}
                      onChange={(e) => setEditForm({ ...editForm, port: e.target.value })} />
                    <datalist id="edit-ports-list">
                      {ports.map((p) => <option key={p.id} value={p.name} />)}
                    </datalist>
                  </>
                ) : (
                  <input type={f.type} style={{ padding: "7px 10px", borderRadius: "7px", border: "1px solid #e4e4e7", fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa", color: "#09090b" }}
                    value={editForm[f.key as keyof typeof editForm]}
                    onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })} />
                )}
              </label>
            ))}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setEditRow(null)}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleSaveEdit} disabled={editSaving}>{editSaving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Warehousing Modal */}
      {warehousingRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") warehousingChoice ? handleWarehousing() : handleSkipWarehousing(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "380px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Warehousing Plan</h2>
            <p style={{ margin: 0, fontSize: "13px", color: "#71717a", fontFamily: "var(--font-sans), sans-serif" }}>Select a warehousing option (optional) before moving to BOE.</p>
            {[{ value: "inbond", label: "Inbond" }, { value: "home_consumption", label: "Home Consumption" }].map((opt) => (
              <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer", fontFamily: "var(--font-sans), sans-serif", color: "#09090b" }}>
                <input type="radio" name="warehousing" value={opt.value} checked={warehousingChoice === opt.value} onChange={() => setWarehousingChoice(opt.value as "inbond" | "home_consumption")} />
                {opt.label}
              </label>
            ))}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setWarehousingRow(null)}>Cancel</button>
              <button style={btnStyle("ghost")} onClick={handleSkipWarehousing}>Skip → BOE</button>
              <button style={btnStyle("primary")} onClick={handleWarehousing} disabled={!warehousingChoice}>Confirm → BOE</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
