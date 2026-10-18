import type { Content, ContentText, TDocumentDefinitions, TableCell } from 'pdfmake/interfaces';

/**
 * TipTap HTML (notlar, Word, Markdown, metin) → seçilebilir metinli PDF.
 * pdfmake + gömülü Roboto (Türkçe karakterler dahil). Sadece indirme anında yüklenir.
 */

const INK = '#151412';
const INK_2 = '#4a4740';
const PAPER_2 = '#ece8dc';
const MARK: Record<string, string> = { lime: '#D4FF2A', orange: '#FF9A1F', pink: '#FF7FBE', violet: '#C9B0FF' };

type PdfMake = typeof import('pdfmake');
let loaded: Promise<PdfMake> | null = null;

/** pdfmake ve font dosyası (~1 MB) ilk indirmede yüklenir. */
function pdfMake(): Promise<PdfMake> {
    loaded ??= (async () => {
        const [mod, fonts] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')]);
        const pm = ((mod as { default?: PdfMake }).default ?? mod) as PdfMake;
        pm.addVirtualFileSystem(((fonts as { default?: unknown }).default ?? fonts) as Parameters<PdfMake['addVirtualFileSystem']>[0]);
        return pm;
    })();
    return loaded;
}

export async function htmlToPdf(html: string, title?: string, subtitle?: string): Promise<Blob> {
    const root = document.createElement('div');
    root.innerHTML = html;
    const content: Content[] = [];
    if (title) content.push({ text: title, style: 'title' });
    if (subtitle) content.push({ text: subtitle, style: 'subtitle' });
    content.push(...blocks(root));
    return render(content, title);
}

/** Excel/CSV → PDF tabloları; her sayfa yeni bir PDF sayfasında başlar. */
export async function sheetsToPdf(sheets: { name: string; rows: string[][] }[], title: string): Promise<Blob> {
    let widest = 1;
    const content: Content[] = [{ text: title, style: 'title' }];
    sheets.forEach((s, i) => {
        const cols = Math.max(1, ...s.rows.map((r) => r.length));
        widest = Math.max(widest, cols);
        const body: TableCell[][] = s.rows.map((r, ri) =>
            Array.from({ length: cols }, (_, c) => ({ text: r[c] ?? '', bold: ri === 0, fontSize: 9 })),
        );
        content.push(
            { text: s.name, style: 'h2', ...(i > 0 && { pageBreak: 'before' as const }) },
            { table: { headerRows: 1, widths: Array(cols).fill('auto'), body: body.length ? body : [['']] }, layout: gridLayout },
        );
    });
    return render(content, title, widest > 6 ? 'landscape' : 'portrait');
}

async function render(content: Content[], title?: string, orientation: 'portrait' | 'landscape' = 'portrait'): Promise<Blob> {
    const pm = await pdfMake();
    const doc: TDocumentDefinitions = {
        info: { title: title ?? 'Kesit', creator: 'Kesit' },
        pageSize: 'A4',
        pageOrientation: orientation,
        pageMargins: [56, 56, 56, 64],
        defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.35, color: INK },
        styles: {
            title: { fontSize: 24, bold: true, margin: [0, 0, 0, 4] },
            subtitle: { fontSize: 9, color: INK_2, margin: [0, 0, 0, 16] },
            h1: { fontSize: 18, bold: true, margin: [0, 14, 0, 6] },
            h2: { fontSize: 15, bold: true, margin: [0, 12, 0, 5] },
            h3: { fontSize: 13, bold: true, margin: [0, 10, 0, 4] },
            p: { margin: [0, 0, 0, 7] },
            meta: { fontSize: 8.5, color: INK_2 },
        },
        footer: (page, pages) => ({
            columns: [
                { text: 'KESİT', bold: true, fontSize: 8, characterSpacing: 1.5 },
                { text: `${page} / ${pages}`, alignment: 'right', fontSize: 8, color: INK_2 },
            ],
            margin: [56, 24, 56, 0],
        }),
        content,
    };
    return pm.createPdf(doc).getBlob();
}

// ── HTML → pdfmake içerik ─────────────────────────────────────────────

const HEAD: Record<string, string> = { H1: 'h1', H2: 'h2', H3: 'h3', H4: 'h3' };

function blocks(parent: Element): Content[] {
    const out: Content[] = [];
    for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            const t = node.textContent?.trim();
            if (t) out.push({ text: t, style: 'p' });
            continue;
        }
        if (!(node instanceof HTMLElement)) continue;
        const tag = node.tagName;
        if (HEAD[tag]) out.push({ text: inline(node), style: HEAD[tag] });
        else if (tag === 'P') out.push({ text: inline(node).length ? inline(node) : ' ', style: 'p' });
        else if (tag === 'BLOCKQUOTE') out.push(quote(blocks(node)));
        else if (tag === 'UL' || tag === 'OL') out.push(list(node));
        else if (tag === 'PRE') out.push(code(node.textContent ?? ''));
        else if (tag === 'HR') out.push({ canvas: [{ type: 'line', x1: 0, y1: 0, x2: 483, y2: 0, lineWidth: 1.5, lineColor: INK }], margin: [0, 8, 0, 12] });
        else if (tag === 'TABLE') out.push(table(node));
        else if (tag === 'IMG') out.push({ text: `[görsel${node.getAttribute('alt') ? `: ${node.getAttribute('alt')}` : ''}]`, italics: true, color: INK_2, style: 'p' });
        else out.push(...blocks(node));
    }
    return out;
}

/** Alıntı: solda kalın mürekkep çizgisi. */
function quote(inner: Content[]): Content {
    return {
        table: { widths: ['*'], body: [[{ stack: inner.length ? inner : [' '] }]] },
        layout: {
            hLineWidth: () => 0,
            vLineWidth: (i) => (i === 0 ? 3 : 0),
            vLineColor: () => INK,
            paddingLeft: () => 12,
            paddingTop: () => 2,
            paddingBottom: () => 0,
        },
        margin: [0, 2, 0, 10],
    };
}

function code(text: string): Content {
    return {
        table: { widths: ['*'], body: [[{ text: text.replace(/\n$/, ''), fontSize: 9, preserveLeadingSpaces: true }]] },
        layout: { hLineWidth: () => 0, vLineWidth: () => 0, fillColor: () => PAPER_2, paddingLeft: () => 10, paddingTop: () => 8, paddingBottom: () => 8 },
        margin: [0, 2, 0, 10],
    };
}

function list(el: HTMLElement): Content {
    const task = el.dataset.type === 'taskList';
    const items: Content[] = [];
    for (const li of Array.from(el.children)) {
        if (!(li instanceof HTMLElement)) continue;
        const paras = Array.from(li.querySelectorAll(':scope > p, :scope > div > p')) as HTMLElement[];
        const text = paras.length ? paras.flatMap((p, i) => (i ? [' ', ...inline(p)] : inline(p))) : inline(li);
        const prefix = task ? (li.dataset.checked === 'true' ? '[x] ' : '[ ] ') : '';
        const nested = Array.from(li.querySelectorAll(':scope > ul, :scope > ol, :scope > div > ul, :scope > div > ol'));
        const line: ContentText = { text: prefix ? [prefix, ...text] : text };
        items.push(nested.length ? { stack: [line, ...nested.map((n) => list(n as HTMLElement))] } : line);
    }
    if (el.tagName === 'OL') return { ol: items, margin: [0, 0, 0, 8] };
    return { ul: items, margin: [0, 0, 0, 8], ...(task && { type: 'none' as const }) };
}

const gridLayout = {
    hLineWidth: () => 0.8,
    vLineWidth: () => 0.8,
    hLineColor: () => INK,
    vLineColor: () => INK,
    paddingLeft: () => 5,
    paddingRight: () => 5,
    paddingTop: () => 3,
    paddingBottom: () => 3,
    fillColor: (row: number) => (row === 0 ? PAPER_2 : null),
};

function table(el: HTMLElement): Content {
    const rows = Array.from(el.querySelectorAll('tr'));
    const cols = Math.max(1, ...rows.map((r) => Array.from(r.children).reduce((n, c) => n + Number(c.getAttribute('colspan') ?? 1), 0)));
    const body: TableCell[][] = rows.map((tr) => {
        const cells: TableCell[] = [];
        for (const cell of Array.from(tr.children)) {
            const span = Number(cell.getAttribute('colspan') ?? 1);
            const stack = blocks(cell);
            cells.push({ stack: stack.length ? stack : [' '], colSpan: span > 1 ? span : undefined, bold: cell.tagName === 'TH', fontSize: 9 });
            for (let i = 1; i < span; i++) cells.push({ text: '' });
        }
        while (cells.length < cols) cells.push({ text: '' });
        return cells.slice(0, cols);
    });
    if (!body.length) return { text: '' };
    const headerRows = rows[0]?.querySelector('th') ? 1 : 0;
    return { table: { headerRows, widths: Array(cols).fill('*'), body }, layout: gridLayout, margin: [0, 4, 0, 12] };
}

interface Marks {
    bold?: boolean;
    italics?: boolean;
    strike?: boolean;
    mark?: string;
    link?: string;
    code?: boolean;
}

function inline(el: HTMLElement, m: Marks = {}): ContentText[] {
    const out: ContentText[] = [];
    for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent ?? '';
            if (text) out.push(run(text, m));
            continue;
        }
        if (!(node instanceof HTMLElement)) continue;
        switch (node.tagName) {
            case 'STRONG':
            case 'B':
                out.push(...inline(node, { ...m, bold: true }));
                break;
            case 'EM':
            case 'I':
                out.push(...inline(node, { ...m, italics: true }));
                break;
            case 'S':
            case 'DEL':
                out.push(...inline(node, { ...m, strike: true }));
                break;
            case 'MARK':
                out.push(...inline(node, { ...m, mark: MARK[node.dataset.c ?? 'lime'] ?? MARK.lime }));
                break;
            case 'CODE':
                out.push(...inline(node, { ...m, code: true }));
                break;
            case 'A':
                out.push(...inline(node, { ...m, link: node.getAttribute('href') ?? undefined }));
                break;
            case 'BR':
                out.push({ text: '\n' });
                break;
            case 'UL':
            case 'OL':
            case 'LABEL':
                break;
            default:
                out.push(...inline(node, m));
        }
    }
    return out;
}

function run(text: string, m: Marks): ContentText {
    const decoration = [m.strike && 'lineThrough', m.link && 'underline'].filter(Boolean) as ('lineThrough' | 'underline')[];
    return {
        text,
        bold: m.bold,
        italics: m.italics,
        background: m.mark ?? (m.code ? PAPER_2 : undefined),
        link: m.link,
        decoration: decoration.length === 1 ? decoration[0] : decoration.length ? decoration : undefined,
    } as ContentText;
}
