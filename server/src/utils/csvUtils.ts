
export interface CSVRow {
  [key: string]: string | number;
}
function parseNumericCell(val: unknown): number {
  if (val === undefined || val === null) return NaN;
  const s = String(val).trim();
  if (s === '' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a') return NaN;
  const n = Number(s);
  return typeof n === 'number' && isFinite(n) ? n : NaN;
}

export function extractNumericColumns(
  rows: CSVRow[],
  geoColumnIndex: number = 0
): string[] {
  if (!rows.length) return [];

  const headers = Object.keys(rows[0]);
  if (geoColumnIndex < 0 || geoColumnIndex >= headers.length) return [];

  const geoKey = headers[geoColumnIndex];
  const otherHeaders = headers.filter((_, i) => i !== geoColumnIndex);
  const numericColumns: string[] = [];

  for (const col of otherHeaders) {
    const hasNumeric = rows.some((row) => {
      const v = parseNumericCell(row[col]);
      return !isNaN(v);
    });
    if (hasNumeric) {
      numericColumns.push(col);
    }
  }

  return numericColumns;
}

// Check if parsed data is in "wide" format: one geo column + more than two numeric columns. 
export function isWideFormat(rows: CSVRow[], geoColumnIndex: number = 0): boolean {
  const numeric = extractNumericColumns(rows, geoColumnIndex);
  return numeric.length > 2;
}
