import {
    AlignmentType,
    BorderStyle,
    Document,
    ExternalHyperlink,
    HeadingLevel,
    LevelFormat,
    Packer,
    Paragraph,
    ShadingType,
    Table,
    TableCell,
    TableRow,
    TextRun,
    WidthType,
    type ParagraphChild,
} from 'docx';

/**
 * TipTap HTML → .docx. Editörün ürettiği yapıları kapsar: başlıklar, paragraflar,
 * kalın/italik/üstü çizili/fosfor, bağlantılar, madde/numaralı/görev listeleri,
 * alıntılar, kod blokları, ayraç. Görseller şimdilik alt metniyle yazılır.
 */
export async function htmlToDocx(html: string, title?: string): Promise<Blob> {
    const root = document.createElement('div');
    root.innerHTML = html;
    const children: Block[] = [];
    if (title) children.push(new Paragraph({ text: title, heading: HeadingLevel.TITLE }));
    walkBlocks(root, children, { quote: false });

    const doc = new Document({
        creator: 'Kesit',
        title,
        styles: {
            default: { document: { run: { font: 'Georgia', size: 24 } } },
        },
        numbering: {
            config: [
                {
                    reference: 'numbered',
                    levels: [0, 1, 2, 3].map((level) => ({
                        level,
                        format: LevelFormat.DECIMAL,
                        text: `%${level + 1}.`,
                        alignment: AlignmentType.START,
                        style: { paragraph: { indent: { left: 720 * (level + 1), hanging: 360 } } },
                    })),
                },
            ],
        },
        sections: [{ children: children.length ? children : [new Paragraph('')] }],
    });
    return Packer.toBlob(doc);
}

type Block = Paragraph | Table;

interface Ctx {
    quote: boolean;
}

const HEADINGS: Record<string, (typeof HeadingLevel)[keyof typeof HeadingLevel]> = {
    H1: HeadingLevel.HEADING_1,
    H2: HeadingLevel.HEADING_2,
    H3: HeadingLevel.HEADING_3,
    H4: HeadingLevel.HEADING_4,
};

const quoteStyle = {
    indent: { left: 480 },
    border: { left: { style: BorderStyle.SINGLE, size: 18, color: '151412', space: 12 } },
};

function walkBlocks(parent: Element, out: Block[], ctx: Ctx) {
    for (const node of Array.from(parent.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            const t = node.textContent?.trim();
            if (t) out.push(new Paragraph({ children: [new TextRun(t)], ...(ctx.quote && quoteStyle) }));
            continue;
        }
        if (!(node instanceof HTMLElement)) continue;
        const tag = node.tagName;
        if (HEADINGS[tag]) {
            out.push(new Paragraph({ heading: HEADINGS[tag], children: inline(node) }));
        } else if (tag === 'P') {
            out.push(new Paragraph({ children: inline(node), ...(ctx.quote && quoteStyle) }));
        } else if (tag === 'BLOCKQUOTE') {
            walkBlocks(node, out, { quote: true });
        } else if (tag === 'UL' || tag === 'OL') {
            list(node, out, 0);
        } else if (tag === 'PRE') {
            for (const line of (node.textContent ?? '').replace(/\n$/, '').split('\n')) {
                out.push(
                    new Paragraph({
                        shading: { type: ShadingType.CLEAR, fill: 'ECE8DC', color: 'auto' },
                        children: [new TextRun({ text: line || ' ', font: 'Consolas', size: 20 })],
                    }),
                );
            }
        } else if (tag === 'TABLE') {
            const t = table(node);
            if (t) out.push(t, new Paragraph(''));
        } else if (tag === 'HR') {
            out.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 12, color: '151412', space: 4 } } }));
        } else if (tag === 'IMG') {
            const alt = node.getAttribute('alt');
            out.push(new Paragraph({ children: [new TextRun({ text: `[görsel${alt ? `: ${alt}` : ''}]`, italics: true })] }));
        } else {
            walkBlocks(node, out, ctx);
        }
    }
}

/** Word tabloları (ders programı, takvim…) hücre ve birleşik sütunlarıyla geri yazılır. */
function table(el: HTMLElement): Table | null {
    const rows = Array.from(el.querySelectorAll('tr'))
        .map((tr) => {
            const cells = Array.from(tr.children).map((cell) => {
                const paras: Block[] = [];
                walkBlocks(cell, paras, { quote: false });
                const span = Number(cell.getAttribute('colspan') ?? 1);
                return new TableCell({
                    children: (paras.length ? paras : [new Paragraph('')]).filter((p): p is Paragraph => p instanceof Paragraph),
                    columnSpan: span > 1 ? span : undefined,
                    shading: cell.tagName === 'TH' ? { type: ShadingType.CLEAR, fill: 'ECE8DC', color: 'auto' } : undefined,
                });
            });
            if (!cells.length) return null;
            // tableHeader yalnızca gerçekten başlıksa yazılmalı: "false" yazmak bile Word'de satırı başlık yapıyor.
            const header = tr.querySelector('th') !== null;
            return new TableRow({ children: cells, ...(header && { tableHeader: true }) });
        })
        .filter((r): r is TableRow => r !== null);
    if (!rows.length) return null;
    return new Table({ rows, width: { size: 100, type: WidthType.PERCENTAGE } });
}

function list(el: HTMLElement, out: Block[], level: number) {
    const ordered = el.tagName === 'OL';
    const task = el.dataset.type === 'taskList';
    for (const li of Array.from(el.children)) {
        if (!(li instanceof HTMLElement)) continue;
        const paras = Array.from(li.querySelectorAll(':scope > p, :scope > div > p')) as HTMLElement[];
        const runs = paras.length ? paras.flatMap((p, i) => (i ? [new TextRun(' '), ...inline(p)] : inline(p))) : inline(li);
        if (task) {
            const done = li.dataset.checked === 'true';
            out.push(new Paragraph({ indent: { left: 360 * (level + 1) }, children: [new TextRun(done ? '☒ ' : '☐ '), ...runs] }));
        } else if (ordered) {
            out.push(new Paragraph({ numbering: { reference: 'numbered', level }, children: runs }));
        } else {
            out.push(new Paragraph({ bullet: { level }, children: runs }));
        }
        for (const sub of Array.from(li.querySelectorAll(':scope > ul, :scope > ol, :scope > div > ul, :scope > div > ol'))) {
            list(sub as HTMLElement, out, Math.min(level + 1, 3));
        }
    }
}

interface Marks {
    bold?: boolean;
    italics?: boolean;
    strike?: boolean;
    highlight?: boolean;
    code?: boolean;
}

function inline(el: HTMLElement, marks: Marks = {}): ParagraphChild[] {
    const out: ParagraphChild[] = [];
    for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent ?? '';
            if (text) out.push(run(text, marks));
            continue;
        }
        if (!(node instanceof HTMLElement)) continue;
        switch (node.tagName) {
            case 'STRONG':
            case 'B':
                out.push(...inline(node, { ...marks, bold: true }));
                break;
            case 'EM':
            case 'I':
                out.push(...inline(node, { ...marks, italics: true }));
                break;
            case 'S':
            case 'DEL':
                out.push(...inline(node, { ...marks, strike: true }));
                break;
            case 'MARK':
                out.push(...inline(node, { ...marks, highlight: true }));
                break;
            case 'CODE':
                out.push(...inline(node, { ...marks, code: true }));
                break;
            case 'BR':
                out.push(new TextRun({ text: '', break: 1 }));
                break;
            case 'A':
                out.push(
                    new ExternalHyperlink({
                        link: node.getAttribute('href') ?? '',
                        children: [run(node.textContent ?? '', marks, true)],
                    }),
                );
                break;
            case 'UL':
            case 'OL':
            case 'LABEL':
                break;
            default:
                out.push(...inline(node, marks));
        }
    }
    return out;
}

function run(text: string, m: Marks, link = false): TextRun {
    return new TextRun({
        text,
        bold: m.bold,
        italics: m.italics,
        strike: m.strike,
        highlight: m.highlight ? 'yellow' : undefined,
        font: m.code ? 'Consolas' : undefined,
        ...(link && { style: 'Hyperlink', underline: {}, color: '151412' }),
    });
}
