// Kesit — sayfa içi betik. background.js her kesitte enjekte eder; bir kez kurulur.
// Eklentinin izole dünyasında çalışır, sayfanın kendi JS'iyle karışmaz.

if (!window.__kesit) {
    const BLOCK = 'P,LI,BLOCKQUOTE,TD,TH,DD,DT,FIGCAPTION,H1,H2,H3,H4,H5,H6,PRE,ARTICLE,SECTION';
    const CONTEXT_MAX = 700;

    const squash = (s) => s.replace(/\s+/g, ' ').trim();

    // Text Fragment: kaynağı açınca tarayıcı seçilen cümleye kayar ve onu işaretler.
    const enc = (s) => encodeURIComponent(s).replace(/-/g, '%2D').replace(/,/g, '%2C').replace(/&/g, '%26');
    function fragmentUrl(text) {
        const words = squash(text).split(' ');
        const directive =
            words.length <= 8
                ? `text=${enc(words.join(' '))}`
                : `text=${enc(words.slice(0, 4).join(' '))},${enc(words.slice(-4).join(' '))}`;
        const href = location.href.split(':~:')[0];
        return href.includes('#') ? `${href}:~:${directive}` : `${href}#:~:${directive}`;
    }

    function contextOf(range, text) {
        let node = range.commonAncestorContainer;
        if (node.nodeType !== 1) node = node.parentElement;
        const block = node?.closest(BLOCK) ?? node;
        const full = squash(block?.innerText ?? '');
        const t = squash(text);
        if (!full || full === t) return undefined;
        if (full.length <= CONTEXT_MAX) return full;
        // Uzun bloklarda seçimin etrafından bir pencere al.
        const at = Math.max(0, full.indexOf(t));
        const pad = Math.max(0, Math.floor((CONTEXT_MAX - t.length) / 2));
        const start = Math.max(0, at - pad);
        const end = Math.min(full.length, at + t.length + pad);
        return (start > 0 ? '… ' : '') + full.slice(start, end) + (end < full.length ? ' …' : '');
    }

    function capture() {
        const sel = window.getSelection();
        const text = sel?.toString().trim();
        if (!sel || !text || sel.rangeCount === 0) return null;
        const range = sel.getRangeAt(0);
        return { text, context: contextOf(range, text), fragmentUrl: fragmentUrl(text) };
    }

    function pageMeta() {
        const meta = (sel) => document.querySelector(sel)?.getAttribute('content') || undefined;
        return {
            description: meta('meta[property="og:description"]') || meta('meta[name="description"]'),
            image: meta('meta[property="og:image"]'),
        };
    }

    // ── Sayfa kartı ────────────────────────────────────────────────────

    const MARKERS = { lime: '#D4FF2A', orange: '#FF9A1F', pink: '#FF4FA3', violet: '#A77BFF' };
    const LABEL = { text: 'Kesildi', image: 'Görsel kaydedildi', link: 'Bağlantı kaydedildi', page: 'Sayfa kaydedildi' };

    const CSS = `
:host { all: initial; }
.card {
  position: fixed; right: 22px; bottom: 22px; z-index: 2147483647;
  width: 340px; max-width: calc(100vw - 32px);
  background: #F7F4EC; color: #151412;
  border: 2px solid #151412; border-radius: 3px;
  box-shadow: 5px 5px 0 #151412;
  font: 14px/1.45 'Archivo', 'Arial Narrow', system-ui, sans-serif;
  animation: in 260ms cubic-bezier(.2,.9,.25,1.2);
}
@keyframes in { from { transform: translateY(18px) rotate(1.5deg); opacity: 0 } }
.card.out { transition: transform 200ms, opacity 200ms; transform: translateY(12px); opacity: 0; }
.head {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 8px 8px 10px; background: var(--mk); border-bottom: 2px solid #151412;
}
.head img { width: 18px; height: 18px; }
.head b { font-weight: 900; text-transform: uppercase; letter-spacing: .06em; font-size: 12px; }
.dom { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font: 11px ui-monospace, Consolas, monospace; text-align: right; }
.x { all: unset; cursor: pointer; width: 22px; height: 22px; display: grid; place-items: center;
  font-size: 16px; font-weight: 700; border: 2px solid transparent; }
.x:hover { border-color: #151412; }
.quote {
  margin: 12px 14px 0; font: 16px/1.45 'Newsreader', Georgia, serif;
  display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.quote span { background: linear-gradient(100deg, transparent .15em, var(--mk) .3em, var(--mk) calc(100% - .3em), transparent);
  -webkit-box-decoration-break: clone; box-decoration-break: clone; padding: 0 .2em; }
.thumb { margin: 12px 14px 0; max-height: 120px; width: calc(100% - 28px); object-fit: cover; border: 2px solid #151412; display: block; }
input {
  all: unset; box-sizing: border-box; display: block; width: calc(100% - 28px); margin: 12px 14px 0;
  padding: 8px 10px; background: #fff; border: 2px solid #151412;
  font: 14px 'Archivo', system-ui, sans-serif; color: #151412;
}
input:focus { box-shadow: 3px 3px 0 #FF4A1C; }
input::placeholder { color: #8a8578; }
.foot { display: flex; align-items: center; gap: 6px; padding: 12px 14px 12px; }
.sw { all: unset; cursor: pointer; width: 16px; height: 16px; border-radius: 50%; border: 2px solid #151412; }
.sw[aria-pressed="true"] { box-shadow: 0 0 0 2px #F7F4EC, 0 0 0 4px #151412; }
.open { all: unset; cursor: pointer; margin-left: auto; font-weight: 800; font-size: 13px;
  border-bottom: 2px solid #FF4A1C; }
.ok { margin-left: auto; font: 11px ui-monospace, Consolas, monospace; text-transform: uppercase; }
.ok + .open { margin-left: 12px; }
`;

    let current = null;

    function showCard(clip) {
        current?.remove();
        const host = document.createElement('kesit-card');
        const root = host.attachShadow({ mode: 'closed' });
        const style = document.createElement('style');
        style.textContent = CSS;
        const card = document.createElement('div');
        card.className = 'card';
        card.style.setProperty('--mk', MARKERS[clip.color] ?? MARKERS.lime);

        const head = el('div', 'head');
        const icon = document.createElement('img');
        icon.src = chrome.runtime.getURL('icons/icon-32.png');
        icon.alt = '';
        const close = el('button', 'x', '×');
        close.setAttribute('aria-label', 'Kapat');
        head.append(icon, el('b', '', LABEL[clip.kind] ?? 'Kaydedildi'), el('span', 'dom', clip.domain ?? ''), close);
        card.append(head);

        if (clip.kind === 'image' || (clip.kind === 'page' && clip.imageUrl)) {
            const img = document.createElement('img');
            img.className = 'thumb';
            img.src = clip.imageUrl;
            img.alt = '';
            card.append(img);
        }
        if (clip.text && clip.kind !== 'image') {
            const q = el('p', 'quote');
            q.append(el('span', '', clip.text));
            card.append(q);
        }

        const input = document.createElement('input');
        input.placeholder = 'Bir not ekle… #etiket de olur (Enter)';
        card.append(input);

        const foot = el('div', 'foot');
        const swatches = Object.entries(MARKERS).map(([name, hex]) => {
            const b = el('button', 'sw');
            b.style.background = hex;
            b.setAttribute('aria-label', name);
            b.setAttribute('aria-pressed', String(name === clip.color));
            b.addEventListener('click', () => {
                clip.color = name;
                card.style.setProperty('--mk', hex);
                swatches.forEach((s) => s.setAttribute('aria-pressed', String(s === b)));
                send({ type: 'patch', id: clip.id, patch: { color: name } });
                window.__kesitHL?.recolor(clip.id, name);
                hold();
            });
            return b;
        });
        const open = el('button', 'open', 'Masada aç →');
        open.addEventListener('click', () => {
            send({ type: 'open-app' });
            dismiss();
        });
        foot.append(...swatches, open);
        card.append(foot);

        root.append(style, card);
        document.documentElement.append(host);
        current = host;

        // Kesilen cümle sayfada fosforla kalsın; seçim kaldırılınca da görünür.
        if (clip.kind === 'text') {
            window.__kesitHL?.add({ id: clip.id, text: clip.text, color: clip.color });
            window.getSelection()?.removeAllRanges();
        }

        // Otomatik kapanma: fare üstündeyken ya da yazarken bekler.
        let timer;
        let busy = false;
        const arm = () => {
            clearTimeout(timer);
            if (!busy) timer = setTimeout(dismiss, 5000);
        };
        const hold = () => {
            busy = true;
            clearTimeout(timer);
        };
        card.addEventListener('mouseenter', hold);
        card.addEventListener('mouseleave', () => {
            busy = document.activeElement === host && input.value !== '';
            arm();
        });
        input.addEventListener('focus', hold);
        input.addEventListener('keydown', (e) => {
            e.stopPropagation(); // sayfanın kendi kısayolları tetiklenmesin
            if (e.key === 'Escape') dismiss();
            if (e.key === 'Enter' && input.value.trim()) {
                send({ type: 'patch', id: clip.id, patch: { comment: input.value.trim() } });
                input.replaceWith(el('p', 'quote', `↳ ${input.value.trim()}`));
                open.before(el('span', 'ok', 'not eklendi'));
                busy = false;
                arm();
            }
        });
        close.addEventListener('click', dismiss);
        arm();

        function dismiss() {
            clearTimeout(timer);
            card.classList.add('out');
            setTimeout(() => host.remove(), 220);
            if (current === host) current = null;
        }
        return true;
    }

    function el(tag, cls, text) {
        const n = document.createElement(tag);
        if (cls) n.className = cls;
        if (text) n.textContent = text;
        return n;
    }

    function send(msg) {
        try {
            chrome.runtime.sendMessage(msg);
        } catch {
            // Eklenti yeniden yüklendiyse bu sayfadaki eski betiğin bağlantısı kopmuştur.
        }
    }

    window.__kesit = { capture, pageMeta, showCard };
}
