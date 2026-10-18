// Kesit — yan panel. Gezinirken kesitler yanında açık durur.
// "Bu sayfada" bölümü için sekmenin adresini bilmek gerekir; bu da
// "Sayfalarda göster" izniyle gelir (ayrıca "tabs" izni istemiyoruz).

const PAGE_SIZE = 60;
let limit = PAGE_SIZE;
const $ = (id) => document.getElementById(id);

const fold = (s) =>
    (s ?? '')
        .toLocaleLowerCase('tr')
        .replace(/[çğıöşü]/g, (ch) => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' })[ch]);

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

async function render() {
    const { mirror = [] } = await chrome.storage.local.get('mirror');
    const q = fold($('q').value.trim());
    const hits = q
        ? mirror.filter((c) => fold([c.text, c.comment, c.title, c.domain, ...(c.tags ?? [])].join(' ')).includes(q))
        : mirror;

    $('all').replaceChildren(...hits.slice(0, limit).map((c) => clipItem(c, { actions: true })));
    $('all-n').textContent = String(hits.length);
    $('empty').hidden = mirror.length > 0;
    $('more').hidden = hits.length <= limit;

    // Bu sayfa: sekme adresi yalnızca izin varsa okunabilir.
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const key = tab?.url ? urlKey(tab.url) : '';
    const onPage = key ? mirror.filter((c) => c.url && urlKey(c.url) === key) : [];
    $('page').replaceChildren(...onPage.map((c) => clipItem(c, { actions: true })));
    $('page-n').textContent = key ? String(onPage.length) : '';
    $('page-off').hidden = !!tab?.url;
    $('page-sec').hidden = !!key && onPage.length === 0;
}

$('q').addEventListener('input', () => {
    limit = PAGE_SIZE;
    render();
});
$('more').addEventListener('click', () => {
    limit += PAGE_SIZE;
    render();
});
$('open').addEventListener('click', () => chrome.runtime.sendMessage({ type: 'open-app' }));
bindMarksToggle($('marks'), render);

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.mirror) render();
});
chrome.tabs.onActivated.addListener(render);
chrome.tabs.onUpdated.addListener((_id, info) => {
    if (info.url || info.status === 'complete') render();
});

render();
