import * as XLSX from "xlsx";

export function exportToExcel(
  data: unknown[],
  filename: string,
  columnMap?: Record<string, string> // { key: "Human Label" }
) {
  if (!data.length) return;

  let rows: Record<string, unknown>[];
  if (columnMap) {
    rows = (data as Record<string, unknown>[]).map((row) =>
      Object.fromEntries(
        Object.entries(columnMap).map(([key, label]) => [label, row[key] ?? ""])
      )
    );
  } else {
    rows = data as Record<string, unknown>[];
  }

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Data");
  XLSX.writeFile(wb, `${filename}.xlsx`);
}
