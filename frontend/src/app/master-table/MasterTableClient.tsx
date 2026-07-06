"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect, useRef, useMemo } from "react";
import DataTable, { Row, COLUMNS } from "@/components/DataTable";
import { exportToExcel } from "@/lib/exportExcel";
import AmountInput from "@/components/AmountInput";
import { useTableState, ColDef } from "@/components/useTableState";
import { applyColumnOrder, useColumnOrder } from "@/lib/columnOrder";

const POLL_MS = 5_000;

// All editable fields grouped by stage — ordered to match each stage table's column order
const SECTIONS = [
  {
    title: "PO / PI",
    fields: [
      { key: "srno",                  label: "Sr No"               },
      { key: "date_of_po",            label: "Date of PO",  date: true },
      { key: "supplier_name",         label: "Supplier Name"       },
      { key: "rocket_item_code",      label: "Rocket Item Code"    },
      { key: "supplier_code",         label: "Supplier Code"       },
      { key: "po_number",             label: "PO Number"           },
      { key: "pi_number",             label: "PI Number"           },
      { key: "pi_date",               label: "PI Date",     date: true },
      { key: "supplier_model_number", label: "Supplier Model No"   },
      { key: "pi_quantity",           label: "PI Quantity"         },
      { key: "pi_rate",               label: "PI Rate"             },
      { key: "currency",              label: "Currency",    select: ["USD","INR","CNY"] },
      { key: "exchange_rate",         label: "Exchange Rate"       },
      { key: "pi_total_value",        label: "PI Total (orig.)"    },
      { key: "po_total_value",        label: "Total (INR)"         },
      { key: "tentative_exworks_at_po_time", label: "Tentative Ex-Works", date: true },
      { key: "confirmed_exworks",     label: "Confirmed Ex-Works",  date: true },
      { key: "credit_time",           label: "Credit Time (days)"  },
    ],
  },
  {
    title: "Import Planning",
    fields: [
      { key: "shipment_status",               label: "Shipment Status", select: ["Pre-Shipment","Shipped","At Destination Port","Under Customs Clearance","Customs Cleared","In Transit to Warehouse","Received"] },
      { key: "etd",                           label: "ETD",                   date: true },
      { key: "port",                          label: "Port"                              },
      { key: "shipping_company",              label: "Shipping Company"                  },
      { key: "estimated_destination_charges", label: "Est. Destination Charges"          },
      { key: "freight_charges",               label: "Freight Charges"                   },
      { key: "bl_no",                         label: "BL No"                             },
      { key: "bl_date",                       label: "BL Date",               date: true },
      { key: "insurance",                     label: "Insurance"                         },
      { key: "estimated_eta",                 label: "Estimated ETA",         date: true },
      { key: "confirmed_eta",                 label: "Confirmed ETA",         date: true },
      { key: "inbond",                        label: "Inbond",     select: ["Y","N"]     },
      { key: "home_consumption",              label: "Home Consumption", select: ["Y","N"] },
    ],
  },
  {
    title: "BOE",
    fields: [
      { key: "boe_no",                         label: "BOE No"                },
      { key: "provisional_boe",                label: "Provisional BOE"        },
      { key: "actual_boe",                     label: "Actual BOE"             },
      { key: "customs_rate",                   label: "Customs Rate (%)"       },
    ],
  },
  {
    title: "Transportation",
    fields: [
      { key: "sap_inward_no",                 label: "SAP Inward No"           },
      { key: "cha_name",                      label: "CHA Name"                },
      { key: "cha_charges",                   label: "CHA Charges"             },
      { key: "other_charges",                 label: "Other Charges"           },
      { key: "confirmed_destination_charges", label: "Conf. Dest. Charges"     },
      { key: "transportation_inbound",        label: "Transport Inbound"       },
      { key: "transportation_outbound_home",  label: "Transport Outbound/Home" },
    ],
  },
  {
    title: "Due Date",
    fields: [
      { key: "estimated_due_date",        label: "Completed Due Date",  date: true },
      { key: "advance_given",             label: "Advance Given"                   },
      { key: "hedged",                    label: "Hedged",   select: ["Y","N"]     },
      { key: "confirmed_payment_amt",     label: "Confirmed Payment Amt"           },
      { key: "confirmed_payment_exchange",label: "Payment Exchange Rate"           },
    ],
  },
] as const;

type FieldDef = { key: string; label: string; date?: boolean; select?: readonly string[] };

const MONEY_KEYS = new Set([
  "pi_rate", "pi_total_value", "exchange_rate", "po_total_value",
  "estimated_destination_charges", "freight_charges", "insurance",
  "provisional_boe", "customs_rate",
  "cha_charges", "other_charges", "confirmed_destination_charges",
  "transportation_inbound", "transportation_outbound_home",
  "advance_given", "confirmed_payment_amt", "confirmed_payment_exchange",
]);

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "6px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none",
  background: "#fafafa", color: "#09090b",
};

const DATE_KEYS = new Set(["date_of_po","pi_date","tentative_exworks_at_po_time","confirmed_exworks","etd","bl_date","estimated_eta","confirmed_eta","estimated_due_date"]);
const SELECT_KEYS: Record<string, string[]> = {
  workflow_status: ["po_pi","pending_import","approved_import","boe","transportation","due_date","complete"],
  currency:        ["USD","INR","CNY"],
  inbond:          ["Y","N"],
  home_consumption:["Y","N"],
  hedged:          ["Y","N"],
  shipment_status: ["Pre-Shipment","Shipped","At Destination Port","Under Customs Clearance","Customs Cleared","In Transit to Warehouse","Received"],
};
const AMOUNT_KEYS = new Set(["po_quantity","po_rate","po_total_value","pi_quantity","pi_rate","pi_total_value","exchange_rate","credit_time","estimated_destination_charges","freight_charges","insurance","provisional_boe","actual_boe","customs_rate","transportation_inbound","transportation_outbound_home","cha_charges","other_charges","confirmed_destination_charges","total_transport","landing_cost","confirmed_payment_amt","confirmed_payment_exchange","advance_given"]);

function toColDefs(cols: { key: string; label: string }[]): ColDef[] {
  return cols.map((c) => ({
    key: c.key,
    label: c.label,
    type: SELECT_KEYS[c.key] ? "select" : DATE_KEYS.has(c.key) ? "date" : AMOUNT_KEYS.has(c.key) ? "amount" : "text",
    options: SELECT_KEYS[c.key],
  }));
}

const ENTRY_CCY_OPTIONS = ["INR", "USD", "EUR", "CNY", "GBP", "AED"];

interface BoeEntry { id: number; uid: string; amount: string; currency: string | null; rate: string | null; note: string | null; }
interface ShippingOptionRef { freight: string | null; currency: string | null; exchange_rate: string | null; is_selected: boolean; }

function entryInrValue(e: { amount: string; currency: string | null; rate: string | null }): number {
  const amount = parseFloat(e.amount) || 0;
  if (e.currency && e.currency !== "INR") return amount * (parseFloat(e.rate ?? "") || 0);
  return amount;
}

export default function MasterTableClient({ initialRows }: { initialRows: Row[] }) {
  const [rows, setRows] = useState<Row[]>(initialRows);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const columnOrder = useColumnOrder("master_table");
  const columns = useMemo(() => applyColumnOrder(COLUMNS, columnOrder), [columnOrder]);
  const MASTER_COL_DEFS = useMemo(() => toColDefs(columns), [columns]);

  const { filteredRows, filters, sort, distinctValues, setFilter, setSort } =
    useTableState(rows as unknown as Record<string, unknown>[], MASTER_COL_DEFS, "master");

  // Edit modal state
  const [editRow, setEditRow] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(0);

  // Actual BOE entries (edited inline within the BOE tab of the edit dialog)
  const [boeEntries, setBoeEntries] = useState<BoeEntry[]>([]);
  const [newBoeEntry, setNewBoeEntry] = useState({ amount: "", currency: "INR", rate: "", note: "" });
  const [entrySaving, setEntrySaving] = useState(false);
  const [freightRef, setFreightRef] = useState<ShippingOptionRef | null>(null);

  // Import state
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  async function handleExport(type: "template" | "data") {
    const res = await apiFetch(`${API}/api/rows/export?type=${type}`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = type === "template" ? "master_template.csv" : "master_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    const form = new FormData();
    form.append("file", file);
    const res = await apiFetch(`${API}/api/rows/import`, { method: "POST", body: form });
    if (res.ok) {
      const { imported } = await res.json();
      await fetchRows();
      alert(`Imported ${imported} row${imported !== 1 ? "s" : ""}.`);
    } else {
      alert("Import failed. Check that the file is a valid CSV.");
    }
    setImporting(false);
    if (importRef.current) importRef.current.value = "";
  }

  async function fetchRows() {
    try {
      const res = await apiFetch(`${API}/api/rows/`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setRows(data);
        setLastUpdated(new Date());
      }
    } catch {}
  }

  useEffect(() => {
    intervalRef.current = setInterval(fetchRows, POLL_MS);
    const onVisible = () => { if (document.visibilityState === "visible") fetchRows(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  async function handleReopen(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "due_date" }),
    });
    fetchRows();
  }

  async function openEdit(uid: string) {
    const row = rows.find((r) => String(r.uid) === uid);
    if (!row) return;
    const form: Record<string, string> = {};
    for (const section of SECTIONS) {
      for (const f of section.fields) {
        form[f.key] = (row[f.key] as string) ?? "";
      }
    }
    setEditForm(form);
    setEditRow(row);
    setActiveSection(0);
    setNewBoeEntry({ amount: "", currency: "INR", rate: "", note: "" });
    setFreightRef(null);
    const [entriesRes, optionsRes] = await Promise.all([
      apiFetch(`${API}/api/boe-entries/${uid}`),
      apiFetch(`${API}/api/shipping-options/${uid}`),
    ]);
    setBoeEntries(entriesRes.ok ? await entriesRes.json() : []);
    if (optionsRes.ok) {
      const options: ShippingOptionRef[] = await optionsRes.json();
      setFreightRef(options.find((o) => o.is_selected) ?? null);
    }
  }

  function syncBoeSums(uid: string, entryList: BoeEntry[]) {
    const sum = entryList.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0);
    const inrSum = entryList.reduce((acc, e) => acc + entryInrValue(e), 0);
    setRows((r) => r.map((row) => {
      if (row.uid !== uid) return row;
      const customsRate = parseFloat((row.customs_rate as string) ?? "0") || 0;
      const updated: Row = { ...row };
      updated.actual_boe = sum > 0 ? String(sum.toFixed(2)) : "0";
      updated.actual_boe_inr = inrSum > 0 ? String((inrSum * (1 + customsRate / 100)).toFixed(2)) : "0";
      return updated;
    }));
  }

  async function handleAddBoeEntry() {
    if (!editRow || !newBoeEntry.amount) return;
    setEntrySaving(true);
    const res = await apiFetch(`${API}/api/boe-entries/`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: editRow.uid,
        amount: newBoeEntry.amount,
        currency: newBoeEntry.currency,
        rate: newBoeEntry.currency === "INR" ? null : newBoeEntry.rate,
        note: newBoeEntry.note || null,
      }),
    });
    if (res.ok) {
      const created = await res.json();
      const updated = [...boeEntries, created];
      setBoeEntries(updated);
      syncBoeSums(editRow.uid as string, updated);
      setNewBoeEntry({ amount: "", currency: "INR", rate: "", note: "" });
    }
    setEntrySaving(false);
  }

  async function handleDeleteBoeEntry(entryId: number) {
    if (!editRow) return;
    await apiFetch(`${API}/api/boe-entries/${entryId}`, { method: "DELETE" });
    const remaining = boeEntries.filter((e) => e.id !== entryId);
    setBoeEntries(remaining);
    syncBoeSums(editRow.uid as string, remaining);
  }

  async function handleSave() {
    if (!editRow) return;
    setSaving(true);
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(editForm)) {
      body[k] = v; // send all, including empty string (backend ignores null patches)
    }
    const res = await apiFetch(`${API}/api/rows/${editRow.uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setRows((prev) => prev.map((r) => r.uid === updated.uid ? updated : r));
      setEditRow(null);
    }
    setSaving(false);
  }

  function renderField(f: FieldDef) {
    if (f.select) {
      return (
        <select style={inputStyle} value={editForm[f.key] ?? ""} onChange={(e) => setEditForm((fm) => ({ ...fm, [f.key]: e.target.value }))}>
          <option value="">—</option>
          {f.select.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (f.date) {
      return (
        <input type="date" style={inputStyle} value={editForm[f.key] ?? ""}
          onChange={(e) => setEditForm((fm) => ({ ...fm, [f.key]: e.target.value }))} />
      );
    }
    if (MONEY_KEYS.has(f.key)) {
      const currency = f.key === "pi_rate" || f.key === "pi_total_value" ? (editForm.currency ?? "INR") : "INR";
      return (
        <AmountInput style={inputStyle} placeholder={f.label} value={editForm[f.key] ?? ""}
          currency={currency} onChange={(raw) => setEditForm((fm) => ({ ...fm, [f.key]: raw }))} />
      );
    }
    return (
      <input type="text" style={inputStyle} placeholder={f.label} value={editForm[f.key] ?? ""}
        onChange={(e) => setEditForm((fm) => ({ ...fm, [f.key]: e.target.value }))} />
    );
  }

  const currentSection = SECTIONS[activeSection];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#ffffff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, letterSpacing: "-0.02em", color: "#09090b", margin: 0 }}>
          Master Table
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", fontFamily: "var(--font-mono), monospace", color: "#16a34a", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#16a34a", display: "inline-block", animation: "pulse 2s infinite" }} />
              Live
            </span>
            <span style={{ fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa", letterSpacing: "0.06em", textTransform: "uppercase" }}>
              {rows.length} rows · {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <button
            onClick={fetchRows}
            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #e4e4e7", background: "transparent", fontSize: "11px", fontFamily: "var(--font-sans), sans-serif", color: "#71717a", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#71717a"; }}
          >
            ↺ Refresh
          </button>
          <button
            onClick={() => exportToExcel(filteredRows, "master-table", Object.fromEntries(columns.map(c => [c.key, c.label])))}
            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #e4e4e7", background: "transparent", fontSize: "11px", fontFamily: "var(--font-sans), sans-serif", color: "#71717a", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#71717a"; }}
          >
            ↓ Export
          </button>
          <button
            onClick={() => handleExport("template")}
            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #e4e4e7", background: "transparent", fontSize: "11px", fontFamily: "var(--font-sans), sans-serif", color: "#71717a", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#71717a"; }}
            title="Download empty CSV template"
          >
            ↓ Template
          </button>
          <button
            onClick={() => handleExport("data")}
            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #e4e4e7", background: "transparent", fontSize: "11px", fontFamily: "var(--font-sans), sans-serif", color: "#71717a", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#71717a"; }}
            title="Download all rows as CSV"
          >
            ↓ CSV
          </button>
          <label
            style={{ padding: "4px 10px", borderRadius: "6px", border: "1px solid #e4e4e7", background: "transparent", fontSize: "11px", fontFamily: "var(--font-sans), sans-serif", color: importing ? "#a1a1aa" : "#71717a", cursor: importing ? "default" : "pointer", display: "inline-block" }}
            onMouseEnter={(e) => { if (!importing) { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; } }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = importing ? "#a1a1aa" : "#71717a"; }}
            title="Import rows from CSV"
          >
            {importing ? "Importing…" : "↑ Import CSV"}
            <input ref={importRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleImportFile} disabled={importing} />
          </label>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "hidden", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <DataTable
          rows={filteredRows as Row[]} onReopen={handleReopen} onEdit={openEdit}
          sort={sort} onSort={setSort}
          colDefs={MASTER_COL_DEFS} filters={filters} distinctValues={distinctValues} onFilter={setFilter}
          columns={columns}
        />
      </div>

      {editRow && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.35)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", width: "640px", maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "20px 24px 0", flexShrink: 0 }}>
              <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>
                Edit Row
              </h2>
              <p style={{ margin: "0 0 16px", fontSize: "12px", color: "#a1a1aa", fontFamily: "var(--font-mono), monospace" }}>
                {String(editRow.uid)}
              </p>
              {/* Section tabs */}
              <div style={{ display: "flex", gap: "4px", borderBottom: "1px solid #e4e4e7", marginBottom: "0" }}>
                {SECTIONS.map((s, i) => (
                  <button key={s.title} onClick={() => setActiveSection(i)}
                    style={{
                      padding: "7px 14px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                      fontFamily: "var(--font-sans), sans-serif", border: "none", background: "transparent",
                      borderBottom: i === activeSection ? "2px solid #09090b" : "2px solid transparent",
                      color: i === activeSection ? "#09090b" : "#71717a",
                      marginBottom: "-1px",
                    }}>
                    {s.title}
                  </button>
                ))}
              </div>
            </div>

            {/* Fields */}
            <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {currentSection.fields.map((f) => (
                  <label key={f.key} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {f.label}
                    {renderField(f as FieldDef)}
                  </label>
                ))}
              </div>

              {currentSection.title === "BOE" && editRow && (
                <div style={{ borderTop: "1px solid #e4e4e7", marginTop: "16px", paddingTop: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ border: "1px solid #e4e4e7", borderRadius: "8px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px", background: "#fafafa" }}>
                    <span style={{ fontSize: "11px", fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.05em" }}>Reference</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                        PI Value ({editRow.currency ?? "—"})
                        <input style={{ ...inputStyle, background: "#f0f0f0" }} value={editRow.pi_total_value ?? "—"} readOnly />
                      </label>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                        Currency
                        <input style={{ ...inputStyle, background: "#f0f0f0" }} value={editRow.currency ?? "—"} readOnly />
                      </label>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                        Rate
                        <input style={{ ...inputStyle, background: "#f0f0f0" }} value={editRow.exchange_rate ?? "—"} readOnly />
                      </label>
                    </div>
                    <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                      Insurance (INR)
                      <input style={{ ...inputStyle, background: "#f0f0f0" }} value={editRow.insurance ?? "—"} readOnly />
                    </label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                        Freight ({freightRef?.currency ?? "—"})
                        <input style={{ ...inputStyle, background: "#f0f0f0" }} value={freightRef?.freight ?? "—"} readOnly />
                      </label>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                        Currency
                        <input style={{ ...inputStyle, background: "#f0f0f0" }} value={freightRef?.currency ?? "—"} readOnly />
                      </label>
                      <label style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", display: "flex", flexDirection: "column", gap: "4px" }}>
                        Rate
                        <input style={{ ...inputStyle, background: "#f0f0f0" }} value={freightRef?.exchange_rate ?? "—"} readOnly />
                      </label>
                    </div>
                  </div>
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif" }}>Actual BOE Entries</span>
                  <table style={{ borderCollapse: "collapse", width: "100%" }}>
                    <thead>
                      <tr>
                        <th style={{ ...inputStyle, textAlign: "left", fontSize: "11px", fontWeight: 600, color: "#71717a", padding: "4px 8px", border: "none" }}>Amount</th>
                        <th style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", padding: "4px 8px", textAlign: "left" }}>Currency</th>
                        <th style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", padding: "4px 8px", textAlign: "left" }}>Rate</th>
                        <th style={{ fontSize: "11px", fontWeight: 600, color: "#71717a", padding: "4px 8px", textAlign: "left" }}>Note</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {boeEntries.map((e) => (
                        <tr key={e.id}>
                          <td style={{ padding: "4px 8px", fontSize: "13px" }}>{e.amount}</td>
                          <td style={{ padding: "4px 8px", fontSize: "13px" }}>{e.currency ?? "INR"}</td>
                          <td style={{ padding: "4px 8px", fontSize: "13px" }}>{e.currency && e.currency !== "INR" ? (e.rate ?? "—") : "—"}</td>
                          <td style={{ padding: "4px 8px", fontSize: "13px" }}>{e.note ?? "—"}</td>
                          <td style={{ padding: "4px 8px" }}>
                            <button onClick={() => handleDeleteBoeEntry(e.id)}
                              style={{ padding: "2px 8px", fontSize: "11px", borderRadius: "6px", border: "1px solid #fecaca", background: "transparent", color: "#ef4444", cursor: "pointer" }}>
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                      <tr style={{ background: "#fafafa" }}>
                        <td style={{ padding: "4px 8px" }}><input style={{ ...inputStyle, width: "90px" }} placeholder="Amount" value={newBoeEntry.amount} onChange={(e) => setNewBoeEntry({ ...newBoeEntry, amount: e.target.value })} /></td>
                        <td style={{ padding: "4px 8px" }}>
                          <select style={{ ...inputStyle, width: "80px" }} value={newBoeEntry.currency}
                            onChange={(e) => setNewBoeEntry({ ...newBoeEntry, currency: e.target.value, rate: e.target.value === "INR" ? "" : newBoeEntry.rate })}>
                            {ENTRY_CCY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </td>
                        <td style={{ padding: "4px 8px" }}>
                          <input style={{ ...inputStyle, width: "80px" }} placeholder="Rate" disabled={newBoeEntry.currency === "INR"} value={newBoeEntry.rate}
                            onChange={(e) => setNewBoeEntry({ ...newBoeEntry, rate: e.target.value })} />
                        </td>
                        <td style={{ padding: "4px 8px" }}><input style={{ ...inputStyle, width: "130px" }} placeholder="Note (optional)" value={newBoeEntry.note} onChange={(e) => setNewBoeEntry({ ...newBoeEntry, note: e.target.value })} /></td>
                        <td style={{ padding: "4px 8px" }}>
                          <button onClick={handleAddBoeEntry} disabled={entrySaving}
                            style={{ padding: "4px 10px", fontSize: "12px", fontWeight: 600, borderRadius: "6px", border: "1px solid #09090b", background: "#09090b", color: "#fff", cursor: "pointer" }}>
                            {entrySaving ? "…" : "Add"}
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                  <div style={{ display: "flex", gap: "16px", fontSize: "12px", fontFamily: "var(--font-mono), monospace", color: "#52525b", flexWrap: "wrap" }}>
                    <span>Sum: {boeEntries.reduce((acc, e) => acc + (parseFloat(e.amount) || 0), 0).toFixed(2)}</span>
                    <span style={{ fontWeight: 600, color: "#09090b" }}>
                      Actual BOE: {(boeEntries.reduce((acc, e) => acc + entryInrValue(e), 0) * (1 + (parseFloat(editForm.customs_rate ?? "0") || 0) / 100)).toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: "16px 24px", borderTop: "1px solid #e4e4e7", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div style={{ display: "flex", gap: "8px" }}>
                {activeSection > 0 && (
                  <button onClick={() => setActiveSection((i) => i - 1)}
                    style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #e4e4e7", background: "transparent", color: "#71717a" }}>
                    ← Prev
                  </button>
                )}
                {activeSection < SECTIONS.length - 1 && (
                  <button onClick={() => setActiveSection((i) => i + 1)}
                    style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #e4e4e7", background: "#f4f4f5", color: "#09090b" }}>
                    Next →
                  </button>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button onClick={() => setEditRow(null)}
                  style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #e4e4e7", background: "transparent", color: "#71717a" }}>
                  Cancel
                </button>
                <button onClick={handleSave} disabled={saving}
                  style={{ padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #09090b", background: "#09090b", color: "#fff" }}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
