/** Ürün adı tek yerden değişsin diye. Eklentide de manifest.json → name. */
export const BRAND = {
    name: 'Kesit',
    tagline: 'altını çizdiğin her şey',
} as const;

/**
 * Özellik anahtarları.
 * sor: "Kesit'e sor" (yerel yapay zeka ile kayıtlara soru). 2026-10-18'de kullanıcı isteğiyle kapatıldı;
 * kod duruyor, true yapınca menü, yol ve komut paleti geri gelir (sunucu için: npm run dev:sor).
 */
export const FEATURES = {
    sor: false,
} as const;
