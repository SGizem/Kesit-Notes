// Kesit — sayfaya dönünce çizgiler. Kullanıcı "Sayfalarda göster"i açtıysa
// background.js bunu tüm sayfalara kaydeder (highlight.js ile birlikte).
// Bu sayfada kesit yoksa hiçbir şey yapmaz.

(() => {
    if (window.__kesitMarksStarted) return;
    window.__kesitMarksStarted = true;

    async function load(url) {
        let res;
        try {
            res = await chrome.runtime.sendMessage({ type: 'marks-for', url });
        } catch {
            return; // eklenti yeniden yüklendi
        }
        window.__kesitHL.set(res?.marks ?? []);
    }

    load(location.href);
    // SPA'larda adres değişince o sayfanın kesitleri
    window.__kesitHL.watch((href) => load(href));
})();
