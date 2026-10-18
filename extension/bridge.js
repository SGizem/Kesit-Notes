// Kesit — köprü. Sadece uygulama sekmesinde çalışır (manifest → content_scripts).
// chrome.storage'daki kesit kuyruğunu window.postMessage ile uygulamaya taşır.
// Protokol: web/src/bridge/extensionBridge.ts

(() => {
    const EXT = 'kesit-ext';
    const APP = 'kesit-app';
    const VERSION = chrome.runtime.getManifest().version;

    const post = (type, extra = {}) => window.postMessage({ source: EXT, type, ...extra }, location.origin);

    const send = (msg) => {
        try {
            chrome.runtime.sendMessage(msg);
        } catch {
            // Eklenti yeniden yüklendi; sekme yenilenince düzelir.
        }
    };

    async function pushQueue() {
        const { queue = [] } = await chrome.storage.local.get('queue');
        if (queue.length) post('ops', { ops: queue });
    }

    window.addEventListener('message', (e) => {
        if (e.source !== window || e.origin !== location.origin) return;
        const msg = e.data;
        if (!msg || msg.source !== APP) return;
        if (msg.type === 'hello') {
            post('hello', { version: VERSION });
            send({ type: 'app-seen', appUrl: msg.appUrl });
        } else if (msg.type === 'pull') {
            void pushQueue();
        } else if (msg.type === 'ack' && Array.isArray(msg.opIds)) {
            send({ type: 'ack', opIds: msg.opIds });
        } else if (msg.type === 'mirror' && Array.isArray(msg.clips)) {
            send({ type: 'mirror', clips: msg.clips });
        }
    });

    // Uygulama açıkken yeni bir kesit alınırsa anında aktar.
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.queue) void pushQueue();
    });

    // Uygulama bizden önce yüklendiyse selamı kaçırmış olabilir.
    post('hello', { version: VERSION });
})();
