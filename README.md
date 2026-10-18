# Kesit

Bir cümlenin altını çiz, sağ tıkla, kaydet. Kaynağı ve bağlamıyla birlikte masanda.

- **web/**: Uygulama (React + Vite). Veriler tarayıcıda (IndexedDB) durur.
- **server/**: "Kesit'e sor" için isteğe bağlı küçük sunucu (özellik şimdilik kapalı).
- **extension/**: Chrome/Edge eklentisi. Derleme adımı yok.
- **docs/YOL-HARITASI.md**: Plan, tasarım dili, fazlar.

## Çalıştırma

```powershell
npm install
npm run dev          # uygulama: http://localhost:5173
```

### "Kesit'e sor" (şimdilik kapalı)

Kayıtlara yerel yapay zekâyla soru sorma özelliği şimdilik kapalı; kodu duruyor. Açmak için `web/src/lib/brand.ts` → `FEATURES.sor = true`. Ayrıntılar: `docs/YOL-HARITASI.md` → Faz 4.

## Eklentiyi yükleme

1. Chrome'da `chrome://extensions` (Edge'de `edge://extensions`) adresini aç.
2. **Geliştirici modu**'nu aç.
3. **Paketlenmemiş öğe yükle** → `extension` klasörünü seç.
4. Uygulama sekmesini yenile. Sol alttaki nokta yeşile döner.

Herhangi bir sayfada metin seç → sağ tık → **Kesit'e kaydet**. Kısayol: `Alt+Shift+K`.
Görsele, bağlantıya ya da sayfanın boş bir yerine sağ tıklayınca da kaydedebilirsin.

Uygulama kapalıyken aldığın kesitler eklentide bekler, uygulamayı açınca masaya düşer.

Eklenti ikonuna tıklayınca açılan pencerede:
- **Sayfalarda göster:** Kesit aldığın sayfaya dönünce cümleler fosforla çizilir. Bu ayar "tüm sitelere erişim" izni ister; kapalıyken eklenti yalnızca sağ tıkladığın sayfaya erişir.
- **Yan panel:** Gezinirken kesitlerin yanında durur, başka sayfalara sürüklenebilir.

Uygulamadaki **Dosyalar** bölümüne PDF, Word, Excel, CSV, TXT ve Markdown yükleyebilirsin. Hepsinde metni (Excel'de hücreleri) seçip **Kes** ile kesit alırsın; Word, Excel ve metin dosyaları düzenlenip yeniden indirilebilir.

Uygulamada `Ctrl+K` her şeyi açar: arama, yeni not, dosya ekleme, PDF/Word dışa aktarma, yedek indir/geri yükle.

## İkonlar

`web/public/kesit.svg` logodur. Eklenti PNG'leri bundan üretilir:

```powershell
npm run icons
```
