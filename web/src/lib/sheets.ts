import * as XLSX from 'xlsx';
import type { Sheet } from '../db/db';

/** Çok büyük tablolarda tarayıcı donmasın. Fazlası okunmaz, kullanıcıya söylenir. */
export const MAX_ROWS = 5000;
export const MAX_COLS = 200;

/**
 * xlsx/csv → düzenlenebilir tablolar. Formüller "=TOPLA(...)" biçiminde korunur
 * (SheetJS'te formüller İngilizce: "=SUM(A1:A3)"), diğer hücreler görünen biçimiyle okunur.
 */
export function readSheets(data: ArrayBuffer, kind: 'xlsx' | 'csv'): { sheets: Sheet[]; truncated: boolean } {
    const wb = kind === 'csv'
        ? XLSX.read(new TextDecoder().decode(data), { type: 'string', raw: true })
        : XLSX.read(data, { type: 'array', cellFormula: true, cellDates: true });
    let truncated = false;
    const sheets = wb.SheetNames.map((name) => {
        const ws = wb.Sheets[name];
        const ref = ws['!ref'];
        if (!ref) return { name, rows: [['']] };
        const range = XLSX.utils.decode_range(ref);
        const lastRow = Math.min(range.e.r, MAX_ROWS - 1);
        const lastCol = Math.min(range.e.c, MAX_COLS - 1);
        if (lastRow < range.e.r || lastCol < range.e.c) truncated = true;
        const rows: string[][] = [];
        for (let r = 0; r <= lastRow; r++) {
            const row: string[] = [];
            for (let c = 0; c <= lastCol; c++) {
                const cell = ws[XLSX.utils.encode_cell({ r, c })] as XLSX.CellObject | undefined;
                if (!cell) row.push('');
                else if (cell.f) row.push(`=${cell.f}`);
                else row.push(cell.w ?? (cell.v == null ? '' : String(cell.v)));
            }
            rows.push(row);
        }
        return { name, rows };
    });
    return { sheets, truncated };
}

const NUMERIC = /^-?\d+([.,]\d+)?$/;

function toWorksheet(rows: string[][]): XLSX.WorkSheet {
    const aoa = rows.map((row) =>
        row.map((v) => {
            if (v.startsWith('=')) return null; // aşağıda formül olarak yazılır
            if (NUMERIC.test(v)) return Number(v.replace(',', '.'));
            return v;
        }),
    );
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    rows.forEach((row, r) =>
        row.forEach((v, c) => {
            if (v.startsWith('=')) ws[XLSX.utils.encode_cell({ r, c })] = { t: 'n', f: v.slice(1) };
        }),
    );
    // aoa_to_sheet null hücreleri aralığa katmayabilir; aralığı tüm tabloya yay.
    const cols = Math.max(1, ...rows.map((r) => r.length));
    ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: Math.max(0, rows.length - 1), c: cols - 1 } });
    return ws;
}

export function sheetsToXlsx(sheets: Sheet[]): Blob {
    const wb = XLSX.utils.book_new();
    sheets.forEach((s, i) => XLSX.utils.book_append_sheet(wb, toWorksheet(s.rows), s.name || `Sayfa${i + 1}`));
    const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    return new Blob([out], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

export function sheetToCsv(sheet: Sheet): string {
    return XLSX.utils.sheet_to_csv(toWorksheet(sheet.rows));
}

/** Sütun adı: 0 → A, 25 → Z, 26 → AA */
export function colName(c: number): string {
    return XLSX.utils.encode_col(c);
}
