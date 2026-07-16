"use client";
import { API, apiFetch } from "@/lib/apiFetch";

import { useState, useEffect, useMemo } from "react";
import { usePolling } from "@/lib/usePolling";
import { useRouter } from "next/navigation";
import { useRole } from "@/components/RoleContext";
import { exportToExcel } from "@/lib/exportExcel";
import { applyColumnOrder, useColumnOrder } from "@/lib/columnOrder";
import { useDensity } from "@/components/DensityContext";
import PiItemsEditor, { PiItemDraft, blankItem, itemsTotalValue, nonEmptyItems } from "@/components/PiItemsEditor";

interface Plan {
  id: number;
  uid: string | null;
  supplier_name: string;
  supplier_model_number: string | null;
  quantity: string | null;
  unit: string | null;
  container_count: string | null;
  nos_per_container: string | null;
  rate: string | null;
  target_date: string | null;
  remark: string | null;
  created_at: string;
  ordered_quantity: string | null;
  quantity_diff: string | null;
}
interface Supplier { id: number; supplier_name: string; supplier_code: string; }


const PO_PI_DIALOG_FIELDS = [
  "supplier_name", "supplier_code",
  "rocket_item_code", "po_number",
  "pi_number", "date_of_po",
  "pi_date", "currency",
  "exchange_rate", "confirmed_exworks",
  "credit_time", "estimated_etd",
  "estimated_eta", "allocated_month",
] as const;

const PO_PI_LABELS: Record<string, string> = {
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

const DATE_FIELDS = new Set(["date_of_po", "pi_date", "confirmed_exworks", "estimated_etd", "estimated_eta"]);
const MONTH_FIELDS = new Set(["allocated_month"]);

type PoPiForm = Record<string, string>;

function emptyPoPiForm(): PoPiForm {
  return Object.fromEntries(PO_PI_DIALOG_FIELDS.map((f) => [f, ""])) as PoPiForm;
}

function calcPoTotalInr(piTotal: number, currency: string, exchangeRate: string): string {
  if (!piTotal) return "";
  if (currency === "INR") return String(parseFloat(piTotal.toFixed(4)));
  const rate = parseFloat(exchangeRate) || 0;
  return rate ? String(parseFloat((piTotal * rate).toFixed(4))) : "";
}

const btnStyle = (variant: "primary" | "danger" | "ghost" | "action"): React.CSSProperties => ({
  padding: "6px 14px", borderRadius: "7px", fontSize: "12px", fontWeight: 600,
  fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid", whiteSpace: "nowrap",
  ...(variant === "primary" ? { background: "#09090b", color: "#fff", borderColor: "#09090b" } :
     variant === "danger"   ? { background: "transparent", color: "#ef4444", borderColor: "#fecaca" } :
     variant === "action"   ? { background: "#f4f4f5", color: "#09090b", borderColor: "#e4e4e7" } :
                               { background: "transparent", color: "#71717a", borderColor: "#e4e4e7" }),
});

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "7px 10px", borderRadius: "7px", border: "1px solid #e4e4e7",
  fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", outline: "none", background: "#fafafa", color: "#09090b",
};

export const ORDER_PLANNING_COLS_BASE = [
  { key: "supplier_name",          label: "Supplier"        },
  { key: "supplier_model_number",  label: "Model No."       },
  { key: "quantity",               label: "Planned Qty"     },
  { key: "unit",                   label: "Unit"            },
  { key: "ordered_quantity",       label: "Ordered Qty"     },
  { key: "quantity_diff",          label: "Difference"      },
  { key: "rate",                   label: "Rate"            },
  { key: "target_date",            label: "Target Date"     },
  { key: "remark",                 label: "Remarks"         },
  { key: "created_at",             label: "Created"         },
];

function fmtDate(s: string | null) {
  if (!s) return null;
  try { return new Date(s).toLocaleDateString(); } catch { return s; }
}

// Planned Qty = container_count × nos_per_container when unit=containers,
// otherwise just the entered quantity.
function computePlannedQty(f: { unit: string; quantity: string; container_count: string; nos_per_container: string }): string {
  if (f.unit === "containers") {
    const cc = parseFloat(f.container_count) || 0;
    const npc = parseFloat(f.nos_per_container) || 0;
    return cc && npc ? String(cc * npc) : "";
  }
  return f.quantity.trim();
}

export default function OrderPlanningClient({ initialPlans }: { initialPlans: Plan[] }) {
  const router = useRouter();
  const { role } = useRole();
  const isExpert = role === "expert";
  const { compact } = useDensity();
  const TH: React.CSSProperties = { padding: compact ? "4px 8px" : "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", background: "#fafafa", borderBottom: "1px solid #b8b8bf", whiteSpace: "nowrap", fontFamily: "var(--font-sans), sans-serif" };
  const TD: React.CSSProperties = { padding: compact ? "3px 8px" : "9px 14px", fontSize: "13px", borderBottom: "1px solid #d4d4d8", fontFamily: "var(--font-sans), sans-serif", color: "#09090b", whiteSpace: "nowrap" };
  function renderPlanCell(col: { key: string; label: string }, p: Plan) {
    switch (col.key) {
      case "supplier_name":
        return <td key={col.key} style={TD}>{p.supplier_name}</td>;
      case "supplier_model_number":
        return <td key={col.key} style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{p.supplier_model_number ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
      case "quantity":
        return <td key={col.key} style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{p.quantity ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
      case "unit":
        return <td key={col.key} style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#71717a", textTransform: "capitalize" }}>{p.unit === "containers" ? "Containers" : "Nos"}</td>;
      case "ordered_quantity":
        return <td key={col.key} style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{p.ordered_quantity ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
      case "quantity_diff": {
        const d = parseFloat(p.quantity_diff ?? "");
        const color = !p.quantity_diff ? "#d4d4d8" : d === 0 ? "#16a34a" : d > 0 ? "#ef4444" : "#f97316";
        return <td key={col.key} style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontWeight: 600, color }}>{p.quantity_diff != null ? (parseFloat(p.quantity_diff) > 0 ? "+" : "") + p.quantity_diff : "—"}</td>;
      }
      case "rate":
        return <td key={col.key} style={{ ...TD, fontFamily: "var(--font-mono), monospace" }}>{p.rate ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
      case "target_date":
        return <td key={col.key} style={TD}>{p.target_date ?? <span style={{ color: "#d4d4d8" }}>—</span>}</td>;
      case "remark":
        return <td key={col.key} style={{ ...TD, color: p.remark ? "#09090b" : "#d4d4d8", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis" }}>{p.remark ?? "—"}</td>;
      case "created_at":
        return <td key={col.key} style={{ ...TD, fontFamily: "var(--font-mono), monospace", fontSize: "11px", color: "#a1a1aa" }}>{fmtDate(p.created_at)}</td>;
      default:
        return <td key={col.key} style={TD}>—</td>;
    }
  }
  const [plans, setPlans] = useState<Plan[]>(initialPlans);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const columnOrder = useColumnOrder("order_planning");
  const COLS = useMemo(() => applyColumnOrder(ORDER_PLANNING_COLS_BASE, columnOrder), [columnOrder]);

  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ supplier_name: "", supplier_model_number: "", quantity: "", unit: "nos", container_count: "", nos_per_container: "", rate: "", target_date: "", remark: "" });
  const [createModels, setCreateModels] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const [editModal, setEditModal] = useState<Plan | null>(null);
  const [editForm, setEditForm] = useState({ supplier_name: "", supplier_model_number: "", quantity: "", unit: "nos", container_count: "", nos_per_container: "", rate: "", target_date: "", remark: "" });
  const [editModels, setEditModels] = useState<string[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  const [poPiModal, setPoPiModal] = useState<Plan | null>(null);
  const [poPiForm, setPoPiForm] = useState<PoPiForm>(emptyPoPiForm());
  const [poPiItems, setPoPiItems] = useState<PiItemDraft[]>([blankItem()]);
  const [poPiAdvance, setPoPiAdvance] = useState({ advance_currency: "", advance_rate: "", advance_given: "" });
  const [poPiSaving, setPoPiSaving] = useState(false);
  const [selectedPoPiSupplier, setSelectedPoPiSupplier] = useState<Supplier | null>(null);
  const [poPiModels, setPoPiModels] = useState<string[]>([]);
  const [newModelModal, setNewModelModal] = useState(false);
  const [newPoPiModels, setNewPoPiModels] = useState<string[]>([]);
  // Set when the order plan's unit is "containers": tracks how many container
  // rows (total) need PO/PI entries and which one (index, 0-based) is on screen.
  const [containerInfo, setContainerInfo] = useState<{ total: number; index: number } | null>(null);

  async function fetchPlans() {
    const res = await apiFetch(`${API}/api/order-plans/`);
    if (res.ok) setPlans(await res.json());
  }

  useEffect(() => {
    fetchPlans();
    apiFetch(`${API}/api/suppliers/`).then((r) => r.ok ? r.json() : []).then((d) => setSuppliers(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);
  usePolling(fetchPlans, 10_000);

  async function fetchCreateModels(supplierName: string) {
    const match = suppliers.find((s) => s.supplier_name === supplierName);
    if (!match) { setCreateModels([]); return; }
    try {
      const res = await apiFetch(`${API}/api/suppliers/${match.id}/models`);
      const data = res.ok ? await res.json() : [];
      setCreateModels(Array.isArray(data) ? data.map((m: { model_number: string }) => m.model_number) : []);
    } catch { setCreateModels([]); }
  }

  async function fetchPoPiModels(supplier: Supplier) {
    try {
      const res = await apiFetch(`${API}/api/suppliers/${supplier.id}/models`);
      const data = res.ok ? await res.json() : [];
      setPoPiModels(Array.isArray(data) ? data.map((m: { model_number: string }) => m.model_number) : []);
    } catch { setPoPiModels([]); }
  }

  async function handleCreate() {
    if (!form.supplier_name) return;
    setSaving(true);
    const body: Record<string, string> = { supplier_name: form.supplier_name, unit: form.unit };
    if (form.supplier_model_number.trim()) body.supplier_model_number = form.supplier_model_number.trim();
    if (form.unit === "containers") {
      if (form.container_count.trim()) body.container_count = form.container_count.trim();
      if (form.nos_per_container.trim()) body.nos_per_container = form.nos_per_container.trim();
    }
    const qty = computePlannedQty(form);
    if (qty) body.quantity = qty;
    if (form.rate.trim()) body.rate = form.rate.trim();
    if (form.target_date) body.target_date = form.target_date;
    if (form.remark.trim()) body.remark = form.remark.trim();
    const res = await apiFetch(`${API}/api/order-plans/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      const created = await res.json();
      setPlans((p) => [created, ...p]);
      setShowModal(false);
      setForm({ supplier_name: "", supplier_model_number: "", quantity: "", unit: "nos", container_count: "", nos_per_container: "", rate: "", target_date: "", remark: "" });
      setCreateModels([]);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    await apiFetch(`${API}/api/order-plans/${id}`, { method: "DELETE" });
    setPlans((p) => p.filter((x) => x.id !== id));
  }

  function openEditModal(plan: Plan) {
    setEditForm({
      supplier_name: plan.supplier_name ?? "",
      supplier_model_number: plan.supplier_model_number ?? "",
      quantity: plan.quantity ?? "",
      unit: plan.unit === "containers" ? "containers" : "nos",
      container_count: plan.container_count ?? "",
      nos_per_container: plan.nos_per_container ?? "",
      rate: plan.rate ?? "",
      target_date: plan.target_date ?? "",
      remark: plan.remark ?? "",
    });
    setEditModal(plan);
    const match = suppliers.find((s) => s.supplier_name === plan.supplier_name);
    if (match) {
      apiFetch(`${API}/api/suppliers/${match.id}/models`)
        .then((r) => r.ok ? r.json() : [])
        .then((d) => setEditModels(Array.isArray(d) ? d.map((m: { model_number: string }) => m.model_number) : []))
        .catch(() => setEditModels([]));
    } else {
      setEditModels([]);
    }
  }

  async function handleEditSave() {
    if (!editModal || !editForm.supplier_name) return;
    setEditSaving(true);
    const body: Record<string, string> = { supplier_name: editForm.supplier_name, unit: editForm.unit };
    body.supplier_model_number = editForm.supplier_model_number.trim();
    if (editForm.unit === "containers") {
      body.container_count = editForm.container_count.trim();
      body.nos_per_container = editForm.nos_per_container.trim();
    }
    body.quantity = computePlannedQty(editForm);
    body.rate = editForm.rate.trim();
    body.target_date = editForm.target_date;
    body.remark = editForm.remark.trim();
    const res = await apiFetch(`${API}/api/order-plans/${editModal.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      const updated = await res.json();
      setPlans((p) => p.map((x) => x.id === updated.id ? updated : x));
      setEditModal(null);
    }
    setEditSaving(false);
  }

  function basePrefilledItems(plan: Plan): PiItemDraft[] {
    // Each container's own quantity is nos_per_container; for "nos" plans the
    // whole planned quantity carries over as-is.
    const qty = plan.unit === "containers" ? (plan.nos_per_container ?? "") : (plan.quantity ?? "");
    return [{
      model_number: plan.supplier_model_number ?? "",
      quantity: qty,
      rate: plan.rate ?? "",
    }];
  }

  function basePrefilledForm(plan: Plan): PoPiForm {
    const prefilled = emptyPoPiForm();
    prefilled.supplier_name = plan.supplier_name;
    return prefilled;
  }

  function formFromRow(row: Record<string, string | null>): PoPiForm {
    const prefilled = emptyPoPiForm();
    for (const f of PO_PI_DIALOG_FIELDS) prefilled[f] = row[f] ?? "";
    return prefilled;
  }

  async function itemsFromRow(row: Record<string, string | null>): Promise<PiItemDraft[]> {
    const res = await apiFetch(`${API}/api/rows/${row.uid}/items`);
    const data = res.ok ? await res.json() : [];
    if (Array.isArray(data) && data.length > 0) {
      return data.map((it: PiItemDraft) => ({
        model_number: String(it.model_number ?? ""),
        quantity: String(it.quantity ?? ""),
        rate: String(it.rate ?? ""),
      }));
    }
    return [{
      model_number: row.supplier_model_number ?? "",
      quantity: row.pi_quantity ?? "",
      rate: row.pi_rate ?? "",
    }];
  }

  async function openPoPiModal(plan: Plan) {
    if (plan.unit === "containers") {
      const total = parseInt(plan.container_count || "0", 10) || 0;
      const res = await apiFetch(`${API}/api/order-plans/${plan.id}/rows`);
      const existingRows: Record<string, string | null>[] = res.ok ? await res.json() : [];
      if (total > 0 && existingRows.length >= total) {
        alert(`All ${total} containers already have PO/PI rows for this plan.`);
        router.push("/po-pi");
        return;
      }
      const last = existingRows[existingRows.length - 1];
      const prefilled = last ? formFromRow(last) : basePrefilledForm(plan);
      const prefilledItems = last ? await itemsFromRow(last) : basePrefilledItems(plan);
      const match = suppliers.find((s) => s.supplier_name === prefilled.supplier_name) ?? null;
      if (match) { prefilled.supplier_code = match.supplier_code; fetchPoPiModels(match); }
      setSelectedPoPiSupplier(match);
      setContainerInfo({ total, index: existingRows.length });
      setPoPiForm(prefilled);
      setPoPiItems(prefilledItems);
      setPoPiModal(plan);
      return;
    }
    setContainerInfo(null);
    const prefilled = basePrefilledForm(plan);
    const match = suppliers.find((s) => s.supplier_name === plan.supplier_name) ?? null;
    if (match) { prefilled.supplier_code = match.supplier_code; fetchPoPiModels(match); }
    setSelectedPoPiSupplier(match);
    setPoPiForm(prefilled);
    setPoPiItems(basePrefilledItems(plan));
    setPoPiModal(plan);
  }

  function handlePoPiSupplierChange(name: string) {
    const match = suppliers.find((s) => s.supplier_name === name) ?? null;
    setSelectedPoPiSupplier(match);
    if (match) fetchPoPiModels(match); else setPoPiModels([]);
    setPoPiForm((f) => ({ ...f, supplier_name: name, supplier_code: match ? match.supplier_code : f.supplier_code }));
    setPoPiItems((its) => its.map((it) => ({ ...it, model_number: "" })));
  }

  function handlePoPiFieldChange(field: string, value: string) {
    setPoPiForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "currency" && value === "INR") {
        next.exchange_rate = "";
      }
      return next;
    });
  }

  function handleCreatePoPi() {
    const unknown = [...new Set(
      nonEmptyItems(poPiItems).map((it) => it.model_number.trim())
        .filter((m) => !poPiModels.includes(m))
    )];
    if (unknown.length > 0 && selectedPoPiSupplier) {
      setNewPoPiModels(unknown);
      setNewModelModal(true);
      return;
    }
    doCreatePoPi(false);
  }

  async function doCreatePoPi(saveModel: boolean) {
    setPoPiSaving(true);
    if (saveModel && selectedPoPiSupplier && newPoPiModels.length > 0) {
      for (const m of newPoPiModels) {
        await apiFetch(`${API}/api/suppliers/${selectedPoPiSupplier.id}/models`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model_number: m }),
        });
      }
      setPoPiModels((prev) => [...prev, ...newPoPiModels].sort());
    }
    const body: Record<string, string | number | PiItemDraft[]> = { order_plan_id: poPiModal!.id };
    for (const [k, v] of Object.entries(poPiForm)) if (String(v).trim()) body[k] = String(v).trim();
    const sendItems = nonEmptyItems(poPiItems);
    if (sendItems.length > 0) body.items = sendItems;
    if (inrTotal) body.po_total_value = inrTotal;
    if (poPiAdvance.advance_given.trim()) {
      body.advance_given = poPiAdvance.advance_given.trim();
      body.advance_currency = poPiAdvance.advance_currency;
      if (poPiAdvance.advance_rate.trim()) body.advance_rate = poPiAdvance.advance_rate.trim();
      if (advanceInr) body.advance_inr = advanceInr;
    }
    const res = await apiFetch(`${API}/api/rows/`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (res.ok) {
      setNewModelModal(false);
      setNewPoPiModels([]);
      if (containerInfo && containerInfo.index + 1 < containerInfo.total) {
        // more containers to go — carry the current form + items forward as the
        // next page's starting point (per-container tweaks happen from there)
        setContainerInfo({ ...containerInfo, index: containerInfo.index + 1 });
      } else {
        setPoPiModal(null); setPoPiForm(emptyPoPiForm()); setPoPiItems([blankItem()]);
        setPoPiAdvance({ advance_currency: "", advance_rate: "", advance_given: "" });
        setSelectedPoPiSupplier(null); setPoPiModels([]);
        setContainerInfo(null);
        router.push("/po-pi");
      }
    }
    setPoPiSaving(false);
  }

  function closePoPiModal() {
    setPoPiModal(null); setPoPiForm(emptyPoPiForm()); setPoPiItems([blankItem()]);
    setPoPiAdvance({ advance_currency: "", advance_rate: "", advance_given: "" });
    setSelectedPoPiSupplier(null); setPoPiModels([]);
    setContainerInfo(null);
  }

  const poPiTotal = itemsTotalValue(poPiItems);
  const inrTotal = calcPoTotalInr(poPiTotal, poPiForm.currency, poPiForm.exchange_rate);
  const advanceInr = calcPoTotalInr(
    parseFloat(poPiAdvance.advance_given) || 0, poPiAdvance.advance_currency, poPiAdvance.advance_rate
  );

  function handlePoPiAdvanceChange(field: string, value: string) {
    setPoPiAdvance((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "advance_currency" && value === "INR") next.advance_rate = "";
      return next;
    });
  }

  function renderPoPiField(f: string) {
    if (f === "supplier_name") return (
      <select style={inputStyle} value={poPiForm[f]} onChange={(e) => handlePoPiSupplierChange(e.target.value)}>
        <option value="">— select supplier —</option>
        {suppliers.map((s) => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
      </select>
    );
    if (f === "supplier_code") return (
      <select style={inputStyle} value={poPiForm[f]} onChange={(e) => setPoPiForm((fm) => ({ ...fm, supplier_code: e.target.value }))}>
        <option value="">— select code —</option>
        {suppliers.map((s) => <option key={s.id} value={s.supplier_code}>{s.supplier_code}</option>)}
      </select>
    );
    if (f === "currency") return (
      <select style={inputStyle} value={poPiForm.currency} onChange={(e) => handlePoPiFieldChange("currency", e.target.value)}>
        <option value="">— select —</option>
        <option value="USD">USD (US Dollar)</option>
        <option value="INR">INR (Indian Rupee)</option>
        <option value="CNY">CNY (Chinese Yuan)</option>
      </select>
    );
    if (f === "exchange_rate") {
      if (poPiForm.currency === "INR" || !poPiForm.currency) return null;
      return (
        <input type="text" style={inputStyle} placeholder={`Rate: 1 ${poPiForm.currency} = ? INR`}
          value={poPiForm.exchange_rate} onChange={(e) => handlePoPiFieldChange("exchange_rate", e.target.value)} />
      );
    }
    if (f === "credit_time") return (
      <input type="number" min="0" step="1" style={inputStyle} placeholder="Number of days"
        value={poPiForm[f]} onChange={(e) => handlePoPiFieldChange(f, e.target.value)} />
    );
    return (
      <input type={DATE_FIELDS.has(f) ? "date" : MONTH_FIELDS.has(f) ? "month" : "text"} style={inputStyle}
        placeholder={PO_PI_LABELS[f]} value={poPiForm[f]}
        onChange={(e) => handlePoPiFieldChange(f, e.target.value)} />
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "16px", gap: "12px", background: "#fff" }}>
      <div style={{ flexShrink: 0, border: "1px solid #e4e4e7", borderRadius: "12px", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", background: "#fafafa" }}>
        <h1 style={{ fontFamily: "var(--font-serif), Georgia, serif", fontSize: "22px", fontWeight: 400, color: "#09090b", margin: 0, letterSpacing: "-0.02em" }}>Order Planning</h1>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button style={btnStyle("ghost")} onClick={() => exportToExcel(plans, "order-planning", Object.fromEntries(COLS.map(c => [c.key, c.label])))}>↓ Export</button>
          <button style={btnStyle("primary")} onClick={() => setShowModal(true)}>+ New Order Plan</button>
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflow: "auto", border: "1px solid #e4e4e7", borderRadius: "12px" }}>
        <table style={{ borderCollapse: "collapse", width: "100%", minWidth: "max-content" }}>
          <thead className="sticky top-0 z-10">
            <tr>
              <th style={TH}>#</th>
              {COLS.map((c) => <th key={c.key} style={TH}>{c.label}</th>)}
              <th style={{ ...TH, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {plans.length === 0 ? (
              <tr><td colSpan={COLS.length + 2} style={{ ...TD, textAlign: "center", color: "#d4d4d8", padding: "60px" }}>No order plans yet</td></tr>
            ) : plans.map((p, i) => (
              <tr key={p.id}
                onMouseEnter={(e) => (e.currentTarget.style.background = "#fafafa")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "#fff")}>
                <td style={{ ...TD, color: "#a1a1aa", fontFamily: "var(--font-mono), monospace", fontSize: "11px" }}>{String(i + 1).padStart(3, "0")}</td>
                {COLS.map((c) => renderPlanCell(c, p))}
                <td style={{ ...TD, textAlign: "right" }}>
                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                    {isExpert && <button style={btnStyle("action")} onClick={() => openEditModal(p)}>Edit</button>}
                    <button style={btnStyle("action")} onClick={() => openPoPiModal(p)}>Go to PO/PI →</button>
                    <button style={btnStyle("danger")} onClick={() => handleDelete(p.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Order Plan Modal */}
      {showModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) handleCreate(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "460px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>New Order Plan</h2>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Supplier Name *
              <select style={inputStyle} value={form.supplier_name} onChange={(e) => { setForm({ ...form, supplier_name: e.target.value, supplier_model_number: "" }); fetchCreateModels(e.target.value); }}>
                <option value="">— select supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Supplier Model No.
              <input type="text" list="create-model-list" style={inputStyle}
                placeholder={form.supplier_name ? "Type or pick model…" : "Select supplier first"}
                disabled={!form.supplier_name} value={form.supplier_model_number}
                onChange={(e) => setForm({ ...form, supplier_model_number: e.target.value })} />
              <datalist id="create-model-list">{createModels.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Unit
              <div style={{ display: "flex", gap: "6px" }}>
                {(["nos", "containers"] as const).map((u) => (
                  <button key={u} type="button" onClick={() => setForm({ ...form, unit: u })}
                    style={{
                      flex: 1, padding: "7px 10px", borderRadius: "7px", cursor: "pointer",
                      fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", textTransform: "capitalize",
                      border: `1px solid ${form.unit === u ? "#09090b" : "#e4e4e7"}`,
                      background: form.unit === u ? "#09090b" : "#fafafa",
                      color: form.unit === u ? "#fff" : "#52525b",
                    }}>
                    {u}
                  </button>
                ))}
              </div>
            </label>
            {form.unit === "containers" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                    No. of Containers
                    <input type="text" style={inputStyle} placeholder="e.g. 20" value={form.container_count} onChange={(e) => setForm({ ...form, container_count: e.target.value })} />
                  </label>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                    Nos per Container
                    <input type="text" style={inputStyle} placeholder="e.g. 100" value={form.nos_per_container} onChange={(e) => setForm({ ...form, nos_per_container: e.target.value })} />
                  </label>
                </div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Rate
                  <input type="text" style={inputStyle} placeholder="e.g. 250.00" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
                </label>
                <p style={{ margin: 0, fontSize: "12px", color: "#71717a", fontFamily: "var(--font-mono), monospace" }}>
                  Planned Qty: {computePlannedQty(form) || "—"}
                </p>
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Quantity
                  <input type="text" style={inputStyle} placeholder="e.g. 100" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Rate
                  <input type="text" style={inputStyle} placeholder="e.g. 250.00" value={form.rate} onChange={(e) => setForm({ ...form, rate: e.target.value })} />
                </label>
              </div>
            )}
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Target Date
              <input type="date" style={inputStyle} value={form.target_date} onChange={(e) => setForm({ ...form, target_date: e.target.value })} />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Remarks
              <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} placeholder="Optional remarks" value={form.remark} onChange={(e) => setForm({ ...form, remark: e.target.value })} />
            </label>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => { setShowModal(false); setForm({ supplier_name: "", supplier_model_number: "", quantity: "", unit: "nos", container_count: "", nos_per_container: "", rate: "", target_date: "", remark: "" }); setCreateModels([]); }}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleCreate} disabled={saving}>{saving ? "Saving…" : "Create"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Plan Modal (experts only) */}
      {editModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement)) handleEditSave(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "460px", display: "flex", flexDirection: "column", gap: "14px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>Edit Order Plan</h2>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Supplier Name *
              <select style={inputStyle} value={editForm.supplier_name} onChange={(e) => {
                setEditForm({ ...editForm, supplier_name: e.target.value, supplier_model_number: "" });
                const match = suppliers.find((s) => s.supplier_name === e.target.value);
                if (match) {
                  apiFetch(`${API}/api/suppliers/${match.id}/models`)
                    .then((r) => r.ok ? r.json() : [])
                    .then((d) => setEditModels(Array.isArray(d) ? d.map((m: { model_number: string }) => m.model_number) : []))
                    .catch(() => setEditModels([]));
                } else {
                  setEditModels([]);
                }
              }}>
                <option value="">— select supplier —</option>
                {suppliers.map((s) => <option key={s.id} value={s.supplier_name}>{s.supplier_name}</option>)}
              </select>
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Supplier Model No.
              <input type="text" list="edit-model-list" style={inputStyle}
                placeholder={editForm.supplier_name ? "Type or pick model…" : "Select supplier first"}
                disabled={!editForm.supplier_name} value={editForm.supplier_model_number}
                onChange={(e) => setEditForm({ ...editForm, supplier_model_number: e.target.value })} />
              <datalist id="edit-model-list">{editModels.map((m) => <option key={m} value={m} />)}</datalist>
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Unit
              <div style={{ display: "flex", gap: "6px" }}>
                {(["nos", "containers"] as const).map((u) => (
                  <button key={u} type="button" onClick={() => setEditForm({ ...editForm, unit: u })}
                    style={{
                      flex: 1, padding: "7px 10px", borderRadius: "7px", cursor: "pointer",
                      fontSize: "13px", fontFamily: "var(--font-sans), sans-serif", textTransform: "capitalize",
                      border: `1px solid ${editForm.unit === u ? "#09090b" : "#e4e4e7"}`,
                      background: editForm.unit === u ? "#09090b" : "#fafafa",
                      color: editForm.unit === u ? "#fff" : "#52525b",
                    }}>
                    {u}
                  </button>
                ))}
              </div>
            </label>
            {editForm.unit === "containers" ? (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                    No. of Containers
                    <input type="text" style={inputStyle} placeholder="e.g. 20" value={editForm.container_count} onChange={(e) => setEditForm({ ...editForm, container_count: e.target.value })} />
                  </label>
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                    Nos per Container
                    <input type="text" style={inputStyle} placeholder="e.g. 100" value={editForm.nos_per_container} onChange={(e) => setEditForm({ ...editForm, nos_per_container: e.target.value })} />
                  </label>
                </div>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Rate
                  <input type="text" style={inputStyle} placeholder="e.g. 250.00" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })} />
                </label>
                <p style={{ margin: 0, fontSize: "12px", color: "#71717a", fontFamily: "var(--font-mono), monospace" }}>
                  Planned Qty: {computePlannedQty(editForm) || "—"}
                </p>
              </>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Quantity
                  <input type="text" style={inputStyle} placeholder="e.g. 100" value={editForm.quantity} onChange={(e) => setEditForm({ ...editForm, quantity: e.target.value })} />
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Rate
                  <input type="text" style={inputStyle} placeholder="e.g. 250.00" value={editForm.rate} onChange={(e) => setEditForm({ ...editForm, rate: e.target.value })} />
                </label>
              </div>
            )}
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Target Date
              <input type="date" style={inputStyle} value={editForm.target_date} onChange={(e) => setEditForm({ ...editForm, target_date: e.target.value })} />
            </label>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
              Remarks
              <textarea style={{ ...inputStyle, resize: "vertical", minHeight: "60px" }} placeholder="Optional remarks" value={editForm.remark} onChange={(e) => setEditForm({ ...editForm, remark: e.target.value })} />
            </label>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setEditModal(null)}>Cancel</button>
              <button style={btnStyle("primary")} onClick={handleEditSave} disabled={editSaving}>{editSaving ? "Saving…" : "Save Changes"}</button>
            </div>
          </div>
        </div>
      )}

      {/* PO/PI Modal */}
      {poPiModal && !newModelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.3)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}
          onKeyDown={(e) => { if (e.key === "Enter") handleCreatePoPi(); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "580px", maxHeight: "85vh", overflow: "auto", display: "flex", flexDirection: "column", gap: "16px" }}>
            <div>
              <h2 style={{ margin: "0 0 4px", fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>
                {containerInfo ? `Container ${containerInfo.index + 1} of ${containerInfo.total}` : "Add PO / PI Row"}
              </h2>
              <p style={{ margin: 0, fontSize: "12px", color: "#a1a1aa", fontFamily: "var(--font-sans), sans-serif" }}>
                From order plan: <strong style={{ color: "#52525b" }}>{poPiModal.supplier_name}</strong>{poPiModal.target_date ? ` — ${poPiModal.target_date}` : ""}
              </p>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              {PO_PI_DIALOG_FIELDS.map((f) => {
                const rendered = renderPoPiField(f);
                if (rendered === null) return null;
                return (
                  <label key={f} style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", fontFamily: "var(--font-sans), sans-serif", display: "flex", flexDirection: "column", gap: "4px" }}>
                    {PO_PI_LABELS[f]}
                    {rendered}
                  </label>
                );
              })}
            </div>

            <PiItemsEditor items={poPiItems} onChange={setPoPiItems} models={poPiModels}
              datalistId="op-model-list" disabled={!selectedPoPiSupplier && suppliers.length > 0} />

            {/* PI total + INR total display */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                PI Total ({poPiForm.currency || "orig. currency"}) — auto
                <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={poPiTotal ? poPiTotal.toFixed(2) : ""} readOnly placeholder="Auto-calculated" />
              </label>
              {poPiForm.currency !== "INR" && (
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
                  <select style={inputStyle} value={poPiAdvance.advance_currency} onChange={(e) => handlePoPiAdvanceChange("advance_currency", e.target.value)}>
                    <option value="">— select —</option>
                    <option value="USD">USD (US Dollar)</option>
                    <option value="INR">INR (Indian Rupee)</option>
                    <option value="CNY">CNY (Chinese Yuan)</option>
                  </select>
                </label>
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Advance Given (orig.)
                  <input type="text" style={inputStyle} placeholder="Advance amount" value={poPiAdvance.advance_given} onChange={(e) => handlePoPiAdvanceChange("advance_given", e.target.value)} />
                </label>
                {poPiAdvance.advance_currency && poPiAdvance.advance_currency !== "INR" && (
                  <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                    Advance Rate (1 {poPiAdvance.advance_currency} = ? INR)
                    <input type="text" style={inputStyle} value={poPiAdvance.advance_rate} onChange={(e) => handlePoPiAdvanceChange("advance_rate", e.target.value)} />
                  </label>
                )}
                <label style={{ fontSize: "12px", fontWeight: 600, color: "#52525b", display: "flex", flexDirection: "column", gap: "4px" }}>
                  Advance (INR) — auto
                  <input type="text" style={{ ...inputStyle, background: "#f0f0f0", color: "#52525b" }} value={advanceInr} readOnly placeholder="Auto-calculated" />
                </label>
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={closePoPiModal}>{containerInfo ? "Finish Later" : "Cancel"}</button>
              <button style={btnStyle("primary")} onClick={handleCreatePoPi} disabled={poPiSaving}>
                {poPiSaving ? "Saving…" : containerInfo
                  ? (containerInfo.index + 1 < containerInfo.total ? "Save & Next →" : "Save & Finish")
                  : "Create & Go to PO/PI →"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New model confirm dialog */}
      {newModelModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 60, display: "flex", alignItems: "center", justifyContent: "center" }}
          onKeyDown={(e) => { if (e.key === "Enter") doCreatePoPi(true); }}>
          <div style={{ background: "#fff", borderRadius: "14px", border: "1px solid #e4e4e7", padding: "28px", width: "400px", display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0, fontFamily: "var(--font-serif), Georgia, serif", fontSize: "18px", fontWeight: 400, color: "#09090b" }}>New model number{newPoPiModels.length > 1 ? "s" : ""}</h2>
            <p style={{ margin: 0, fontSize: "14px", fontFamily: "var(--font-sans), sans-serif", color: "#52525b", lineHeight: 1.5 }}>
              {newPoPiModels.map((m, i) => (
                <span key={m}>
                  {i > 0 && ", "}
                  <strong style={{ fontFamily: "var(--font-mono), monospace", background: "#f4f4f5", padding: "1px 6px", borderRadius: "4px" }}>{m}</strong>
                </span>
              ))}{" "}
              {newPoPiModels.length > 1 ? "are" : "is"} not in <strong>{selectedPoPiSupplier?.supplier_name}</strong>'s model list. Save {newPoPiModels.length > 1 ? "them" : "it"}?
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button style={btnStyle("ghost")} onClick={() => setNewModelModal(false)}>Cancel</button>
              <button style={btnStyle("action")} onClick={() => doCreatePoPi(false)} disabled={poPiSaving}>Create without saving</button>
              <button style={btnStyle("primary")} onClick={() => doCreatePoPi(true)} disabled={poPiSaving}>{poPiSaving ? "Saving…" : "Save & Create"}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
