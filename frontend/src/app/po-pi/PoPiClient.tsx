"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect, useRef, useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import { useRouter } from "next/navigation";
import InlineFilters from "@/components/InlineFilters";
import { useTableState, ColDef } from "@/components/useTableState";
import { exportToExcel } from "@/lib/exportExcel";
import { applyColumnOrder, useColumnOrder } from "@/lib/columnOrder";
import { useDensity } from "@/components/DensityContext";
import PiItemsEditor, { PiItemDraft, blankItem, itemsTotalValue, nonEmptyItems } from "@/components/PiItemsEditor";

interface Row { id: number; uid: string; fields_entered: boolean | null; [key: string]: string | null | number | boolean; }
interface Supplier { id: number; supplier_name: string; supplier_code: string; }


export const PO_PI_COLS_BASE = [
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
  { key: "advance_currency",      label: "Advance Currency" },
  { key: "advance_rate",          label: "Advance Rate"     },
  { key: "advance_given",         label: "Advance Given (orig.)" },
  { key: "advance_inr",           label: "Advance (INR)"    },
  { key: "estimated_etd",         label: "Estimated ETD"    },
  { key: "estimated_eta",         label: "Estimated ETA"    },
  { key: "allocated_month",       label: "Allocated Month"  },
];

// Fields shown in the dialog (po_total_value computed & sent but not rendered as
// input; model/quantity/rate live in the model-wise items editor)
const DIALOG_FIELDS = [
  "supplier_name", "supplier_code",
  "rocket_item_code", "po_number",
  "pi_number", "date_of_po",
  "pi_date", "currency",
  "exchange_rate", "confirmed_exworks",
  "credit_time", "estimated_etd",
  "estimated_eta", "allocated_month",
] as const;

// The subset of DIALOG_FIELDS required for a row to count as "fields entered"
// (the Enter/Edit Fields dialog itself now shows every DIALOG_FIELDS field).
// Quantity/rate completeness is checked against the items list instead.
const EDIT_FIELDS = ["pi_number", "pi_date", "currency", "exchange_rate", "confirmed_exworks", "credit_time"] as const;

const DATE_FIELDS = new Set(["date_of_po", "pi_date", "confirmed_exworks", "estimated_etd", "estimated_eta"]);
const MONTH_FIELDS = new Set(["allocated_month"]);

const LABELS: Record<string, string> = {
  supplier_name: "Supplier Name", supplier_code: "Supplier Code",
  supplier_model_number: "Supplier Model No", rocket_item_code: "Rocket Item Code",
  po_number: "PO Number", pi_number: "PI Number",
  date_of_po: "Date of PO", pi_date: "PI Date",
  pi_quantity: "PI Quantity", pi_rate: "PI Rate",
  currency: "Currency", exchange_rate: "Exchange Rate",
  confirmed_exworks: "Ex-Works", credit_time: "Credit Time (days)",
  estimated_etd: "Estimated ETD", estimated_eta: "Estimated ETA",
  allocated_month: "Allocated Month",
};

type FormState = Record<string, string>;

function emptyForm(): FormState {
  return Object.fromEntries(DIALOG_FIELDS.map((f) => [f, ""])) as FormState;
}

function calcPoTotalInr(piTotal: number, currency: string, exchangeRate: string): string {
  if (!piTotal) return "";
  if (currency === "INR") return String(parseFloat(piTotal.toFixed(4)));
  const rate = parseFloat(exchangeRate) || 0;
  return rate ? String(parseFloat((piTotal * rate).toFixed(4))) : "";
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

export const POPI_COL_DEFS_BASE: ColDef[] = [
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
  { key: "advance_currency",      label: "Advance Currency",  type: "select", options: ["USD","INR","CNY"] },
  { key: "advance_rate",          label: "Advance Rate",      type: "amount" },
  { key: "advance_given",         label: "Advance Given (orig.)", type: "amount" },
  { key: "advance_inr",           label: "Advance (INR)",     type: "amount" },
  { key: "estimated_etd",         label: "Estimated ETD",     type: "date"   },
  { key: "estimated_eta",         label: "Estimated ETA",     type: "date"   },
  { key: "allocated_month",       label: "Allocated Month",   type: "text"   },
];

export default function PoPiClient({ initialRows }: { initialRows: Row[] }) {
  const { compact } = useDensity();
  const TH: React.CSSProperties = { padding: compact ? "4px 8px" : "10px 14px", textAlign: "left", fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #b8b8bf", whiteSpace: "nowrap" };
  const TD: React.CSSProperties = { padding: compact ? "3px 8px" : "9px 14px", fontSize: "13px", borderBottom: "1px solid #d4d4d8", color: "#09090b", whiteSpace: "nowrap" };
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initialRows);
  const columnOrder = useColumnOrder("po_pi");
  const PO_PI_COLS = useMemo(() => applyColumnOrder(PO_PI_COLS_BASE, columnOrder), [columnOrder]);
  const POPI_COL_DEFS = useMemo(() => applyColumnOrder(POPI_COL_DEFS_BASE, columnOrder), [columnOrder]);
  const { filteredRows, filters, sort, distinctValues, setFilter, setSort } =
    useTableState(rows as unknown as Record<string, unknown>[], POPI_COL_DEFS, "po_pi");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierModels, setSupplierModels] = useState<string[]>([]);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [items, setItems] = useState<PiItemDraft[]>([blankItem()]);
  const [advanceForm, setAdvanceForm] = useState({ advance_currency: "", advance_rate: "", advance_given: "" });
  const [saving, setSaving] = useState(false);
  const [newModelModal, setNewModelModal] = useState(false);
  const [newModels, setNewModels] = useState<string[]>([]);
  const [editModal, setEditModal] = useState<Row | null>(null);
  const [editForm, setEditForm] = useState<FormState>(emptyForm());
  const [editItems, setEditItems] = useState<PiItemDraft[]>([blankItem()]);
  const [editSelectedSupplier, setEditSelectedSupplier] = useState<Supplier | null>(null);
  const [editSupplierModels, setEditSupplierModels] = useState<string[]>([]);
  const [editAdvanceForm, setEditAdvanceForm] = useState({ advance_currency: "", advance_rate: "", advance_given: "" });
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

  async function fetchModelsInto(supplier: Supplier, setter: (models: string[]) => void) {
    try {
      const res = await apiFetch(`${API}/api/suppliers/${supplier.id}/models`);
      const data = res.ok ? await res.json() : [];
      setter(Array.isArray(data) ? data.map((m: { model_number: string }) => m.model_number) : []);
    } catch { setter([]); }
  }

  function fetchModels(supplier: Supplier) {
    return fetchModelsInto(supplier, setSupplierModels);
  }

  function handleSupplierChange(name: string) {
    const match = suppliers.find((s) => s.supplier_name === name) ?? null;
    setSelectedSupplier(match);
    if (match) fetchModels(match); else setSupplierModels([]);
    setForm((f) => ({ ...f, supplier_name: name, supplier_code: match ? match.supplier_code : f.supplier_code }));
    setItems((its) => its.map((it) => ({ ...it, model_number: "" })));
  }

  function handleEditSupplierChange(name: string) {
    const match = suppliers.find((s) => s.supplier_name === name) ?? null;
    setEditSelectedSupplier(match);
    if (match) fetchModelsInto(match, setEditSupplierModels); else setEditSupplierModels([]);
    setEditForm((f) => ({ ...f, supplier_name: name, supplier_code: match ? match.supplier_code : f.supplier_code }));
    setEditItems((its) => its.map((it) => ({ ...it, model_number: "" })));
  }

  function handleFieldChange(field: string, value: string) {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      // exchange rate not needed for INR
      if (field === "currency" && value === "INR") {
        next.exchange_rate = "";
      }
      return next;
    });
  }

  function handleEditFieldChange(field: string, value: string) {
    setEditForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "currency" && value === "INR") {
        next.exchange_rate = "";
      }
      return next;
    });
  }

  const piTotal = itemsTotalValue(items);
  const inrTotal = calcPoTotalInr(piTotal, form.currency, form.exchange_rate);

  const advanceInr = calcPoTotalInr(
    parseFloat(advanceForm.advance_given) || 0, advanceForm.advance_currency, advanceForm.advance_rate
  );

  const editPiTotal = itemsTotalValue(editItems);
  const editInrTotal = calcPoTotalInr(editPiTotal, editForm.currency, editForm.exchange_rate);

  const editAdvanceInr = calcPoTotalInr(
    parseFloat(editAdvanceForm.advance_given) || 0, editAdvanceForm.advance_currency, editAdvanceForm.advance_rate
  );

  function handleAdvanceChange(field: string, value: string) {
    setAdvanceForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "advance_currency" && value === "INR") next.advance_rate = "";
      return next;
    });
  }

  function handleEditAdvanceChange(field: string, value: string) {
    setEditAdvanceForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "advance_currency" && value === "INR") next.advance_rate = "";
      return next;
    });
  }

  function detectUnknownModels(itemsList: PiItemDraft[], knownModels: string[]): string[] {
    return [...new Set(
      nonEmptyItems(itemsList).map((it) => it.model_number.trim())
        .filter((m) => !knownModels.includes(m))
    )];
  }

  function handleCreate() {
    const unknown = detectUnknownModels(items, supplierModels);
    if (unknown.length > 0 && selectedSupplier) {
      setNewModels(unknown);
      setNewModelModal(true);
      return;
    }
    doCreate();
  }

  async function doCreate(saveModel = false) {
    setSaving(true);
    if (saveModel && selectedSupplier && newModels.length > 0) {
      for (const m of newModels) {
        await apiFetch(`${API}/api/suppliers/${selectedSupplier.id}/models`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_number: m }),
        });
      }
      setSupplierModels((prev) => [...prev, ...newModels].sort());
    }
    const body: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(form)) if (v.trim()) body[k] = v.trim();
    const sendItems = nonEmptyItems(items);
    if (sendItems.length > 0) body.items = sendItems;
    // pi_quantity / pi_total_value / supplier_model_number are recomputed
    // server-side from items; po_total_value (INR) is client-computed
    if (inrTotal) body.po_total_value = inrTotal;
    if (advanceForm.advance_given.trim()) {
      body.advance_given = advanceForm.advance_given.trim();
      body.advance_currency = advanceForm.advance_currency;
      if (advanceForm.advance_rate.trim()) body.advance_rate = advanceForm.advance_rate.trim();
      if (advanceInr) body.advance_inr = advanceInr;
    }
    const res = await apiFetch(`${API}/api/rows/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json();
      setRows((r) => [created, ...r]);
      setShowModal(false);
      setNewModelModal(false);
      setNewModels([]);
      setForm(emptyForm());
      setItems([blankItem()]);
      setAdvanceForm({ advance_currency: "", advance_rate: "", advance_given: "" });
      setSelectedSupplier(null);
      setSupplierModels([]);
    }
    setSaving(false);
  }

  async function handleDelete(uid: string) {
    await apiFetch(`${API}/api/rows/${uid}`, { method: "DELETE" });
    setRows((r) => r.filter((x) => x.uid !== uid));
  }

  async function openEdit(row: Row) {
    setEditForm(Object.fromEntries(DIALOG_FIELDS.map((f) => [f, String(row[f] ?? "")])) as FormState);
    setEditAdvanceForm({
      advance_currency: String(row.advance_currency ?? ""),
      advance_rate: String(row.advance_rate ?? ""),
      advance_given: String(row.advance_given ?? ""),
    });
    setEditModal(row);
    // load the row's model-wise items; fall back to a single line built
    // from the legacy single-product fields
    const res = await apiFetch(`${API}/api/rows/${row.uid as string}/items`);
    const data = res.ok ? await res.json() : [];
    if (Array.isArray(data) && data.length > 0) {
      setEditItems(data.map((it: PiItemDraft) => ({
        model_number: String(it.model_number ?? ""),
        quantity: String(it.quantity ?? ""),
        rate: String(it.rate ?? ""),
      })));
    } else {
      setEditItems([{
        model_number: String(row.supplier_model_number ?? ""),
        quantity: String(row.pi_quantity ?? ""),
        rate: String(row.pi_rate ?? ""),
      }]);
    }
    const supplier = suppliers.find((s) => s.supplier_name === row.supplier_name) ?? null;
    setEditSelectedSupplier(supplier);
    if (supplier) fetchModelsInto(supplier, setEditSupplierModels); else setEditSupplierModels([]);
  }

  function handleSaveEdit() {
    if (!editModal) return;
    const unknown = detectUnknownModels(editItems, editSupplierModels);
    if (unknown.length > 0 && editSelectedSupplier) {
      setNewModels(unknown);
      setNewModelModal(true);
      return;
    }
    doSaveEdit();
  }

  async function doSaveEdit(saveModel = false) {
    if (!editModal) return;
    setSaving(true);
    if (saveModel && editSelectedSupplier && newModels.length > 0) {
      for (const m of newModels) {
        await apiFetch(`${API}/api/suppliers/${editSelectedSupplier.id}/models`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_number: m }),
        });
      }
      setEditSupplierModels((prev) => [...prev, ...newModels].sort());
    }
    // exchange_rate isn't shown/required when currency is INR (no conversion needed)
    const requiredFields = editForm.currency === "INR" ? EDIT_FIELDS.filter((k) => k !== "exchange_rate") : EDIT_FIELDS;
    const sendItems = nonEmptyItems(editItems);
    const itemsComplete = sendItems.length > 0 && sendItems.every((it) => it.quantity.trim() !== "" && it.rate.trim() !== "");
    const allFilled = itemsComplete && requiredFields.every((k) => (editForm[k] ?? "").trim() !== "");
    const body: Record<string, unknown> = { ...editForm, fields_entered: allFilled };
    if (sendItems.length > 0) body.items = sendItems;
    if (editInrTotal) body.po_total_value = editInrTotal;
    body.advance_given = editAdvanceForm.advance_given;
    body.advance_currency = editAdvanceForm.advance_currency;
    body.advance_rate = editAdvanceForm.advance_rate;
    body.advance_inr = editAdvanceInr;
    const res = await apiFetch(`${API}/api/rows/${editModal.uid as string}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setRows((r) => r.map((row) => row.uid === updated.uid ? updated : row));
      setEditModal(null);
      setNewModelModal(false);
      setNewModels([]);
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

  function renderFieldCommon(
    f: string,
    values: FormState,
    handlers: {
      onChange: (field: string, value: string) => void;
      onSupplierChange: (name: string) => void;
      onSupplierCodeChange: (code: string) => void;
    },
  ) {
    if (f === "supplier_name") {
      return (
        <select style={inputStyle} value={values[f]} onChange={(e) => handlers.onSupplierChange(e.target.value)}>
          <option value="">— select supplier —</option>
          {suppliers.map((s) => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
        </select>
      );
    }
    if (f === "supplier_code") {
      return (
        <select style={inputStyle} value={values[f]} onChange={(e) => handlers.onSupplierCodeChange(e.target.value)}>
          <option value="">— select code —</option>
          {suppliers.map((s) => <option key={s.id} value={s.supplier_code}>{s.supplier_code}</option>)}
        </select>
      );
    }
    if (f === "currency") {
      return (
        <select style={inputStyle} value={values.currency} onChange={(e) => handlers.onChange("currency", e.target.value)}>
          <option value="">— select —</option>
          <option value="USD">USD (US Dollar)</option>
          <option value="INR">INR (Indian Rupee)</option>
          <option value="CNY">CNY (Chinese Yuan)</option>
        </select>
      );
    }
    if (f === "exchange_rate") {
      if (values.currency === "INR" || !values.currency) return null;
      return (
        <input type="text" style={inputStyle} placeholder={`Rate: 1 ${values.currency} = ? INR`}
          value={values.exchange_rate} onChange={(e) => handlers.onChange("exchange_rate", e.target.value)} />
      );
    }
    if (f === "credit_time") {
      return <input type="number" min="0" step="1" style={inputStyle} placeholder="Number of days" value={values[f]} onChange={(e) => handlers.onChange(f, e.target.value)} />;
    }
    return (
      <input type={DATE_FIELDS.has(f) ? "date" : MONTH_FIELDS.has(f) ? "month" : "text"} style={inputStyle}
        placeholder={LABELS[f]} value={values[f]}
        onChange={(e) => handlers.onChange(f, e.target.value)} />
    );
  }

  function renderField(f: string) {
    return renderFieldCommon(f, form, {
      onChange: handleFieldChange,
      onSupplierChange: handleSupplierChange,
      onSupplierCodeChange: (code) => setForm((fm) => ({ ...fm, supplier_code: code })),
    });
  }

  function renderEditField(f: string) {
    return renderFieldCommon(f, editForm, {
      onChange: handleEditFieldChange,
      onSupplierChange: handleEditSupplierChange,
      onSupplierCodeChange: (code) => setEditForm((fm) => ({ ...fm, supplier_code: code })),
    });
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

            <PiItemsEditor items={items} onChange={setItems} models={supplierModels}
              datalistId="po-pi-model-list" disabled={!selectedSupplier && suppliers.length > 0} />

            {/* PI total + INR total display */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                PI Total ({form.currency || "orig. currency"}) — auto
                <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={piTotal ? piTotal.toFixed(2) : ""} readOnly placeholder="Auto-calculated" />
              </label>
              {form.currency !== "INR" && (
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Total in INR — auto
                  <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={inrTotal} readOnly placeholder="PI total × exchange rate" />
                </label>
              )}
            </div>

            {/* Advance — optional, any currency, converted to INR */}
            <div style={{ border: "1px solid #e4e4e7", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px", background: "#fafafa" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono), monospace" }}>Advance (optional)</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Advance Currency
                  <select style={inputStyle} value={advanceForm.advance_currency} onChange={(e) => handleAdvanceChange("advance_currency", e.target.value)}>
                    <option value="">— select —</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="CNY">CNY (Chinese Yuan)</option>
                  </select>
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Advance Given (orig.)
                  <input type="text" style={inputStyle} placeholder="Advance amount" value={advanceForm.advance_given} onChange={(e) => handleAdvanceChange("advance_given", e.target.value)} />
                </label>
                {advanceForm.advance_currency && advanceForm.advance_currency !== "INR" && (
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                    Advance Rate (1 {advanceForm.advance_currency} = ? INR)
                    <input type="text" style={inputStyle} value={advanceForm.advance_rate} onChange={(e) => handleAdvanceChange("advance_rate", e.target.value)} />
                  </label>
                )}
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Advance (INR) — auto
                  <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={advanceInr} readOnly placeholder="Auto-calculated" />
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setShowModal(false); setForm(emptyForm()); setItems([blankItem()]); setAdvanceForm({ advance_currency: "", advance_rate: "", advance_given: "" }); setSelectedSupplier(null); setSupplierModels([]); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleSaveEdit(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "560px", maxHeight: "85vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400 }}>{editModal.fields_entered ? "Edit Fields" : "Enter Fields"} — PO / PI</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {DIALOG_FIELDS.map((f) => {
                const rendered = renderEditField(f);
                if (rendered === null) return null;
                return (
                  <label key={f} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {LABELS[f]}
                    {rendered}
                  </label>
                );
              })}
            </div>

            <PiItemsEditor items={editItems} onChange={setEditItems} models={editSupplierModels}
              datalistId="po-pi-edit-model-list" disabled={!editSelectedSupplier && suppliers.length > 0} />

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                PI Total ({editForm.currency || "orig. currency"}) — auto
                <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={editPiTotal ? editPiTotal.toFixed(2) : ""} readOnly placeholder="Auto-calculated" />
              </label>
              {editForm.currency !== "INR" && (
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Total in INR — auto
                  <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={editInrTotal} readOnly placeholder="PI total × exchange rate" />
                </label>
              )}
            </div>

            <div style={{ border: "1px solid #e4e4e7", borderRadius: "10px", padding: "12px", display: "flex", flexDirection: "column", gap: "10px", background: "#fafafa" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "#52525b", textTransform: "uppercase", letterSpacing: "0.06em", fontFamily: "var(--font-mono), monospace" }}>Advance (optional)</span>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Advance Currency
                  <select style={inputStyle} value={editAdvanceForm.advance_currency} onChange={(e) => handleEditAdvanceChange("advance_currency", e.target.value)}>
                    <option value="">— select —</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="CNY">CNY (Chinese Yuan)</option>
                  </select>
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Advance Given (orig.)
                  <input type="text" style={inputStyle} placeholder="Advance amount" value={editAdvanceForm.advance_given} onChange={(e) => handleEditAdvanceChange("advance_given", e.target.value)} />
                </label>
                {editAdvanceForm.advance_currency && editAdvanceForm.advance_currency !== "INR" && (
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                    Advance Rate (1 {editAdvanceForm.advance_currency} = ? INR)
                    <input type="text" style={inputStyle} value={editAdvanceForm.advance_rate} onChange={(e) => handleEditAdvanceChange("advance_rate", e.target.value)} />
                  </label>
                )}
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Advance (INR) — auto
                  <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={editAdvanceInr} readOnly placeholder="Auto-calculated" />
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setEditModal(null)}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleSaveEdit} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </div>
      )}

      {newModelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") (editModal ? doSaveEdit(true) : doCreate(true)); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "400px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>New model number{newModels.length > 1 ? "s" : ""}</h2>
            <p style={{ margin: 0, fontSize: "14px", fontFamily: "var(--font-sans), sans-serif", color: "#52525b", lineHeight: 1.5 }}>
              {newModels.map((m, i) => (
                <span key={m}>
                  {i > 0 && ", "}
                  <strong style={{ fontFamily: "var(--font-mono), monospace", background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px" }}>{m}</strong>
                </span>
              ))}{" "}
              {newModels.length > 1 ? "are" : "is"} not in <strong>{(editModal ? editSelectedSupplier : selectedSupplier)?.supplier_name}</strong>'s model list. Save {newModels.length > 1 ? "them" : "it"}?
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setNewModelModal(false)}>Cancel</button>
              <button style={btnStyle("action")} onClick={() => (editModal ? doSaveEdit(false) : doCreate(false))} disabled={saving}>{editModal ? "Save without saving model" : "Create without saving"}</button>
              <button style={btnStyle("primary")} onClick={() => (editModal ? doSaveEdit(true) : doCreate(true))} disabled={saving}>{saving ? "Saving…" : editModal ? "Save & Update" : "Save & Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
