# Yayına alma

Üç adım: kodu GitHub'a koy → Vercel siteyi yayınlasın → eklentiyi Edge mağazasına gönder. Hepsi ücretsiz.

## 1. GitHub

1. https://github.com/new adresinde **boş** bir depo aç (README ekleme). Ad: `Kesit-Notes`. Gizli (Private) ya da açık olabilir.
2. Proje klasöründe:
   ```powershell
   git remote add origin https://github.com/SGizem/Kesit-Notes.git
   git push -u origin main
   ```

## 2. Vercel (site)

Site ilk önce Cloudflare Pages'e kurulmuştu, ancak `pages.dev` alan adı Türkiye'de erişime engelli (Ekim 2026). Bu yüzden site Vercel'de.

1. https://vercel.com/signup → **Hobby** (ücretsiz, kart istemez) → **Continue with GitHub**.
2. **Add New… → Project** → GitHub'da `Kesit-Notes` deposuna izin ver → **Import**.
3. Ayarlar:
   | Alan | Değer |
   |---|---|
   | Project Name | `kesit-notes` (site adresi `kesit-notes.vercel.app`) |
   | Framework Preset | Other |
   | Root Directory | `./` (değiştirme) |
   | Build / Output | Dokunma; `vercel.json`'dan okunur (`npm run build` → `web/dist`) |
4. **Environment Variables:** `VITE_SUPABASE_URL` ve `VITE_SUPABASE_PUBLISHABLE_KEY` (değerler: `docs/HESAP.md`). Bunlar olmadan site açılır ama giriş düğmesi çalışmaz.
5. **Deploy.** Bir iki dakika sonra site `https://kesit-notes.vercel.app` adresinde açılır.

Bundan sonra `main` dalına her gönderimde site kendiliğinden yenilenir. Node sürümü kök `package.json` → `engines` alanından okunur (22).

`vercel.json` güvenlik başlıklarını, önbelleği ve yönlendirmeyi ayarlar: adres çubuğuna doğrudan `/notlar/...` gibi bir yol yazıldığında da uygulama açılır.

## 3. Eklenti paketi

Sitenin adresi belli olunca:

```powershell
npm run ext:build -- https://kesit-notes.vercel.app
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
