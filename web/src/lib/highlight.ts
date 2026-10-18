import type { Marker } from '../db/db';

/**
 * Uygulama içi fosfor: bir kapsayıcıdaki (PDF metin katmanı, editör) kesit
 * cümlelerini CSS Custom Highlight API ile boyar. DOM'a dokunmaz; editörün
 * içeriğini bozmaz. Eklentideki extension/highlight.js ile aynı yaklaşım.
 */

export interface Mark {
    id: string;
    text: string;
    color: Marker;
}

const COLORS: Marker[] = ['lime', 'orange', 'pink', 'violet'];
const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT']);
const BLOCK = 'P,DIV,LI,BLOCKQUOTE,TD,TH,H1,H2,H3,H4,H5,H6,PRE';
const isSpace = (c: number) => c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 160;
export const squash = (s: string) => s.replace(/\s+/g, ' ').trim();

interface Index {
    flat: string;
    nodes: Text[];
    ni: number[];
    off: number[];
}

/** Metni düzleştirir; <br> ve blok sınırları boşluk sayılır (seçimin toString'i gibi). */
function buildIndex(root: Element): Index {
    const nodes: Text[] = [];
    const ni: number[] = [];
    const off: number[] = [];
    let flat = '';
    let prevSpace = true;
    let prevBlock: Element | null = null;

    const virtualSpace = () => {
        if (prevSpace || !ni.length) return;
        flat += ' ';
        ni.push(ni[ni.length - 1]);
        off.push(off[off.length - 1]);
        prevSpace = true;
    };

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT, {
        acceptNode(n) {
            if (n.nodeType === Node.ELEMENT_NODE) {
                const tag = (n as Element).tagName;
                if (SKIP.has(tag)) return NodeFilter.FILTER_REJECT;
                return tag === 'BR' ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
            }
            return (n as Text).data.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
        },
    });
    let n: Node | null;
    while ((n = walker.nextNode())) {
        if (n.nodeName === 'BR') {
            virtualSpace();
            continue;
        }
        const text = n as Text;
        const block = text.parentElement?.closest(BLOCK) ?? null;
        if (prevBlock && block !== prevBlock) virtualSpace();
        prevBlock = block;
        const idx = nodes.push(text) - 1;
        const d = text.data;
        let chunk = '';
        for (let i = 0; i < d.length; i++) {
            if (isSpace(d.charCodeAt(i))) {
                if (prevSpace) continue;
                chunk += ' ';
                prevSpace = true;
            } else {
                chunk += d[i];
                prevSpace = false;
            }
            ni.push(idx);
            off.push(i);
        }
        flat += chunk;
    }
    return { flat, nodes, ni, off };
}

function find(index: Index, text: string): Range | null {
    let needle = squash(text);
    if (!needle) return null;
    let at = index.flat.indexOf(needle);
    // Tablodan alınan kesitlerde hücreler " · " ile ayrılır; belgede o ayraç yok, boşluk var.
    if (at === -1 && needle.includes(' · ')) {
        needle = needle.replace(/ · /g, ' ');
        at = index.flat.indexOf(needle);
    }
    let end = at + needle.length;
    if (at === -1) {
        // PDF'te satır sonu tireleri, düzenlenmiş metinler: baş ve son kelimelerle dene.
        const words = needle.split(' ');
        if (words.length < 8) return null;
        const head = words.slice(0, 4).join(' ');
        const tail = words.slice(-4).join(' ');
        at = index.flat.indexOf(head);
        if (at === -1) return null;
        const t = index.flat.indexOf(tail, at + head.length);
        if (t === -1 || t - at > needle.length * 1.5 + 50) return null;
        end = t + tail.length;
    }
    try {
        const r = document.createRange();
        r.setStart(index.nodes[index.ni[at]], index.off[at]);
        r.setEnd(index.nodes[index.ni[end - 1]], index.off[end - 1] + 1);
        return r;
    } catch {
        return null;
    }
}

/**
 * Kapsayıcıdaki kesitleri boyar; bulunanların kimliklerini ve aralıklarını döner
 * (listeden tıklanınca oraya kaydırmak için). Aynı anda tek kapsayıcı boyanır.
 */
export function paintMarks(root: Element, marks: Mark[]): Map<string, Range> {
    const found = new Map<string, Range>();
    if (!('highlights' in CSS)) return found;
    const groups: Record<Marker, Range[]> = { lime: [], orange: [], pink: [], violet: [] };
    if (marks.length) {
        const index = buildIndex(root);
        for (const m of marks) {
            const r = find(index, m.text);
            if (r) {
                groups[m.color].push(r);
                found.set(m.id, r);
            }
        }
    }
    for (const c of COLORS) {
        if (groups[c].length) CSS.highlights.set(`kesit-${c}`, new Highlight(...groups[c]));
        else CSS.highlights.delete(`kesit-${c}`);
    }
    return found;
}

export function clearMarks() {
    if (!('highlights' in CSS)) return;
    for (const c of COLORS) CSS.highlights.delete(`kesit-${c}`);
    CSS.highlights.delete('kesit-focus');
}

/** Listeden seçilen kesiti bir an daha belirgin göster. */
export function focusRange(range: Range) {
    if (!('highlights' in CSS)) return;
    CSS.highlights.set('kesit-focus', new Highlight(range));
    window.setTimeout(() => CSS.highlights.delete('kesit-focus'), 1800);
}

/** Seçimin içinde olduğu bloğun metni: kesitin bağlamı. */
export function contextOfRange(range: Range, text: string, max = 700): string | undefined {
    let node: Node | null = range.commonAncestorContainer;
    if (node.nodeType !== Node.ELEMENT_NODE) node = node.parentElement;
    const el = node as HTMLElement | null;
    const block = el?.closest('p, li, blockquote, td, h1, h2, h3, pre') ?? el?.closest('.textLayer') ?? el;
    const full = squash(block?.textContent ?? '');
    const t = squash(text);
    if (!full || full === t) return undefined;
    if (full.length <= max) return full;
    const at = Math.max(0, full.indexOf(t));
    const pad = Math.max(0, Math.floor((max - t.length) / 2));
    const start = Math.max(0, at - pad);
    const end = Math.min(full.length, at + t.length + pad);
    return (start > 0 ? '… ' : '') + full.slice(start, end) + (end < full.length ? ' …' : '');
}
