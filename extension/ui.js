// Açılır pencere ve yan panelin ortak parçaları. Global olarak yüklenir (<script>).

const MARKERS = { lime: '#D4FF2A', orange: '#FF9A1F', pink: '#FF4FA3', violet: '#A77BFF' };
const ALL_SITES = { origins: ['<all_urls>'] };

function ago(t) {
    const m = Math.round((Date.now() - t) / 60000);
    if (m < 1) return 'az önce';
    if (m < 60) return `${m} dk önce`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} sa önce`;
    const d = Math.round(h / 24);
    if (d < 30) return `${d} gün önce`;
    return `${Math.round(d / 30)} ay önce`;
}

function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text) n.textContent = text;
    return n;
}

const squash = (s) => (s ?? '').replace(/\s+/g, ' ').trim();

/** Başka bir sayfaya sürüklenince/kopyalanınca: alıntı + kaynak. */
function citation(c) {
    const src = c.fragmentUrl ?? c.url;
    const body = c.kind === 'image' ? c.imageUrl : `“${squash(c.text)}”`;
    return src ? `${body}\n— ${c.title || c.domain || ''} ${src}`.trim() : body;
}

/** Tek kesit kartı. opts.actions: kopyala / kaynağa git düğmeleri. */
function clipItem(c, opts = {}) {
    const li = el('li', 'item');
    li.style.setProperty('--mk', MARKERS[c.color] ?? MARKERS.lime);
    li.append(el('p', 'meta', `${c.domain || 'elle yazıldı'} · ${ago(c.createdAt)}`));

    if (c.kind === 'image' && c.imageUrl) {
        const img = el('img', 'img');
        img.src = c.imageUrl;
        img.alt = '';
        img.draggable = false;
        li.append(img);
    } else {
        const txt = el('p', 'txt');
        txt.append(el('span', '', c.text || ''));
        li.append(txt);
    }
    if (c.comment) li.append(el('p', 'cmt', `↳ ${c.comment}`));
    if (c.tags?.length) li.append(el('p', 'tags', c.tags.map((t) => `#${t}`).join('  ')));

    if (opts.actions) {
        li.draggable = true;
        li.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', citation(c));
            e.dataTransfer.effectAllowed = 'copy';
        });
        const row = el('div', 'acts');
        const copy = el('button', 'act', 'Kopyala');
        copy.addEventListener('click', async () => {
            await navigator.clipboard.writeText(citation(c));
            copy.textContent = 'Kopyalandı ✓';
            setTimeout(() => (copy.textContent = 'Kopyala'), 1400);
        });
        row.append(copy);
        const src = c.fragmentUrl ?? c.url;
        if (src) {
            const open = el('button', 'act', 'Kaynağa git ↗');
            open.addEventListener('click', () => chrome.tabs.create({ url: src }));
            row.append(open);
        }
        li.append(row);
    }
    return li;
}

/** "Sayfalarda göster" anahtarı: isteğe bağlı tüm-siteler iznini ister/bırakır. */
async function bindMarksToggle(input, onChange) {
    input.checked = await chrome.permissions.contains(ALL_SITES);
    input.addEventListener('change', async () => {
        const ok = input.checked ? await chrome.permissions.request(ALL_SITES) : await chrome.permissions.remove(ALL_SITES);
        if (!ok) input.checked = !input.checked;
        onChange?.(input.checked);
    });
}
