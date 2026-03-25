function parseNumericCell(val: unknown): number {
  if (val === undefined || val === null) return NaN;
  const s = String(val).trim();
  if (s === '' || s.toLowerCase() === 'na' || s.toLowerCase() === 'n/a') return NaN;
  const n = Number(s);
  return typeof n === 'number' && isFinite(n) ? n : NaN;
}

function getHeaders(rows: Record<string, string>[]): string[] {
  if (!rows.length) return [];
  return Object.keys(rows[0]);
}

// Detect numeric columns: all columns except the geographic key (first column).
export function extractNumericColumns(
  rows: Record<string, string>[],
  geoColumnIndex: number = 0
): string[] {
  if (!rows.length) return [];

  const headers = getHeaders(rows);
  if (geoColumnIndex < 0 || geoColumnIndex >= headers.length) return [];

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


 // Wide format = one geo column + more than two numeric columns.
export function isWideFormat(rows: Record<string, string>[], geoColumnIndex: number = 0): boolean {
  return extractNumericColumns(rows, geoColumnIndex).length > 2;
}

const NUMERIC_THRESHOLD = 0.7;
 // For district mode:first geoCount columns (state, district).
 // Remaining columns: numeric if ≥70% of rows have finite numeric values.
export function extractNumericColumnsDistricts(
  rows: Record<string, string>[],
  geoCount: number = 2
): string[] {
  if (!rows.length) return [];
  const headers = getHeaders(rows);
  if (headers.length <= geoCount) return [];
  const valueHeaders = headers.slice(geoCount);
  const numericColumns: string[] = [];
  const n = rows.length;
  for (const col of valueHeaders) {
    let count = 0;
    for (const row of rows) {
      const v = parseNumericCell(row[col]);
      if (!isNaN(v)) count++;
    }
    if (count >= NUMERIC_THRESHOLD * n) {
      numericColumns.push(col);
    }
  }
  return numericColumns;
}
export function getDimensionColumnDistricts(
  rows: Record<string, string>[],
  geoCount: number = 2
): string | null {
  if (!rows.length) return null;
  const headers = getHeaders(rows);
  if (headers.length <= geoCount) return null;
  const valueHeaders = headers.slice(geoCount);
  const numericCols = extractNumericColumnsDistricts(rows, geoCount);
  const otherCols = valueHeaders.filter((c) => !numericCols.includes(c));
  if (otherCols.length === 1) return otherCols[0];
  const dimensionLike = valueHeaders.find((h) => /year|time|date/i.test(h));
  return dimensionLike ?? null;
}

export function getLongFormatDimensionValuePair(
  rows: Record<string, string>[],
  numericColumns: string[],
  geoCount: number = 2
): [string, string] | null {
  if (numericColumns.length !== 2 || !rows.length) return null;
  const [a, b] = numericColumns;
  const nameA = /year|time|date/i.test(a);
  const nameB = /year|time|date/i.test(b);
  const uniques = (col: string) => {
    const set = new Set<string>();
    rows.forEach((r) => set.add(String(r[col] ?? '').trim()));
    return set.size;
  };
  const looksLikeYear = (col: string): boolean => {
    let count = 0;
    let allInRange = true;
    for (const row of rows) {
      const v = parseNumericCell(row[col]);
      if (!isNaN(v)) {
        count++;
        if (v < 1990 || v > 2040 || !Number.isInteger(v)) allInRange = false;
      }
    }
    return count >= NUMERIC_THRESHOLD * rows.length && allInRange && uniques(col) <= 50;
  };
  if (nameA && looksLikeYear(a)) return [a, b];
  if (nameB && looksLikeYear(b)) return [b, a];
  if (looksLikeYear(a) && !looksLikeYear(b)) return [a, b];
  if (looksLikeYear(b) && !looksLikeYear(a)) return [b, a];
  return null;
}
