
/**
 * TipTap HTML → Markdown. Editörün ürettiği etiket kümesini kapsar;
 * tanımadığı etiketlerin sadece içeriğini yazar.
 */
export function htmlToMarkdown(html: string): string {
    const root = document.createElement('div');
    root.innerHTML = html;
    return blocks(root).replace(/\n{3,}/g, '\n\n').trim() + '\n';
}

function blocks(parent: Node, depth = 0): string {
    let out = '';
    for (const node of Array.from(parent.childNodes)) out += block(node, depth);
    return out;
}

function block(node: Node, depth: number): string {
    if (node.nodeType === Node.TEXT_NODE) {
        const t = node.textContent?.trim();
        return t ? `${t}\n\n` : '';
    }
    if (!(node instanceof HTMLElement)) return '';
    const tag = node.tagName;
    switch (tag) {
        case 'H1':
        case 'H2':
        case 'H3':
        case 'H4':
            return `${'#'.repeat(Number(tag[1]))} ${inline(node)}\n\n`;
        case 'P':
            return `${inline(node)}\n\n`;
        case 'BLOCKQUOTE':
            return (
                blocks(node, depth)
                    .trim()
                    .split('\n')
                    .map((l) => (l ? `> ${l}` : '>'))
                    .join('\n') + '\n\n'
            );
        case 'UL':
        case 'OL':
            return list(node, depth) + (depth === 0 ? '\n' : '');
        case 'PRE':
            return '```\n' + (node.textContent ?? '').replace(/\n$/, '') + '\n```\n\n';
        case 'HR':
            return '---\n\n';
        case 'TABLE':
            return table(node);
        case 'IMG':
            return `${image(node as HTMLImageElement)}\n\n`;
        default:
            return blocks(node, depth);
    }
}

/** GFM tablo: ilk satır başlık sayılır. Hücre içindeki | kaçışlanır. */
function table(el: HTMLElement): string {
    const rows = Array.from(el.querySelectorAll('tr')).map((tr) =>
        Array.from(tr.children).map((c) => inline(c as HTMLElement).replace(/\|/g, '\\|').replace(/\n/g, ' ')),
    );
    if (!rows.length) return '';
    const cols = Math.max(...rows.map((r) => r.length));
    const line = (r: string[]) => `| ${Array.from({ length: cols }, (_, i) => r[i] ?? '').join(' | ')} |`;
    return [line(rows[0]), `|${' --- |'.repeat(cols)}`, ...rows.slice(1).map(line)].join('\n') + '\n\n';
}

function list(el: HTMLElement, depth: number): string {
    const ordered = el.tagName === 'OL';
    const isTask = el.dataset.type === 'taskList';
    const pad = '  '.repeat(depth);
    let n = Number(el.getAttribute('start') ?? 1);
    let out = '';
    for (const li of Array.from(el.children)) {
        if (!(li instanceof HTMLElement)) continue;
        const marker = isTask ? `- [${li.dataset.checked === 'true' ? 'x' : ' '}]` : ordered ? `${n++}.` : '-';
        const nested = Array.from(li.querySelectorAll(':scope > ul, :scope > ol, :scope > div > ul, :scope > div > ol'));
        const textParts = Array.from(li.querySelectorAll(':scope > p, :scope > div > p'))
            .map((p) => inline(p as HTMLElement))
            .join(' ');
        const text = textParts || inline(li);
        out += `${pad}${marker} ${text}\n`;
        for (const sub of nested) out += list(sub as HTMLElement, depth + 1);
    }
    return out;
}

function inline(el: HTMLElement): string {
    let out = '';
    for (const node of Array.from(el.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE) {
            out += node.textContent ?? '';
            continue;
        }
        if (!(node instanceof HTMLElement)) continue;
        if (node.tagName === 'UL' || node.tagName === 'OL') continue;
        const inner = inline(node);
        switch (node.tagName) {
            case 'STRONG':
            case 'B':
                out += wrap(inner, '**');
                break;
            case 'EM':
            case 'I':
                out += wrap(inner, '*');
                break;
            case 'S':
            case 'DEL':
                out += wrap(inner, '~~');
                break;
            case 'MARK':
                out += wrap(inner, '==');
                break;
            case 'CODE':
                out += '`' + inner + '`';
                break;
            case 'A':
                out += `[${inner}](${node.getAttribute('href') ?? ''})`;
                break;
            case 'BR':
                out += '  \n';
                break;
            case 'IMG':
                out += image(node as HTMLImageElement);
                break;
            case 'LABEL':
                break; // görev listesindeki onay kutusu
            default:
                out += inner;
        }
    }
    return out.trim();
}

// "** metin **" geçersiz Markdown; boşlukları işaretin dışına al.
function wrap(s: string, mark: string): string {
    const m = s.match(/^(\s*)(.*?)(\s*)$/s);
    if (!m || !m[2]) return s;
    return `${m[1]}${mark}${m[2]}${mark}${m[3]}`;
}

function image(img: HTMLImageElement): string {
    return `![${img.getAttribute('alt') ?? ''}](${img.getAttribute('src') ?? ''})`;
}

export function slugify(s: string): string {
    const map: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' };
    return (
        s
            .toLocaleLowerCase('tr')
            .replace(/[çğıöşü]/g, (ch) => map[ch])
            .normalize('NFD')
            .replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 60) || 'kesit'
    );
}
