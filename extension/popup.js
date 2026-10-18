async function render() {
    const { mirror = [], queue = [] } = await chrome.storage.local.get(['mirror', 'queue']);
    document.getElementById('recent').replaceChildren(...mirror.slice(0, 6).map((c) => clipItem(c)));
    document.getElementById('empty').hidden = mirror.length > 0;

    // Uygulamaya henüz aktarılmamış yeni kesitler
    const waiting = queue.filter((o) => o.op === 'put').length;
    const badge = document.getElementById('pending');
    badge.hidden = waiting === 0;
    badge.textContent = `${waiting} aktarılmayı bekliyor`;
}

document.getElementById('open').addEventListener('click', async () => {
    await chrome.runtime.sendMessage({ type: 'open-app' });
    window.close();
});

document.getElementById('privacy').addEventListener('click', async (e) => {
    e.preventDefault();
    await chrome.runtime.sendMessage({ type: 'open-app', path: '/gizlilik' });
    window.close();
});

// sidePanel.open kullanıcı tıklamasının içinde, beklemeden çağrılmalı; pencere kimliği önceden alınır.
let windowId;
chrome.windows.getCurrent().then((w) => (windowId = w.id));
document.getElementById('panel').addEventListener('click', () => {
    chrome.sidePanel.open({ windowId }).then(() => window.close());
});

bindMarksToggle(document.getElementById('marks'));
render();
