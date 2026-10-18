// Kesit — sayfadaki kesit cümlelerini fosforla çizer.
// CSS Custom Highlight API kullanır: sayfanın DOM'una tek bir eleman eklemez,
// sitenin kendi stilini/JS'ini bozmaz. Renkler highlight.css'te.
// Hem capture.js (kesit alındığı an) hem marks.js (sayfaya dönünce) kullanır.

if (!window.__kesitHL) {
    const COLORS = ['lime', 'orange', 'pink', 'violet'];
    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEXTAREA', 'INPUT', 'SELECT', 'OPTION', 'TEMPLATE', 'svg', 'SVG']);
    const BLOCK = 'P,DIV,LI,BLOCKQUOTE,TD,TH,DD,DT,H1,H2,H3,H4,H5,H6,PRE,ARTICLE,SECTION,FIGCAPTION,HEADER,FOOTER';
    const MAX_CHARS = 2_000_000;
    const WATCH_MS = 60_000;

    const marks = new Map(); // id → { id, text, color }
    const isSpace = (c) => c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 160;
    const squash = (s) => s.replace(/\s+/g, ' ').trim();

    /**
     * Sayfanın görünür metnini tek bir dizeye düzleştirir (boşluklar tekilleşir,
     * bloklar arasına boşluk girer) ve her karakterin hangi metin düğümünde
     * olduğunu tutar. Böylece seçimin toString() hali sayfada aranabilir.
     */
    function buildIndex() {
        const nodes = [];
        const ni = [];
        const off = [];
        let flat = '';
        let prevSpace = true;
        let prevBlock = null;
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
            acceptNode(n) {
                const p = n.parentElement;
                if (!p || SKIP.has(p.tagName) || p.closest('kesit-card, svg')) return NodeFilter.FILTER_REJECT;
                return n.data.length ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            },
        });
        let n;
        while ((n = walker.nextNode()) && flat.length < MAX_CHARS) {
            const idx = nodes.push(n) - 1;
            const block = n.parentElement.closest(BLOCK);
            if (prevBlock && block !== prevBlock && !prevSpace) {
                // Paragraf sınırı: seçim metninde "\n\n" olan yer, sanal bir boşluk.
                flat += ' ';
                ni.push(ni[ni.length - 1]);
                off.push(off[off.length - 1]);
                prevSpace = true;
            }
            prevBlock = block;
            const d = n.data;
            let chunk = '';
            for (let i = 0; i < d.length; i++) {
                const code = d.charCodeAt(i);
                if (isSpace(code)) {
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

    function find(index, text) {
        const needle = squash(text);
        if (!needle) return null;
        let at = index.flat.indexOf(needle);
        let end = at + needle.length;
        if (at === -1) {
            // Uzun seçimlerde sayfa hafifçe değişmiş olabilir: baş ve son kelimelerle dene.
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

    let found = 0;
    function render() {
        if (!window.CSS?.highlights || !document.body) return 0;
        const groups = Object.fromEntries(COLORS.map((c) => [c, []]));
        found = 0;
        if (marks.size) {
            const index = buildIndex();
            for (const m of marks.values()) {
                const r = find(index, m.text);
                if (r) {
                    (groups[m.color] ?? groups.lime).push(r);
                    found++;
                }
            }
        }
        for (const c of COLORS) {
            if (groups[c].length) CSS.highlights.set(`kesit-${c}`, new Highlight(...groups[c]));
            else CSS.highlights.delete(`kesit-${c}`);
        }
        return found;
    }

    let timer;
    const later = (ms = 600) => {
        clearTimeout(timer);
        timer = setTimeout(render, ms);
    };

    /** Geç yüklenen içerik ve SPA gezinmeleri için bir süre DOM'u izler. */
    let observer;
    function watch(onUrlChange) {
        if (observer) return;
        let href = location.href;
        observer = new MutationObserver(() => {
            if (location.href !== href) {
                href = location.href;
                onUrlChange?.(href);
            }
            if (marks.size && found < marks.size) later(1000);
        });
        observer.observe(document.body, { childList: true, subtree: true, characterData: true });
        setTimeout(() => {
            observer.disconnect();
            observer = null;
        }, WATCH_MS);
    }

    window.__kesitHL = {
        set(list) {
            marks.clear();
            for (const m of list) marks.set(m.id, m);
            return render();
        },
        add(m) {
            marks.set(m.id, m);
            return render();
        },
        recolor(id, color) {
            const m = marks.get(id);
            if (!m) return;
            m.color = color;
            render();
        },
        watch,
    };
}
