// Kesit — arka plan (service worker)
//
// Sağ tık menüsü ve kısayol buraya gelir. Kesit chrome.storage.local'daki
// "queue" kuyruğuna yazılır; uygulama sekmesi açıldığında bridge.js kuyruğu
// uygulamaya taşır, uygulama onaylayınca kuyruktan silinir.
//
// "mirror": kesitlerin hafif kopyası. Uygulama açıldıkça uygulamadan tazelenir
// (uygulama asıl kaynaktır); açılır pencere, yan panel ve sayfadaki çizgiler bunu okur.

const DEFAULT_APP_URL = 'http://localhost:5173';
const MIRROR_MAX = 1000;
const ALL_SITES = { origins: ['<all_urls>'] };
const MARKS_SCRIPT = {
    id: 'kesit-marks',
    matches: ['<all_urls>'],
    excludeMatches: ['http://localhost:5173/*', 'http://127.0.0.1:5173/*'],
    js: ['highlight.js', 'marks.js'],
    css: ['highlight.css'],
    runAt: 'document_idle',
    persistAcrossSessions: true,
};

// ── Kurulum ─────────────────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
    chrome.contextMenus.removeAll(() => {
        chrome.contextMenus.create({ id: 'selection', title: 'Kesit’e kaydet: “%s”', contexts: ['selection'] });
        chrome.contextMenus.create({ id: 'image', title: 'Görseli Kesit’e kaydet', contexts: ['image'] });
        chrome.contextMenus.create({ id: 'link', title: 'Bağlantıyı Kesit’e kaydet', contexts: ['link'] });
        chrome.contextMenus.create({ id: 'page', title: 'Bu sayfayı Kesit’e kaydet', contexts: ['page'] });
    });
    // 0.1 sürümündeki "recent" listesini aynaya taşı.
    const { recent, mirror } = await chrome.storage.local.get(['recent', 'mirror']);
    if (recent && !mirror) await chrome.storage.local.set({ mirror: recent.map(light) });
    if (recent) await chrome.storage.local.remove('recent');
    await syncMarksScript();
});
chrome.runtime.onStartup.addListener(syncMarksScript);
chrome.permissions.onAdded.addListener(syncMarksScript);
chrome.permissions.onRemoved.addListener(syncMarksScript);

/** "Sayfalarda göster" izni verildiyse çizgi betiğini tüm sayfalara kaydeder. */
async function syncMarksScript() {
    const granted = await chrome.permissions.contains(ALL_SITES);
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [MARKS_SCRIPT.id] });
    if (granted && !existing.length) await chrome.scripting.registerContentScripts([MARKS_SCRIPT]);
    if (!granted && existing.length) await chrome.scripting.unregisterContentScripts({ ids: [MARKS_SCRIPT.id] });
}

// ── Sağ tık menüsü ve kısayol ──────────────────────────────────────────

chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (!tab) return;
    const handlers = { selection: clipSelection, image: clipImage, link: clipLink, page: clipPage };
    handlers[info.menuItemId]?.(tab, info).catch((err) => console.error('[kesit]', err));
});

chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command !== 'save-selection') return;
    tab ??= (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0];
    if (tab) clipSelection(tab, {}).catch((err) => console.error('[kesit]', err));
});

// ── Kesit türleri ───────────────────────────────────────────────────────

async function clipSelection(tab, info) {
    const picked = await inPage(tab, () => window.__kesit.capture());
    const text = picked?.text || info.selectionText;
    if (!text) return;
    await save(tab, {
        kind: 'text',
        text,
        context: picked?.context,
        url: tab.url,
        fragmentUrl: picked?.fragmentUrl,
    });
}

async function clipImage(tab, info) {
    await save(tab, { kind: 'image', text: '', url: tab.url, imageUrl: info.srcUrl });
}

async function clipLink(tab, info) {
    await save(tab, {
        kind: 'link',
        text: info.selectionText || info.linkUrl,
        url: info.linkUrl,
        domain: domainOf(info.linkUrl),
        context: `Şu sayfada bulundu: ${tab.title ?? tab.url}`,
    });
}

async function clipPage(tab) {
    const meta = await inPage(tab, () => window.__kesit.pageMeta());
    await save(tab, {
        kind: 'page',
        text: meta?.description || tab.title || tab.url,
        url: tab.url,
        imageUrl: meta?.image,
    });
}

async function save(tab, partial) {
    const clip = {
        id: crypto.randomUUID(),
        color: 'lime',
        title: tab.title,
        domain: domainOf(tab.url),
        favicon: tab.favIconUrl?.startsWith('http') ? tab.favIconUrl : undefined,
        tags: [],
        noteIds: [],
        createdAt: Date.now(),
        ...partial,
    };
    await enqueue({ op: 'put', clip });
    await mirrorAdd(clip);

    // Sayfada kart göster (metin kesitinde cümleyi de çiz); yasaklı sayfalarda rozetle yetin.
    const shown = await inPage(tab, (c) => window.__kesit.showCard(c), [clip]);
    if (shown === undefined) flashBadge(tab.id);
    else if (clip.kind === 'text') updateBadge(tab.id, tab.url);
}

// ── Sayfa içi betik ─────────────────────────────────────────────────────

/** capture.js'i (bir kez) yükleyip sayfada bir fonksiyon çalıştırır. Başarısızsa undefined. */
async function inPage(tab, func, args = []) {
    if (!tab.id || !/^(https?|file):/.test(tab.url ?? '')) return undefined;
    try {
        const target = { tabId: tab.id };
        await chrome.scripting.insertCSS({ target, files: ['highlight.css'] });
        await chrome.scripting.executeScript({ target, files: ['highlight.js', 'capture.js'] });
        const [res] = await chrome.scripting.executeScript({ target, func, args });
        return res?.result ?? null;
    } catch (err) {
        console.warn('[kesit] sayfaya erişilemedi', err);
        return undefined;
    }
}

function flashBadge(tabId) {
    chrome.action.setBadgeBackgroundColor({ color: '#D4FF2A' });
    chrome.action.setBadgeTextColor?.({ color: '#151412' });
    chrome.action.setBadgeText({ tabId, text: '✓' });
    setTimeout(() => chrome.action.setBadgeText({ tabId, text: '' }), 1800);
}

/** Araç çubuğundaki ikonda bu sayfadaki kesit sayısı. */
async function updateBadge(tabId, url) {
    if (!tabId) return;
    const n = (await marksFor(url)).length;
    chrome.action.setBadgeBackgroundColor({ tabId, color: '#D4FF2A' });
    chrome.action.setBadgeTextColor?.({ tabId, color: '#151412' });
    chrome.action.setBadgeText({ tabId, text: n ? String(n) : '' });
}

// ── Kuyruk ve ayna (işlemler sırayla, yarış yok) ────────────────────────

let chain = Promise.resolve();
const serial = (fn) => (chain = chain.then(fn, fn));

function enqueue(op) {
    return serial(async () => {
        const { queue = [] } = await chrome.storage.local.get('queue');
        queue.push({ opId: crypto.randomUUID(), ...op });
        await chrome.storage.local.set({ queue });
    });
}

function ack(opIds) {
    return serial(async () => {
        const { queue = [] } = await chrome.storage.local.get('queue');
        const done = new Set(opIds);
        await chrome.storage.local.set({ queue: queue.filter((o) => !done.has(o.opId)) });
    });
}

/** Aynada bağlam ve not bağları tutulmaz. */
function light({ context, noteIds, ...rest }) {
    return rest;
}

function mirrorAdd(clip) {
    return serial(async () => {
        const { mirror = [] } = await chrome.storage.local.get('mirror');
        await chrome.storage.local.set({ mirror: [light(clip), ...mirror].slice(0, MIRROR_MAX) });
    });
}

function mirrorPatch(id, patch) {
    return serial(async () => {
        const { mirror = [] } = await chrome.storage.local.get('mirror');
        await chrome.storage.local.set({ mirror: mirror.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
    });
}

/** Uygulamadan gelen tam liste + henüz aktarılmamış (kuyruktaki) kesitler. */
function mirrorFromApp(appClips) {
    return serial(async () => {
        const { queue = [] } = await chrome.storage.local.get('queue');
        const known = new Set(appClips.map((c) => c.id));
        const pending = queue.filter((o) => o.op === 'put' && !known.has(o.clip.id)).map((o) => light(o.clip));
        const mirror = [...pending, ...appClips].sort((a, b) => b.createdAt - a.createdAt).slice(0, MIRROR_MAX);
        await chrome.storage.local.set({ mirror });
    });
}

// ── Sayfaya dönünce çizgiler ────────────────────────────────────────────

/** Aynı sayfa sayılsın: #, sondaki /, utm_* ve benzeri izleme parametreleri yok sayılır. */
function urlKey(url) {
    try {
        const u = new URL(url);
        for (const k of [...u.searchParams.keys()]) {
            if (/^(utm_|fbclid$|gclid$|mc_|ref$|ref_src$)/.test(k)) u.searchParams.delete(k);
        }
        return u.origin + u.pathname.replace(/\/$/, '') + u.search;
    } catch {
        return '';
    }
}

async function marksFor(url) {
    const key = urlKey(url);
    if (!key) return [];
    const { mirror = [] } = await chrome.storage.local.get('mirror');
    return mirror
        .filter((c) => c.kind === 'text' && c.text && urlKey(c.url) === key)
        .map(({ id, text, color }) => ({ id, text, color }));
}

// ── Mesajlar: sayfa kartı, köprü, çizgiler, açılır pencere, yan panel ──

const handlers = {
    async patch(msg) {
        await enqueue({ op: 'patch', id: msg.id, patch: msg.patch });
        await mirrorPatch(msg.id, msg.patch);
    },
    async ack(msg) {
        await ack(msg.opIds);
    },
    async mirror(msg) {
        if (Array.isArray(msg.clips)) await mirrorFromApp(msg.clips);
    },
    async 'app-seen'(msg) {
        if (msg.appUrl) await chrome.storage.local.set({ appUrl: msg.appUrl });
    },
    async 'open-app'(msg) {
        await openApp(msg.path ?? '/');
    },
    async 'marks-for'(msg, sender) {
        const marks = await marksFor(msg.url);
        if (sender.tab?.id) updateBadge(sender.tab.id, msg.url);
        return { marks };
    },
};

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
    const fn = handlers[msg?.type];
    if (!fn) return false;
    fn(msg, sender)
        .then((res) => reply(res ?? { ok: true }))
        .catch((err) => reply({ ok: false, error: String(err) }));
    return true;
});

async function openApp(path) {
    const { appUrl = DEFAULT_APP_URL } = await chrome.storage.local.get('appUrl');
    const [existing] = await chrome.tabs.query({ url: `${appUrl}/*` });
    // Masa için açık sekmeyi öne getir; belirli bir sayfa (örn. /gizlilik) yeni sekmede açılsın,
    // açık sekmede yarım kalmış bir işi bozmasın.
    if (existing?.id && path === '/') {
        await chrome.tabs.update(existing.id, { active: true });
        if (existing.windowId) await chrome.windows.update(existing.windowId, { focused: true });
    } else {
        await chrome.tabs.create({ url: appUrl + path });
    }
}

function domainOf(url) {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}
