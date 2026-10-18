# Yayına alma

Üç adım: kodu GitHub'a koy → Cloudflare Pages siteyi yayınlasın → eklentiyi Edge mağazasına gönder. Hepsi ücretsiz.

## 1. GitHub

1. https://github.com/new adresinde **boş** bir depo aç (README ekleme). Ad: `kesit`. Gizli (Private) ya da açık olabilir.
2. Proje klasöründe:
   ```powershell
   git remote add origin git@github.com:KULLANICI_ADIN/kesit.git
   git push -u origin main
   ```

## 2. Cloudflare Pages (site)

1. https://dash.cloudflare.com adresinde ücretsiz hesap aç.
2. **Workers & Pages → Create → Pages → Connect to Git** → GitHub'ı bağla → `kesit` deposunu seç.
3. Ayarlar:
   | Alan | Değer |
   |---|---|
   | Project name | `kesit` (alınmışsa `kesit-not` gibi başka bir ad; site adresi `AD.pages.dev` olur) |
   | Production branch | `main` |
   | Framework preset | None |
   | Build command | `npm run build` |
   | Build output directory | `web/dist` |
4. **Environment variables (Production):** `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` (değerler: `docs/HESAP.md`). Bunlar olmadan site açılır ama giriş düğmesi çalışmaz.
5. **Save and Deploy.** Birkaç dakika sonra site `https://AD.pages.dev` adresinde açılır.

Bundan sonra `main` dalına her gönderimde site kendiliğinden yenilenir. Node sürümü `.node-version` dosyasından okunur (22).

`web/public/_headers` güvenlik başlıklarını ve önbelleği ayarlar. Adres çubuğuna doğrudan `/notlar/...` gibi bir yol yazıldığında Cloudflare Pages, `404.html` olmadığı için `index.html`'i döndürür; ek ayar gerekmez.

## 3. Eklenti paketi

Sitenin adresi belli olunca:

```powershell
npm run ext:build -- https://AD.pages.dev
```

Bu komut `extension/` klasörüne dokunmadan iki şey üretir:
- `dist-extension/`: Edge'de `edge://extensions` → Geliştirici modu → Paketlenmemiş öğe yükle ile önce kendin dene.
- `dist-extension.zip`: mağazaya yüklenecek dosya.

Paket, köprüyü yalnızca yayındaki adrese bağlar; içinde `localhost` kalmaz. Geliştirme için `extension/` klasörü `localhost:5173` ile çalışmaya devam eder.

## 4. Edge Add-ons mağazası

1. https://partner.microsoft.com/dashboard/microsoftedge adresinde Microsoft hesabınla **ücretsiz** geliştirici kaydı yap (bireysel hesap).
2. **Create new extension** → `dist-extension.zip`'i yükle.
3. İlan, özellikler, ekran görüntüleri ve sertifikasyon notu: `store/ILAN.md`. Logo: `store/logo-300.png`, ekran görüntüleri: `store/screens/`.
4. **Publish.** İnceleme genelde birkaç iş günü sürer.

Yeni sürüm göndermek için `extension/manifest.json` → `version` artır, `npm run ext:build -- ADRES` çalıştır, yeni zip'i yükle.

## Kontrol listesi

- [ ] Site açılıyor: tanıtım sayfası, `ADRES/gizlilik`.
- [ ] Google ile giriş çalışıyor, girişten sonra masa açılıyor (kurulum: `docs/HESAP.md`).
- [ ] `dist-extension/` Edge'de yüklenince sol alttaki nokta yeşil (eklenti bağlandı).
- [ ] Bir sayfada sağ tık → kaydet → kesit sitedeki masaya düştü.
