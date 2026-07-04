"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect, useRef } from "react";
import { usePolling } from "@/lib/usePolling";
import { useRouter } from "next/navigation";
import AmountInput from "@/components/AmountInput";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";
import { exportToExcel } from "@/lib/exportExcel";

interface Row { id: number; uid: string; fields_entered: boolean | null; [key: string]: string | null | number | boolean; }
interface Supplier { id: number; supplier_name: string; supplier_code: string; }


const PO_PI_COLS = [
  { key: "date_of_po",            label: "Date of PO"       },
  { key: "supplier_name",         label: "Supplier Name"    },
  { key: "rocket_item_code",      label: "Rocket Item Code" },
  { key: "supplier_code",         label: "Supplier Code"    },
  { key: "po_number",             label: "PO Number"        },
  { key: "pi_number",             label: "PI Number"        },
  { key: "pi_date",               label: "PI Date"          },
  { key: "supplier_model_number", label: "Supplier Model No"},
  { key: "pi_quantity",           label: "PI Quantity"      },
  { key: "pi_rate",               label: "PI Rate"          },
  { key: "currency",              label: "Currency"         },
  { key: "exchange_rate",         label: "Exchange Rate"    },
  { key: "pi_total_value",        label: "PI Total (orig.)" },
  { key: "po_total_value",        label: "Total (INR)"      },
  { key: "confirmed_exworks",     label: "Ex-Works"         },
  { key: "credit_time",           label: "Credit Time"      },
];

// Fields shown in the dialog (po_total_value computed & sent but not rendered as input)
const DIALOG_FIELDS = [
  "supplier_name", "supplier_code",
  "supplier_model_number", "rocket_item_code",
  "po_number", "pi_number",
  "date_of_po", "pi_date",
  "pi_quantity", "pi_rate",
  "currency", "exchange_rate",
  "confirmed_exworks", "credit_time",
] as const;

const DATE_FIELDS = new Set(["date_of_po", "pi_date", "confirmed_exworks"]);

const LABELS: Record<string, string> = {
  supplier_name: "Supplier Name", supplier_code: "Supplier Code",
  supplier_model_number: "Supplier Model No", rocket_item_code: "Rocket Item Code",
  po_number: "PO Number", pi_number: "PI Number",
  date_of_po: "Date of PO", pi_date: "PI Date",
  pi_quantity: "PI Quantity", pi_rate: "PI Rate",
  currency: "Currency", exchange_rate: "Exchange Rate",
  confirmed_exworks: "Ex-Works", credit_time: "Credit Time (days)",
};

type FormState = Record<string, string> & { pi_total_value: string };

function emptyForm(): FormState {
  return Object.fromEntries([...DIALOG_FIELDS, "pi_total_value"].map((f) => [f, ""])) as FormState;
}

function calcPiTotal(form: FormState): string {
  const q = parseFloat(form.pi_quantity) || 0;
  const r = parseFloat(form.pi_rate) || 0;
  return q && r ? String(parseFloat((q * r).toFixed(4))) : "";
}

function calcPoTotalInr(form: FormState): string {
  const pi = parseFloat(form.pi_total_value) || 0;
  if (!pi) return "";
  if (form.currency === "INR") return String(pi);
  const rate = parseFloat(form.exchange_rate) || 0;
  return rate ? String(parseFloat((pi * rate).toFixed(4))) : "";
}

const btnStyle = (variant: "primary" | "danger" | "ghost" | "action"): React.CSSProperties => ({
  padding: "5px 12px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(variant === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     variant === "danger"   ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
     variant === "action"   ? { background: "#f4f4f5", color: "#09090b", borderColor: "#e4e4e7" } :
                               { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa",
};

const TH: React.CSSProperties = { padding: "10px 14px", textAlign: "left", fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #e4e4e7", whiteSpace: "nowrap" };
const TD: React.CSSProperties = { padding: "9px 14px", fontSize: "13px", borderBottom: "1px solid #f4f4f5", color: "#09090b", whiteSpace: "nowrap" };

const POPI_COL_DEFS: ColDef[] = [
  { key: "date_of_po",            label: "Date of PO",        type: "date"   },
  { key: "supplier_name",         label: "Supplier Name",     type: "text"   },
  { key: "rocket_item_code",      label: "Rocket Item Code",  type: "text"   },
  { key: "supplier_code",         label: "Supplier Code",     type: "text"   },
  { key: "po_number",             label: "PO Number",         type: "text"   },
  { key: "pi_number",             label: "PI Number",         type: "text"   },
  { key: "pi_date",               label: "PI Date",           type: "date"   },
  { key: "supplier_model_number", label: "Supplier Model No", type: "text"   },
  { key: "pi_quantity",           label: "PI Quantity",       type: "amount" },
  { key: "pi_rate",               label: "PI Rate",           type: "amount" },
  { key: "currency",              label: "Currency",          type: "select", options: ["USD","INR","CNY"] },
  { key: "exchange_rate",         label: "Exchange Rate",     type: "amount" },
  { key: "pi_total_value",        label: "PI Total (orig.)",  type: "amount" },
  { key: "po_total_value",        label: "Total (INR)",       type: "amount" },
  { key: "confirmed_exworks",     label: "Ex-Works",          type: "date"   },
  { key: "credit_time",           label: "Credit Time",       type: "amount" },
];

export default function PoPiClient({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const { filteredRows, filters, sort, distinctValues, setFilter, setSort } =
    useTableState(rows as unknown as Record<string, unknown>[], POPI_COL_DEFS, "po_pi");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierModels, setSupplierModels] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [newModelModal, setNewModelModal] = useState(false);
  const [editModal, setEditModal] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  async function fetchRows() {
    const res = await apiFetch(`${API}/api/rows/stage/po_pi`);
    if (res.ok) setRows(await res.json());
  }
  useEffect(() => {
    fetchRows();
    apiFetch(`${API}/api/suppliers/`).then((r) => r.ok ? r.json() : []).then((d) => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  usePolling(fetchRows, 10_000);

  async function handleDownloadTemplate() {
    const res = await apiFetch(`${API}/api/rows/export?type=template&stage=po_pi`);
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "po_pi_template.csv";
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

  async function fetchModels(supplier: Supplier) {
    try {
      const res = await apiFetch(`${API}/api/suppliers/${supplier.id}/models`);
      const data = res.ok ? await res.json() : [];
      setSupplierModels(Array.isArray(data) ? data.map((m: { model_number: string }) => m.model_number) : []);
    } catch { setSupplierModels([]); }
  }

  function handleSupplierChange(name: string) {
    const match = suppliers.find((s) => s.supplier_name === name) ?? null;
    setSelectedSupplier(match);
    if (match) fetchModels(match); else setSupplierModels([]);
    setForm((f) => ({ ...f, supplier_name: name, supplier_code: match ? match.supplier_code : f.supplier_code, supplier_model_number: "" }));
  }

  function handleFieldChange(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // pi total auto-calc
      if (field === "pi_quantity" || field === "pi_rate") {
        next.pi_total_value = calcPiTotal(next);
      }
      // exchange rate not needed for INR
      if (field === "currency" && value === "INR") {
        next.exchange_rate = "";
      }
      return next;
    });
  }

  const inrTotal = calcPoTotalInr(form);

  function handleCreate() {
    const model = form.supplier_model_number.trim();
    if (model && selectedSupplier && !supplierModels.includes(model)) {
      setNewModelModal(true);
      return;
    }
    doCreate();
  }

  async function doCreate(saveModel = false) {
    setSaving(true);
    if (saveModel && selectedSupplier && form.supplier_model_number.trim()) {
      await apiFetch(`${API}/api/suppliers/${selectedSupplier.id}/models`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model_number: form.supplier_model_number.trim() }),
      });
      setSupplierModels((m) => [...m, form.supplier_model_number.trim()].sort());
    }
    const body: Record<string, string> = {};
    for (const [k, v] of Object.entries(form)) if (v.trim()) body[k] = v.trim();
    // store pi_total_value and po_total_value (INR)
    if (form.pi_total_value) body.pi_total_value = form.pi_total_value;
    if (inrTotal) body.po_total_value = inrTotal;
    const res = await apiFetch(`${API}/api/rows/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json();
      setRows((r) => [created, ...r]);
      setShowModal(false);
      setNewModelModal(false);
      setForm(emptyForm());
      setSelectedSupplier(null);
      setSupplierModels([]);
    }
    setSaving(false);
  }

  async function handleDelete(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, { method: "DELETE" });
    setRows((r) => r.filter((x) => x.uid !== uid));
  }

  function openEdit(row: Row) {
    setEditForm({
      pi_number: String(row.pi_number ?? ""),
      pi_date: String(row.pi_date ?? ""),
      pi_quantity: String(row.pi_quantity ?? ""),
      pi_rate: String(row.pi_rate ?? ""),
      currency: String(row.currency ?? ""),
      exchange_rate: String(row.exchange_rate ?? ""),
      confirmed_exworks: String(row.confirmed_exworks ?? ""),
      credit_time: String(row.credit_time ?? ""),
    });
    setEditModal(row);
  }

  async function handleSaveEdit() {
    if (!editModal) return;
    setSaving(true);
    const res = await apiFetch(`${API}/api/rows/${editModal.uid as string}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, fields_entered: true }),
    });
    if (res.ok) {
      const updated = await res.json();
      setRows((r) => r.map((row) => row.uid === updated.uid ? updated : row));
      setEditModal(null);
    }
    setSaving(false);
  }

  async function handleGoToImport(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workflow_status: "pending_import" }),
    });
    setRows((r) => r.filter((x) => x.uid !== uid));
    router.push(`/import-planning`);
  }

  function renderField(f: string) {
    if (f === "supplier_name") {
      return (
        <select style={inputStyle} value={form[f]} onChange={(e) => handleSupplierChange(e.target.value)}>
          <option value="">— select supplier —</option>
          {suppliers.map((s) => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
        </select>
      );
    }
    if (f === "supplier_code") {
      return (
        <select style={inputStyle} value={form[f]} onChange={(e) => setForm((fm) => ({ ...fm, supplier_code: e.target.value }))}>
          <option value="">— select code —</option>
          {suppliers.map((s) => <option key={s.id} value={s.supplier_code}>{s.supplier_code}</option>)}
        </select>
      );
    }
    if (f === "supplier_model_number") {
      return (
        <>
          <input type="text" list="po-pi-model-list" style={inputStyle}
            placeholder={selectedSupplier ? "Type or pick model…" : "Select supplier first"}
            disabled={!selectedSupplier} value={form[f]}
            onChange={(e) => handleFieldChange(f, e.target.value)} />
          <datalist id="po-pi-model-list">{supplierModels.map((m) => <option key={m} value={m} />)}</datalist>
        </>
      );
    }
    if (f === "currency") {
      return (
        <select style={inputStyle} value={form.currency} onChange={(e) => handleFieldChange("currency", e.target.value)}>
          <option value="">— select —</option>
          <option value="USD">USD (US Dollar)</option>
          <option value="INR">INR (Indian Rupee)</option>
          <option value="CNY">CNY (Chinese Yuan)</option>
        </select>
      );
    }
    if (f === "exchange_rate") {
      if (form.currency === "INR" || !form.currency) return null;
      return (
        <input type="text" style={inputStyle} placeholder={`Rate: 1 ${form.currency} = ? INR`}
          value={form.exchange_rate} onChange={(e) => handleFieldChange("exchange_rate", e.target.value)} />
      );
    }
    if (f === "credit_time") {
      return <input type="number" min="0" step="1" style={inputStyle} placeholder="Number of days" value={form[f]} onChange={(e) => handleFieldChange(f, e.target.value)} />;
    }
    if (f === "pi_rate") {
      return <AmountInput style={inputStyle} placeholder={LABELS[f]} value={form[f]} currency={form.currency} onChange={(raw) => handleFieldChange(f, raw)} />;
    }
    return (
      <input type={DATE_FIELDS.has(f) ? "date" : "text"} style={inputStyle}
        placeholder={LABELS[f]} value={form[f]}
        onChange={(e) => handleFieldChange(f, e.target.value)} />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0 }}>PO / PI</h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button style={btnStyle("ghost")} onClick={() => exportToExcel(filteredRows, "po-pi", Object.fromEntries(PO_PI_COLS.map(c => [c.key, c.label])))}>↓ Export</button>
          <button style={btnStyle("ghost")} onClick={handleDownloadTemplate} title="Download empty CSV template">↓ Template</button>
          <label style={{ ...btnStyle("ghost"), opacity: importing ? 0.5 : 1, cursor: importing ? "default" : "pointer", display: "inline-flex", alignItems: "center" }}
            title="Import rows from CSV">
            {importing ? "Importing…" : "↑ Import CSV"}
            <input ref={importRef} type="file" accept=".csv" style={{ display: "none" }} onChange={handleImportFile} disabled={importing} />
          </label>
          <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ Add Row</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              {PO_PI_COLS.map((c) => {
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
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
            <InlineFilters colDefs={POPI_COL_DEFS} filters={filters} distinctValues={distinctValues} onFilter={setFilter} leadingCells={1} trailingCells={1} />
          </thead>
          <tbody>
            {filteredRows.length === 0 ? (
              <tr><td colSpan={PO_PI_COLS.length + 2} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>{rows.length === 0 ? "No rows — click Add Row" : "No results match filters"}</td></tr>
            ) : (filteredRows as Row[]).map((row, i) => (
              <tr key={row.uid as string}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", fontSize: "11px" }}>{String(i + 1).padStart(3, "0")}</td>
                {PO_PI_COLS.map((c) => (
                  <td key={c.key} style={{ ...TD, fontFamily: c.key === "uid" ? "var(--font-mono), monospace" : undefined, fontSize: c.key === "uid" ? "11px" : undefined, color: c.key === "uid" ? "#a1a1aa" : "#09090b" }}>
                    {c.key === "uid" ? String(row.uid).slice(0, 8) + "…" : (row[c.key] as string) ?? <span style={{ color: "#d4d4d8" }}>—</span>}
                  </td>
                ))}
                <td style={{ ...TD, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    <button style={btnStyle("action")} onClick={() => openEdit(row)}>
                      {row.fields_entered ? "Edit Fields" : "Enter Fields"}
                    </button>
                    <button style={{ ...btnStyle("primary"), ...(!row.fields_entered ? { opacity: 0.4, cursor: "not-allowed" } : {}) }} onClick={() => { if (!row.fields_entered) return; handleGoToImport(row.uid as string); }}>Go to Import →</button>
                    <button style={btnStyle("danger")} onClick={() => handleDelete(row.uid as string)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreate(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "560px", maxHeight: "85vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Add PO / PI Row</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {DIALOG_FIELDS.map((f) => {
                const rendered = renderField(f);
                if (rendered === null) return null;
                return (
                  <label key={f} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {LABELS[f]}
                    {rendered}
                  </label>
                );
              })}
            </div>

            {/* PI total + INR total display */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                PI Total ({form.currency || "orig. currency"}) — auto
                <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={form.pi_total_value} readOnly placeholder="Auto-calculated" />
              </label>
              {form.currency !== "INR" && (
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Total in INR — auto
                  <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={inrTotal} readOnly placeholder="PI total × exchange rate" />
                </label>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setShowModal(false); setForm(emptyForm()); setSelectedSupplier(null); setSupplierModels([]); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "480px", maxHeight: "80vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400 }}>{editModal.fields_entered ? "Edit Fields" : "Enter Fields"} — PO / PI</h2>
            {[
              { key: "pi_number",       label: "PI Number",      type: "text"   },
              { key: "pi_date",         label: "PI Date",        type: "date"   },
              { key: "pi_quantity",     label: "PI Quantity",    type: "number" },
              { key: "pi_rate",         label: "PI Rate",        type: "text"   },
              { key: "confirmed_exworks", label: "Ex-Works Date", type: "date"  },
              { key: "credit_time",     label: "Credit Time (days)", type: "number" },
            ].map((f) => (
              <label key={f.key} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                {f.label}
                <input type={f.type} style={inputStyle} value={editForm[f.key] ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, [f.key]: e.target.value }))} />
              </label>
            ))}
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
              Currency
              <select style={inputStyle} value={editForm.currency ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, currency: e.target.value, exchange_rate: e.target.value === "INR" ? "" : prev.exchange_rate }))}>
                <option value="">— select —</option>
                <option value="USD">USD</option>
                <option value="INR">INR</option>
                <option value="CNY">CNY</option>
              </select>
            </label>
            {editForm.currency && editForm.currency !== "INR" && (
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                Exchange Rate (1 {editForm.currency} = ? INR)
                <input type="text" style={inputStyle} value={editForm.exchange_rate ?? ""} onChange={(e) => setEditForm((prev) => ({ ...prev, exchange_rate: e.target.value }))} />
              </label>
            )}
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setEditModal(null)}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {newModelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") doCreate(true); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "400px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>New model number</h2>
            <p style={{ margin: 0, fontSize: "14px", fontFamily: "var(--font-sans), sans-serif", color: "#52525b", lineHeight: 1.5 }}>
              <strong style={{ fontFamily: "var(--font-mono), monospace", background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px" }}>{form.supplier_model_number}</strong> is not in{" "}
              <strong>{selectedSupplier?.supplier_name}</strong>'s model list. Save it?
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setNewModelModal(false)}>Cancel</button>
              <button style={btnStyle("action")} onClick={() => doCreate(false)} disabled={saving}>Create without saving</button>
              <button style={btnStyle("primary")} onClick={() => doCreate(true)} disabled={saving}>{saving ? "Saving…" : "Save & Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
