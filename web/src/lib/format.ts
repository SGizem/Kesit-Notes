const DAY = 86_400_000;

export function domainOf(url: string): string {
    try {
        return new URL(url).hostname.replace(/^www\./, '');
    } catch {
        return '';
    }
}

export function escapeHtml(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

const startOfDay = (t: number) => {
    const d = new Date(t);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
};

/** Masadaki gün ayraçları: BUGÜN / DÜN / 12 EKİM PAZARTESİ */
export function dayLabel(t: number): string {
    const diff = Math.round((startOfDay(Date.now()) - startOfDay(t)) / DAY);
    if (diff === 0) return 'Bugün';
    if (diff === 1) return 'Dün';
    return new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'long' });
}

export function dayKey(t: number): number {
    return startOfDay(t);
}

export function clock(t: number): string {
    return new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
}

export function ago(t: number): string {
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return 'az önce';
    const m = Math.round(s / 60);
    if (m < 60) return `${m} dk önce`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} sa önce`;
    const d = Math.round(h / 24);
    if (d < 7) return `${d} gün önce`;
    if (d < 30) return `${Math.round(d / 7)} hafta önce`;
    if (d < 365) return `${Math.round(d / 30)} ay önce`;
    return `${Math.round(d / 365)} yıl önce`;
}

export function htmlToPlain(html: string): string {
    const el = document.createElement('div');
    // Blok sonlarına boşluk: "<h2>Başlık</h2><p>Metin" → "Başlık Metin", "BaşlıkMetin" değil.
    el.innerHTML = html.replace(/<\/(p|h[1-6]|li|blockquote|pre|div)>|<br\s*\/?>/gi, '$& ');
    return (el.textContent ?? '').replace(/\s+/g, ' ').trim();
}
