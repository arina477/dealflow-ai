/**
 * CSV serializer for the recordkeeping export (SEC-5).
 *
 * Two-layer injection-safe escaping (SEC-5, load-bearing):
 *   Layer 1 — spreadsheet-injection prefix:
 *     Any cell whose first character is `=`, `+`, `-`, `@`, TAB (0x09),
 *     CR (0x0D), or LF (0x0A) is prefixed with a single-quote (') so the
 *     cell is treated as a plain string by every spreadsheet application
 *     (Excel / LibreOffice / Google Sheets).
 *   Layer 2 — RFC-4180 field quoting:
 *     Every cell is wrapped in double-quotes. Internal double-quotes are
 *     doubled (""). Internal CR/LF are preserved inside double-quotes per
 *     RFC-4180 (multi-line cell).
 *
 * Both layers together are required — Layer 1 alone is defeated by spreadsheet
 * auto-strip; Layer 2 alone does not neutralise the leading formula character.
 *
 * Output line ending: CRLF (RFC-4180 §2).
 */

/** Characters that trigger the injection-prefix (Layer 1). */
const INJECTION_FIRST_CHARS = new Set(['=', '+', '-', '@']);
const TAB = '\t'; // 0x09
const CR = '\r'; // 0x0D
const LF = '\n'; // 0x0A

/**
 * Escape a single cell value for safe CSV inclusion (SEC-5).
 *
 * 1. Coerce to string.
 * 2. If the first character is a formula trigger (= + - @) or a control
 *    character (TAB / CR / LF), prefix a single-quote.
 * 3. Double all internal double-quotes.
 * 4. Wrap the whole value in double-quotes (RFC-4180 field quoting).
 */
export function escapeCsvCell(value: unknown): string {
  const str = value === null || value === undefined ? '' : String(value);

  // Layer 1: injection-prefix check on the FIRST character of the raw string.
  const firstChar = str[0] ?? '';
  const needsPrefix =
    INJECTION_FIRST_CHARS.has(firstChar) ||
    firstChar === TAB ||
    firstChar === CR ||
    firstChar === LF;

  const prefixed = needsPrefix ? `'${str}` : str;

  // Layer 2: RFC-4180 — double internal double-quotes and wrap in double-quotes.
  const escaped = prefixed.replace(/"/g, '""');
  return `"${escaped}"`;
}

/**
 * Serialize a 2-D array of rows into RFC-4180 CSV text.
 *
 * @param headers - Column header names (first row, also injection-escaped).
 * @param rows    - Data rows; each entry may be any scalar value.
 * @returns       A string with CRLF line endings (RFC-4180 §2).
 */
export function serializeToCsv(headers: string[], rows: Array<Array<unknown>>): string {
  const lines: string[] = [];

  // Header row
  lines.push(headers.map(escapeCsvCell).join(','));

  // Data rows
  for (const row of rows) {
    lines.push(row.map(escapeCsvCell).join(','));
  }

  return lines.join('\r\n');
}
