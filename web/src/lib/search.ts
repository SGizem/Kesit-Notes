const TR: Record<string, string> = { ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u', â: 'a', î: 'i', û: 'u' };

/** Aramada "şaşırtıcı" ile "sasirtici" aynı sayılsın: küçült, Türkçe harfleri ve aksanları düzleştir. */
export function fold(s: string): string {
    return s
        .toLocaleLowerCase('tr')
        .replace(/[çğıöşüâîû]/g, (ch) => TR[ch])
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '');
}

/**
 * Basit puanlama: başlık başında eşleşme > kelime başında > herhangi bir yerde > gövdede.
 * Sorgu kelimelerinin hepsi geçmeli. 0 = eşleşmedi.
 */
export function score(query: string, title: string, body = ''): number {
    const words = fold(query).split(/\s+/).filter(Boolean);
    if (!words.length) return 1;
    const t = fold(title);
    const b = fold(body);
    let total = 0;
    for (const w of words) {
        if (t.startsWith(w)) total += 8;
        else if (t.includes(` ${w}`)) total += 5;
        else if (t.includes(w)) total += 3;
        else if (b.includes(w)) total += 1;
        else return 0;
    }
    return total;
}
