import { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, Scissors, Trash } from '@phosphor-icons/react';
import { MARKERS, type Marker, type Sheet, type StoredFile } from '../../db/db';
import { saveFile } from '../../db/files';
import { colName } from '../../lib/sheets';

const SAVE_DELAY = 600;
const ROW_STEP = 300;

interface Sel {
    r0: number;
    c0: number;
    r1: number;
    c1: number;
}
const box = (s: Sel) => ({
    top: Math.min(s.r0, s.r1),
    bottom: Math.max(s.r0, s.r1),
    left: Math.min(s.c0, s.c1),
    right: Math.max(s.c0, s.c1),
});

/** Kaydederken sondaki tamamen boş satır ve sütunları at. */
function trim(rows: string[][]): string[][] {
    let lastRow = rows.length - 1;
    while (lastRow > 0 && rows[lastRow].every((v) => !v)) lastRow--;
    const kept = rows.slice(0, lastRow + 1);
    const lastCol = Math.max(0, ...kept.map((r) => r.reduce((m, v, i) => (v ? i : m), -1)));
    return kept.map((r) => Array.from({ length: lastCol + 1 }, (_, i) => r[i] ?? ''));
}

/**
 * Excel / CSV: hücre tablosu. Formüller "=..." olarak korunur ve dosya
 * Excel'de açılınca hesaplanır; burada hesaplanmaz.
 */
export function SheetView({
    file,
    onCutText,
    setSaved,
}: {
    file: StoredFile;
    onCutText: (text: string, color: Marker, context: string) => unknown;
    setSaved: (saved: boolean) => void;
}) {
    const [sheets, setSheets] = useState<Sheet[]>(() =>
        file.sheets?.length ? file.sheets : [{ name: 'Sayfa1', rows: [['']] }],
    );
    const [active, setActive] = useState(0);
    const [sel, setSel] = useState<Sel>({ r0: 0, c0: 0, r1: 0, c1: 0 });
    const [edit, setEdit] = useState<{ r: number; c: number; value: string } | null>(null);
    const [limit, setLimit] = useState(ROW_STEP);
    const grid = useRef<HTMLDivElement>(null);
    const dragging = useRef(false);

    const sheet = sheets[active] ?? sheets[0];
    const rows = sheet.rows;
    const dataCols = Math.max(1, ...rows.map((r) => r.length));
    const nCols = Math.max(dataCols + 2, 10);
    const nRows = Math.min(Math.max(rows.length + 5, 30), limit);
    const b = box(sel);
    const get = (r: number, c: number) => rows[r]?.[c] ?? '';

    // ── Kaydetme ───────────────────────────────────────────────────────
    const timer = useRef<number>(undefined);
    const latest = useRef(sheets);
    const dirty = useRef(false);
    const flush = useRef(async () => {
        window.clearTimeout(timer.current);
        if (!dirty.current) return;
        dirty.current = false;
        const clean = latest.current.map((s) => ({ name: s.name, rows: trim(s.rows) }));
        await saveFile(file.id, { sheets: clean, plain: clean.flatMap((s) => s.rows.flat()).join(' ').slice(0, 20000) });
    }).current;
    useEffect(() => () => void flush(), [flush]);

    const commitSheets = (next: Sheet[]) => {
        latest.current = next;
        dirty.current = true;
        setSheets(next);
        setSaved(false);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void flush().then(() => setSaved(true)), SAVE_DELAY);
    };

    const mutateRows = (fn: (rows: string[][]) => string[][]) => {
        const next = sheets.map((s, i) => (i === active ? { ...s, rows: fn(s.rows.map((r) => [...r])) } : s));
        commitSheets(next);
    };

    const writeCells = (r0: number, c0: number, block: string[][]) =>
        mutateRows((rs) => {
            block.forEach((line, dr) =>
                line.forEach((v, dc) => {
                    const r = r0 + dr;
                    const c = c0 + dc;
                    while (rs.length <= r) rs.push([]);
                    while (rs[r].length <= c) rs[r].push('');
                    rs[r][c] = v;
                }),
            );
            return rs;
        });

    // ── Seçim ve düzenleme ─────────────────────────────────────────────
    const focusGrid = () => grid.current?.focus({ preventScroll: true });
    const move = (dr: number, dc: number, extend = false) => {
        setSel((s) => {
            const r = Math.max(0, Math.min(nRows - 1, s.r1 + dr));
            const c = Math.max(0, Math.min(nCols - 1, s.c1 + dc));
            return extend ? { ...s, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c };
        });
    };
    const startEdit = (value?: string) => setEdit({ r: sel.r1, c: sel.c1, value: value ?? get(sel.r1, sel.c1) });
    const commitEdit = (dr = 0, dc = 0) => {
        if (!edit) return;
        if (edit.value !== get(edit.r, edit.c)) writeCells(edit.r, edit.c, [[edit.value]]);
        setEdit(null);
        move(dr, dc);
        focusGrid();
    };

    useEffect(() => {
        const up = () => (dragging.current = false);
        document.addEventListener('mouseup', up);
        return () => document.removeEventListener('mouseup', up);
    }, []);

    const rangeText = (sep: string) => {
        const lines: string[] = [];
        for (let r = b.top; r <= b.bottom; r++) {
            const cells = [];
            for (let c = b.left; c <= b.right; c++) cells.push(get(r, c));
            lines.push(cells.join(sep));
        }
        return lines;
    };

    const onKeyDown = (e: React.KeyboardEvent) => {
        if (edit) return;
        const k = e.key;
        const mod = e.ctrlKey || e.metaKey;
        if (k.startsWith('Arrow')) {
            e.preventDefault();
            const d = { ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1] }[k]!;
            move(d[0], d[1], e.shiftKey);
        } else if (k === 'Enter' || k === 'F2') {
            e.preventDefault();
            startEdit();
        } else if (k === 'Tab') {
            e.preventDefault();
            move(0, e.shiftKey ? -1 : 1);
        } else if (k === 'Delete' || k === 'Backspace') {
            e.preventDefault();
            const blank = Array.from({ length: b.bottom - b.top + 1 }, () => Array<string>(b.right - b.left + 1).fill(''));
            writeCells(b.top, b.left, blank);
        } else if (mod && k.toLowerCase() === 'a') {
            e.preventDefault();
            setSel({ r0: 0, c0: 0, r1: Math.max(0, rows.length - 1), c1: dataCols - 1 });
        } else if (k.length === 1 && !mod && !e.altKey) {
            e.preventDefault();
            startEdit(k);
        }
    };

    // ── Satır / sütun / sayfa ──────────────────────────────────────────
    const addRow = () => mutateRows((rs) => (rs.splice(b.bottom + 1, 0, Array(dataCols).fill('')), rs));
    const addCol = () => mutateRows((rs) => rs.map((r) => (r.splice(b.right + 1, 0, ''), r)));
    const delRows = () => {
        mutateRows((rs) => (rs.splice(b.top, b.bottom - b.top + 1), rs.length ? rs : [['']]));
        setSel({ r0: b.top, c0: b.left, r1: b.top, c1: b.left });
    };
    const delCols = () => {
        mutateRows((rs) => rs.map((r) => (r.splice(b.left, b.right - b.left + 1), r)));
        setSel({ r0: b.top, c0: b.left, r1: b.top, c1: b.left });
    };
    const addSheet = () => {
        commitSheets([...sheets, { name: `Sayfa${sheets.length + 1}`, rows: [['']] }]);
        switchTo(sheets.length);
    };
    const renameSheet = (i: number) => {
        const name = window.prompt('Sayfanın adı', sheets[i].name)?.trim();
        if (name) commitSheets(sheets.map((s, j) => (j === i ? { ...s, name } : s)));
    };
    const switchTo = (i: number) => {
        setActive(i);
        setSel({ r0: 0, c0: 0, r1: 0, c1: 0 });
        setEdit(null);
        setLimit(ROW_STEP);
    };

    const cutRange = (color: Marker) => {
        const text = rangeText(' | ')
            .filter((l) => l.replace(/[\s|]/g, ''))
            .join('\n');
        if (!text) return;
        const ref = `${colName(b.left)}${b.top + 1}:${colName(b.right)}${b.bottom + 1}`;
        onCutText(text, color, `${sheet.name} · ${ref}`);
    };

    const colHeads = useMemo(() => Array.from({ length: nCols }, (_, c) => colName(c)), [nCols]);
    const selRef = `${colName(b.left)}${b.top + 1}${b.top !== b.bottom || b.left !== b.right ? `:${colName(b.right)}${b.bottom + 1}` : ''}`;
    const current = get(sel.r1, sel.c1);

    return (
        <div className="sheetview">
            <div className="sheetbar">
                <span className="sheetbar__ref mono">{selRef}</span>
                <span className="sheetbar__value" title={current}>
                    {current.startsWith('=') && <b className="mono">ƒ </b>}
                    {current || <i>boş</i>}
                </span>
                <span className="sheetbar__spacer" />
                <button className="btn btn--sm" onClick={addRow} title="Seçimin altına satır ekle">
                    <Plus size={13} weight="bold" /> Satır
                </button>
                <button className="btn btn--sm" onClick={addCol} title="Seçimin sağına sütun ekle">
                    <Plus size={13} weight="bold" /> Sütun
                </button>
                <button className="icon-btn" onClick={delRows} title="Seçili satırları sil">
                    <Trash size={15} weight="bold" />
                    <span className="visually-hidden">Satır sil</span>
                </button>
                <button className="btn btn--sm btn--ghost" onClick={delCols} title="Seçili sütunları sil">
                    Sütunu sil
                </button>
                <span className="sheetbar__cut" role="group" aria-label="Seçili hücrelerden kesit al">
                    <Scissors size={15} weight="bold" /> Kes
                    {MARKERS.map((m) => (
                        <button key={m} className="swatch" data-c={m} aria-label={`${m} renkte kes`} onClick={() => cutRange(m)} />
                    ))}
                </span>
            </div>

            <div
                className="grid"
                ref={grid}
                tabIndex={0}
                onKeyDown={onKeyDown}
                onCopy={(e) => {
                    if (edit) return;
                    e.preventDefault();
                    e.clipboardData.setData('text/plain', rangeText('\t').join('\n'));
                }}
                onPaste={(e) => {
                    if (edit) return;
                    e.preventDefault();
                    const text = e.clipboardData.getData('text/plain').replace(/\r/g, '').replace(/\n$/, '');
                    writeCells(b.top, b.left, text.split('\n').map((l) => l.split('\t')));
                }}
            >
                <table className="grid__table">
                    <thead>
                        <tr>
                            <th className="grid__corner" />
                            {colHeads.map((h, c) => (
                                <th
                                    key={h}
                                    className={c >= b.left && c <= b.right ? 'on' : undefined}
                                    onMouseDown={() => setSel({ r0: 0, c0: c, r1: Math.max(0, rows.length - 1), c1: c })}
                                >
                                    {h}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {Array.from({ length: nRows }, (_, r) => (
                            <tr key={r}>
                                <th
                                    className={r >= b.top && r <= b.bottom ? 'on' : undefined}
                                    onMouseDown={() => setSel({ r0: r, c0: 0, r1: r, c1: dataCols - 1 })}
                                >
                                    {r + 1}
                                </th>
                                {colHeads.map((_, c) => {
                                    const v = get(r, c);
                                    const inSel = r >= b.top && r <= b.bottom && c >= b.left && c <= b.right;
                                    const isCursor = r === sel.r1 && c === sel.c1;
                                    const editing = edit && edit.r === r && edit.c === c;
                                    return (
                                        <td
                                            key={c}
                                            className={[
                                                inSel && 'sel',
                                                isCursor && 'cur',
                                                v.startsWith('=') && 'fx',
                                                /^-?[\d.,]+%?$/.test(v) && 'num',
                                            ]
                                                .filter(Boolean)
                                                .join(' ')}
                                            onMouseDown={(e) => {
                                                if (editing) return;
                                                e.preventDefault();
                                                if (edit) commitEdit();
                                                dragging.current = true;
                                                setSel((s) => (e.shiftKey ? { ...s, r1: r, c1: c } : { r0: r, c0: c, r1: r, c1: c }));
                                                focusGrid();
                                            }}
                                            onMouseEnter={() => dragging.current && setSel((s) => ({ ...s, r1: r, c1: c }))}
                                            onDoubleClick={() => setEdit({ r, c, value: v })}
                                        >
                                            {editing ? (
                                                <input
                                                    className="grid__input"
                                                    autoFocus
                                                    value={edit.value}
                                                    onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                                                    onBlur={() => commitEdit()}
                                                    onKeyDown={(e) => {
                                                        e.stopPropagation();
                                                        if (e.key === 'Enter') commitEdit(1, 0);
                                                        else if (e.key === 'Tab') {
                                                            e.preventDefault();
                                                            commitEdit(0, e.shiftKey ? -1 : 1);
                                                        } else if (e.key === 'Escape') {
                                                            setEdit(null);
                                                            focusGrid();
                                                        }
                                                    }}
                                                />
                                            ) : (
                                                v
                                            )}
                                        </td>
                                    );
                                })}
                            </tr>
                        ))}
                    </tbody>
                </table>
                {rows.length + 5 > limit && (
                    <button className="btn btn--sm grid__more" onClick={() => setLimit((l) => l + ROW_STEP)}>
                        {ROW_STEP} satır daha göster ({rows.length - limit} kaldı)
                    </button>
                )}
            </div>

            <div className="tabs" role="tablist" aria-label="Sayfalar">
                {sheets.map((s, i) => (
                    <button
                        key={i}
                        role="tab"
                        aria-selected={i === active}
                        className="tabs__tab"
                        onClick={() => switchTo(i)}
                        onDoubleClick={() => renameSheet(i)}
                        title="Çift tıkla: yeniden adlandır"
                    >
                        {s.name}
                    </button>
                ))}
                <button className="tabs__tab tabs__tab--add" onClick={addSheet} aria-label="Sayfa ekle">
                    <Plus size={12} weight="bold" />
                </button>
                <span className="tabs__hint mono">ƒ formüller Excel'de açılınca hesaplanır</span>
            </div>
        </div>
    );
}
