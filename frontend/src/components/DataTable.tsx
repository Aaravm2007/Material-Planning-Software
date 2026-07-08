"use client";

export type Row = Record<string, string | null> & { id: number };

export const COLUMNS: { key: string; label: string }[] = [
  { key: "workflow_status",               label: "Stage"                    },
  // PO / PI
  { key: "srno",                          label: "Sr No"                    },
  { key: "date_of_po",                    label: "Date of PO"               },
  { key: "supplier_name",                 label: "Supplier Name"            },
  { key: "rocket_item_code",              label: "Rocket Item Code"         },
  { key: "supplier_code",                 label: "Supplier Code"            },
  { key: "po_number",                     label: "PO Number"                },
  { key: "po_quantity",                   label: "PO Quantity"              },
  { key: "po_rate",                       label: "PO Rate"                  },
  { key: "pi_number",                     label: "PI Number"                },
  { key: "pi_date",                       label: "PI Date"                  },
  { key: "supplier_model_number",         label: "Supplier Model No"        },
  { key: "pi_quantity",                   label: "PI Quantity"              },
  { key: "pi_rate",                       label: "PI Rate"                  },
  { key: "currency",                      label: "Currency"                 },
  { key: "exchange_rate",                 label: "Exchange Rate"            },
  { key: "pi_total_value",               label: "PI Total Value"           },
  { key: "po_total_value",               label: "Total (INR)"              },
  { key: "tentative_exworks_at_po_time",  label: "Tentative Ex-Works"       },
  { key: "confirmed_exworks",             label: "Confirmed Ex-Works"       },
  { key: "credit_time",                   label: "Credit Time"              },
  { key: "advance_currency",              label: "Advance Currency"         },
  { key: "advance_rate",                  label: "Advance Rate"             },
  { key: "advance_given",                 label: "Advance Given (orig.)"    },
  { key: "advance_inr",                   label: "Advance (INR)"            },
  // Freight Planning
  { key: "etd",                           label: "ETD"                      },
  { key: "port",                          label: "Port"                     },
  { key: "shipment_status",               label: "Shipment Status"          },
  { key: "shipping_company",              label: "Shipping Company"         },
  { key: "estimated_destination_charges", label: "Est. Destination Charges" },
  { key: "freight_charges",               label: "Freight Charges"          },
  { key: "bl_no",                         label: "BL No"                    },
  { key: "bl_date",                       label: "BL Date"                  },
  { key: "insurance",                     label: "Insurance"                },
  { key: "estimated_eta",                 label: "Estimated ETA"            },
  { key: "confirmed_eta",                 label: "Confirmed ETA"            },
  { key: "inbond",                        label: "Inbond (Y/N)"             },
  { key: "home_consumption",              label: "Home Consumption (Y/N)"   },
  // BOE
  { key: "boe_no",                        label: "BOE No"                   },
  { key: "customs_rate",                  label: "Customs Rate (%)"         },
  { key: "provisional_boe",              label: "Provisional BOE"          },
  { key: "actual_boe",                    label: "Actual BOE"               },
  { key: "actual_boe_inr",                label: "Actual BOE (INR)"         },
  // Transportation
  { key: "sap_inward_no",                 label: "SAP Inward No"            },
  { key: "cha_name",                      label: "CHA Name"                 },
  { key: "cha_charges",                   label: "CHA Charges"              },
  { key: "other_charges",                 label: "Other Charges"            },
  { key: "confirmed_destination_charges", label: "Conf. Dest. Charges"      },
  { key: "transportation_inbound",        label: "Transport Inbound"        },
  { key: "transportation_outbound_home",  label: "Transport Outbound/Home"  },
  { key: "total_transport",               label: "Total Transport"          },
  { key: "landing_cost",                  label: "Landing Cost"             },
  // Due Date
  { key: "estimated_due_date",            label: "Completed Due Date"       },
  { key: "hedged",                        label: "Hedged (Y/N)"             },
  { key: "confirmed_payment_amt",         label: "Confirmed Payment Amt"    },
  { key: "confirmed_payment_exchange",    label: "Payment Exchange Rate"    },
];

const MONO_KEYS = new Set([
  "srno", "po_quantity", "po_rate", "po_total_value",
  "pi_quantity", "pi_rate", "pi_total_value", "exchange_rate", "credit_time",
  "estimated_destination_charges", "freight_charges",
  "customs_rate", "provisional_boe", "actual_boe", "actual_boe_inr",
  "transportation_inbound", "transportation_outbound_home",
  "cha_charges", "other_charges", "confirmed_destination_charges", "total_transport",
  "confirmed_payment_amt", "confirmed_payment_exchange", "landing_cost",
  "advance_rate", "advance_given", "advance_inr",
]);

const YN_KEYS = new Set(["inbond", "home_consumption", "hedged"]);

const MONEY_DISPLAY_KEYS = new Set([
  "po_rate", "po_total_value", "pi_rate", "pi_total_value", "exchange_rate",
  "estimated_destination_charges", "freight_charges", "insurance",
  "customs_rate", "provisional_boe", "actual_boe", "actual_boe_inr",
  "transportation_inbound", "transportation_outbound_home",
  "cha_charges", "other_charges", "confirmed_destination_charges", "total_transport",
  "confirmed_payment_amt", "confirmed_payment_exchange", "landing_cost",
  "advance_rate", "advance_given", "advance_inr",
]);

function fmtAmount(val: string | null, currency?: string | null): string | null {
  if (!val) return null;
  const num = parseFloat(String(val).replace(/,/g, ""));
  if (isNaN(num)) return val;
  const locale = currency === "USD" || currency === "CNY" ? "en-US" : "en-IN";
  return num.toLocaleString(locale, { maximumFractionDigits: 2 });
}

// Columns that carry their own currency (not always INR) — looked up from a sibling column
const CCY_FOR_KEY: Record<string, string> = {
  pi_rate: "currency",
  pi_total_value: "currency",
};

const STAGE_LABELS: Record<string, string> = {
  po_pi:           "PO / PI",
  pending_import:  "Freight (pending)",
  approved_import: "Freight",
  boe:             "BOE",
  transportation:  "Transport",
  due_date:        "Due Date",
  complete:        "Complete",
};

const STAGE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  po_pi:           { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" },
  pending_import:  { bg: "#fefce8", color: "#92400e", border: "#fde68a" },
  approved_import: { bg: "#f0fdf4", color: "#166534", border: "#bbf7d0" },
  boe:             { bg: "#faf5ff", color: "#6b21a8", border: "#e9d5ff" },
  transportation:  { bg: "#fff7ed", color: "#9a3412", border: "#fed7aa" },
  due_date:        { bg: "#fff1f2", color: "#9f1239", border: "#fecdd3" },
  complete:        { bg: "#f0fdf4", color: "#14532d", border: "#86efac" },
};

function YNBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#d4d4d8", fontFamily: "monospace" }}>—</span>;
  const yes = value.trim().toUpperCase() === "Y";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      width: "28px", height: "18px",
      border: `1px solid ${yes ? "#09090b" : "#d4d4d8"}`,
      borderRadius: "6px", fontSize: "10px",
      fontFamily: "var(--font-mono), monospace", fontWeight: 600,
      textTransform: "uppercase",
      color: yes ? "#ffffff" : "#a1a1aa",
      background: yes ? "#09090b" : "transparent",
    }}>
      {yes ? "Y" : "N"}
    </span>
  );
}

function StageBadge({ value }: { value: string | null }) {
  if (!value) return <span style={{ color: "#d4d4d8" }}>—</span>;
  const { bg, color, border } = STAGE_COLORS[value] ?? { bg: "#f4f4f5", color: "#52525b", border: "#e4e4e7" };
  return (
    <span style={{
      display: "inline-block", padding: "2px 9px", borderRadius: "6px",
      border: `1px solid ${border}`, background: bg,
      fontSize: "11px", fontFamily: "var(--font-mono), monospace",
      color, whiteSpace: "nowrap", fontWeight: 500,
    }}>
      {STAGE_LABELS[value] ?? value}
    </span>
  );
}

import { SortState, ColDef, FilterValue } from "./useTableState";
import InlineFilters from "./InlineFilters";

interface DataTableProps {
  rows: Row[];
  onReopen?: (uid: string) => void;
  onEdit?: (uid: string) => void;
  sort?: SortState | null;
  onSort?: (key: string) => void;
  colDefs?: ColDef[];
  filters?: Record<string, FilterValue>;
  distinctValues?: Record<string, string[]>;
  onFilter?: (key: string, value: FilterValue | null) => void;
  columns?: { key: string; label: string }[];
}

export default function DataTable({ rows, onReopen, onEdit, sort, onSort, colDefs, filters, distinctValues, onFilter, columns = COLUMNS }: DataTableProps) {
  const hasFilters = !!(colDefs && filters && distinctValues && onFilter);
  return (
    <div className="w-full h-full overflow-auto" style={{ background: "#ffffff" }}>
      <table className="border-collapse" style={{ minWidth: "max-content", width: "100%" }}>
        <thead className="sticky top-0 z-20">
          <tr style={{ background: "#fafafa", borderBottom: "1px solid #e4e4e7" }}>
            <th className="sticky left-0 z-30 px-4 py-3 text-left whitespace-nowrap"
              style={{ background: "#fafafa", borderRight: "1px solid #e4e4e7", borderBottom: "1px solid #e4e4e7", borderTopLeftRadius: "11px", fontFamily: "var(--font-mono), monospace", fontSize: "13px", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", color: "#09090b", minWidth: "52px" }}>
              #
            </th>
            {columns.map((col) => {
              const isSorted = sort?.key === col.key;
              return (
                <th key={col.key} className="px-4 py-3 text-left whitespace-nowrap"
                  onClick={() => onSort?.(col.key)}
                  style={{ background: "#fafafa", borderRight: "1px solid #e4e4e7", borderBottom: "1px solid #e4e4e7", fontFamily: "var(--font-sans), sans-serif", fontSize: "13px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b", cursor: onSort ? "pointer" : undefined, userSelect: "none" }}>
                  {col.label}
                  {onSort && (
                    <span style={{ marginLeft: "5px", fontSize: "10px", display: "inline-flex", flexDirection: "column", lineHeight: "10px", verticalAlign: "middle", gap: "1px" }}>
                      <span style={{ color: isSorted && sort?.dir === "asc" ? "#09090b" : "#d4d4d8" }}>▲</span>
                      <span style={{ color: isSorted && sort?.dir === "desc" ? "#09090b" : "#d4d4d8" }}>▼</span>
                    </span>
                  )}
                </th>
              );
            })}
            {(onReopen || onEdit) && <th className="px-4 py-3 text-right whitespace-nowrap" style={{ background: "#fafafa", borderRight: "1px solid #e4e4e7", borderBottom: "1px solid #e4e4e7", fontFamily: "var(--font-sans), sans-serif", fontSize: "13px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", color: "#09090b" }}>Actions</th>}
          </tr>
          {hasFilters && (
            <InlineFilters
              colDefs={colDefs!} filters={filters!} distinctValues={distinctValues!} onFilter={onFilter!}
              leadingCells={1} trailingCells={(onReopen || onEdit) ? 1 : 0}
              baseThStyle={{ position: "sticky" }}
            />
          )}
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + 1} className="py-20 text-center"
                style={{ background: "#ffffff", fontFamily: "var(--font-mono), monospace", fontSize: "14px", letterSpacing: "0.2em", textTransform: "uppercase", color: "#d4d4d8" }}>
                No records
              </td>
            </tr>
          ) : (
            rows.map((row, idx) => (
              <tr key={row.id} className="group transition-colors duration-150"
                style={{ borderBottom: "1px solid #f4f4f5" }}>
                <td className="sticky left-0 z-10 px-4 py-3 whitespace-nowrap group-hover:bg-zinc-50"
                  style={{ background: "#ffffff", borderRight: "1px solid #e4e4e7", fontFamily: "var(--font-mono), monospace", fontSize: "14px", color: "#a1a1aa", minWidth: "52px" }}>
                  {String(idx + 1).padStart(3, "0")}
                </td>
                {columns.map((col) => {
                  const val = row[col.key];
                  const isMono = MONO_KEYS.has(col.key);
                  const isYN = YN_KEYS.has(col.key);
                  const isStage = col.key === "workflow_status";
                  const ccy = CCY_FOR_KEY[col.key] ? row[CCY_FOR_KEY[col.key]] : null;
                  const displayVal = MONEY_DISPLAY_KEYS.has(col.key) ? fmtAmount(val, ccy) : val;
                  return (
                    <td key={col.key} className="px-4 py-3 whitespace-nowrap group-hover:bg-zinc-50 transition-colors duration-150"
                      style={{ borderRight: "1px solid #f4f4f5", fontFamily: isMono ? "var(--font-mono), monospace" : "var(--font-sans), sans-serif", fontSize: "14px", color: val ? "#09090b" : "#d4d4d8" }}>
                      {isYN ? <YNBadge value={val} /> : isStage ? <StageBadge value={val} /> : displayVal ? displayVal : <span style={{ color: "#e4e4e7" }}>—</span>}
                    </td>
                  );
                })}
                {(onReopen || onEdit) && (
                  <td className="px-4 py-3 whitespace-nowrap group-hover:bg-zinc-50 transition-colors duration-150" style={{ borderRight: "1px solid #f4f4f5", textAlign: "right" }}>
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {onEdit && (
                        <button onClick={() => onEdit(String(row["uid"]))}
                          style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #e4e4e7", background: "transparent", color: "#71717a", whiteSpace: "nowrap" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#71717a"; }}>
                          Edit
                        </button>
                      )}
                      {onReopen && row["workflow_status"] === "complete" && (
                        <button onClick={() => onReopen(String(row["uid"]))}
                          style={{ padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600, fontFamily: "var(--font-sans), sans-serif", cursor: "pointer", border: "1px solid #e4e4e7", background: "transparent", color: "#71717a", whiteSpace: "nowrap" }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "#f4f4f5"; (e.currentTarget as HTMLElement).style.color = "#09090b"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "#71717a"; }}>
                          ↩ Reopen
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
