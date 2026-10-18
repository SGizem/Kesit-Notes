# Kesit — Yol Haritası

> **Kesit**: İnternette gördüğün bir cümlenin altını çiz, sağ tıkla, kaydet.
> Sonra hepsi masanda: kaynağıyla, bağlamıyla, notlarınla.
> (Çalışma adı. `web/src/lib/brand.ts` ve `extension/manifest.json` dosyalarından tek yerden değişir.)

---

## 1. Eski projenin teşhisi (15 Ekim 2026'da silindi)

| Alan | Sorun |
|---|---|
| **Tasarım** | Birebir Notion kopyası: sol sidebar + Inter fontu + `#6366f1` indigo vurgu. Bu üçlü, yapay zekâ ile üretilmiş sitelerin "varsayılan" görünümü. Kimliği yok. |
| **Asıl fark (eklenti)** | Çalışmıyordu. Üç farklı arka plan dosyası vardı: biri kurulu olmayan Plasmo'ya bağlıydı, biri `/notes`'a, biri `/api/v1/web-captures`'a istek atıyordu. Kimlik doğrulaması yoktu, ikon yoktu, derleme adımı yoktu. |
| **Mimari** | Kişisel not uygulaması için NestJS + PostgreSQL + Workspace/Üye/Rol/ENTERPRISE planı fazla ağırdı. Postgres çalışmadan hiçbir şey açılmıyordu. Kayıt akışı DI hatasıyla çöküyordu (`api_output2.log`). |
| **Kalıntılar** | Log dosyaları, `check.js`, boş `test.db`, derlenmiş `dist/` klasörleri, örnek dosyalar repo kökündeydi. |

**Karar:** Sıfırdan, sade ve local-first kuruyoruz. Eski koddan fikir alınabilir ama taşınmıyor.

---

## 2. Ürünün özü: farkımız ne?

1. **Sağ tık → Kesit ikonu → kaydedildi.** Seçili metin, görsel, bağlantı veya sayfanın tamamı tek tıkla kaydedilir.
2. **Kaynağa geri dönüş.** Her kesit, [Text Fragment](https://developer.mozilla.org/en-US/docs/Web/URI/Fragment/Text_fragments) bağlantısıyla saklanır. Tıklayınca sayfa açılır ve seçtiğin cümle sarı çizilmiş olarak ekranda belirir.
3. **Bağlamıyla saklama.** Sadece seçtiğin cümle değil, etrafındaki paragraf da kaydedilir. 3 ay sonra "bu ne demekti?" demezsin.
4. **Sayfa içi minik kart.** Kaydettiğin anda sayfada bir kart çıkar. Hemen kısa bir yorum yazabilir, renk seçebilirsin (fosforlu kalem renkleri).
5. **Masa.** Uygulamaya girince kesitlerin bir mantar pano gibi dizilir. Kaynağa, renge ve güne göre süzülür.
6. **Kesiti nota sürükle.** Bir kesiti notun içine sürüklediğinde, kaynak künyesiyle birlikte alıntı bloğu olur.
7. **Dosyalar.** PDF, Word, Excel ve TXT içe aktarılır, görüntülenir, düzenlenir. PDF'te altını çizdiğin yer de bir kesit olur, web'dekiyle aynı mantık.
8. **Sohbet (Kesit'e sor).** "Geçen ay yapay zekâ etiği hakkında ne kaydetmiştim?" sorusuna kendi kesitlerinden, kaynak göstererek cevap verir.

### Benim önerdiğim özgün özellikler
- **Hatırlatma kesiti:** Her gün masanın tepesinde eski bir kesit belirir: "3 hafta önce bunun altını çizmiştin." Okuduğun şeyler unutulup gitmez.
- **Sayfaya geri dönünce çizgiler hâlâ orada:** Daha önce kesit aldığın bir sayfaya döndüğünde eklenti o cümleleri yeniden fosforlu gösterir.
- **Kaynak haritası:** En çok hangi sitelerden kesit aldığını gösteren bir görünüm.
- **Komut paleti (Ctrl+K):** Her şeye klavyeden erişim: ara, yeni not aç, kesite git.
- **Tarayıcı yan paneli:** Gezinirken Chrome yan panelinde son kesitlerin ve aktif notun açık durur.

---

## 3. Tasarım dili: "Fosforlu kalem & gazete kâğıdı"

Mavi yok. Pastel yok. Yumuşak gradyan yok. Her şeyi yuvarlatılmış kartlar yok.

| Öğe | Seçim | Neden |
|---|---|---|
| **Zemin** | Gazete kâğıdı `#ECE8DC` / gece modunda mürekkep `#151412` | Not defteri ve basılı sayfa hissi |
| **Mürekkep** | `#151412` | Saf siyah değil, sıcak siyah |
| **Ana vurgu** | Fosforlu yeşil `#D4FF2A` | Ürünün kendisi: altını çizmek |
| **İkinci vurgu** | Kiremit/vermilyon `#FF4A1C` | Eylemler ve uyarılar |
| **Kesit renkleri** | Gerçek fosforlu kalemler: yeşil, turuncu `#FF9A1F`, pembe `#FF4FA3`, mor `#A77BFF` | Fiziksel kalem metaforu |
| **Kenarlar** | 2px mürekkep çizgi, sert ofset gölge (`4px 4px 0`) | Bulanık gölge yok, basılı ve grafik |
| **Fontlar** | **Archivo** (arayüz ve başlıklar, 800–900 kalınlık), **Newsreader** (alıntı ve okuma metni), **JetBrains Mono** (URL, tarih, sayı) | Editoryal ve teknik karışım. Inter yok. |
| **İkonlar** | Phosphor (bold) | Lucide'in "her yerde aynı" görüntüsünden uzak |
| **İmza öğe** | Kesit metni, arkasında elle çizilmiş gibi fosforlu bir şeritle gösterilir | Uygulamanın her yerinde aynı görsel dil |
| **Yerleşim** | Notion tarzı sidebar yok. Solda dikey yazılı ince bir ray, büyük tarih başlığı, masa düzeni | Gazete ve pano karışımı |

---

## 4. Mimari

```
NewProjects/
├── web/                 React 19 + Vite + TypeScript
│   └── src/
│       ├── db/          Dexie (IndexedDB), local-first, sunucu gerekmez
│       ├── bridge/      Eklenti ↔ uygulama köprüsü
│       ├── features/    desk (masa), notes, files, chat
│       └── styles/      Tasarım token'ları
├── extension/           Chrome/Edge MV3, derleme adımı yok, doğrudan yüklenir
│   ├── background.js    Sağ tık menüsü, kısayol, kayıt kuyruğu
│   ├── capture.js       Sayfadaki seçim, bağlam, text-fragment ve mini kart
│   └── bridge.js        Uygulama sekmesine kesitleri aktarır
├── scripts/             İkon üretimi vb.
└── docs/
```

**Veri akışı (sunucusuz):**
1. Sağ tık → `background.js`, sayfaya `capture.js` enjekte eder → seçim + bağlam + URL toplanır.
2. Kesit `chrome.storage.local` kuyruğuna yazılır (uygulama kapalı olsa bile kaybolmaz).
3. Uygulama sekmesi açıkken `bridge.js` kuyruğu `postMessage` ile uygulamaya iletir → IndexedDB'ye yazılır → onay gelince kuyruktan silinir.
4. Uygulama açıksa kesit masaya **anında** düşer.

**Neden sunucusuz başlıyoruz:** Postgres kurmadan çalışır, veriler kullanıcının cihazında kalır, çok hızlıdır. Sohbet (yapay zekâ) ve cihazlar arası senkron için ilerleyen fazda küçük bir sunucu eklenecek. Mimari buna hazır.

---

## 5. Fazlar

| Faz | Kapsam | Durum |
|---|---|---|
| **0** | Eski projeyi ayırma, temiz yapı, plan | ✅ |
| **1** | Tasarım sistemi, uygulama kabuğu, Masa (kesit panosu), Notlar (editör), local DB, **çalışan eklenti** (sağ tık, ikon, sayfa içi kart, köprü) | ✅ |
| **2** | Komut paleti (Ctrl+K), etiketler, sayfaya dönünce yeniden çizme, Chrome yan paneli, kesit dışa aktarma (Markdown) | ✅ |
| **3** | Dosyalar: PDF (görüntüle + altını çiz → kesit), DOCX (düzenle + dışa aktar), XLSX (tablo düzenle), TXT/MD | ✅ |
| **4** | Kesit'e sor: kendi kesitlerin üzerinden kaynaklı sohbet. Ücretsiz yerel yapay zeka (Ollama / LM Studio), yoksa yapay zekasız mod; Claude isteğe bağlı | ⏸ Şimdilik kapalı |
| **5** | Hesap + cihazlar arası senkron, yayına alma, Chrome Web Store | ⏳ Sıradaki |

### Faz 1'de biten
- **Eklenti:** Seçili metin, görsel, bağlantı ve sayfa sağ tıkla kaydediliyor. Kısayol `Alt+Shift+K`. Text-fragment bağlantısı ve bağlam paragrafı da saklanıyor. Sayfada çıkan kart üzerinden yorum ve renk eklenebiliyor. Uygulama kapalıyken kesitler kuyrukta bekliyor. Açılır pencerede son kesitler görünüyor.
- **Masa:** Gazete künyesi, hızlı giriş kutusu (URL de kabul ediyor), "Hafızadan" kesiti, arama, renk ve kaynak süzgeçleri, günlere göre bölünmüş pano, kurulumu adım adım anlatan boş ekran.
- **Notlar:** TipTap editör, otomatik kayıt, sabitleme. Yandaki kesit çekmecesinden tıklayarak ya da sürükleyerek alıntı ekleniyor; alıntının altında kaynak künyesi duruyor.
- **Gece/gündüz modu** sistemi takip ediyor, düğmeyle de değiştirilebiliyor. Telefon düzeninde ray alt sekme çubuğuna dönüşüyor.
- **Doğrulama:** Gerçek bir tarayıcıda (Edge) eklenti yüklenerek uçtan uca denendi. Kapalı uygulama → kuyruk → aktarım, canlı aktarım, yorum güncellemesi ve nota ekleme sorunsuz çalıştı.

### Faz 2'de biten
- **Etiketler:** Yorumdaki `#okuma` otomatik etiket olur; sayfa kartından, masadaki karttan ya da hızlı giriş kutusundan eklenebilir. Masada etikete göre süzülür, adres çubuğunda da durur (`/?etiket=okuma`). Faz 1 verileri otomatik taşındı (veritabanı v2).
- **Komut paleti (Ctrl+K):** Her yerden açılır, editörün içinden de. Notlarda, kesitlerde, etiketlerde ve komutlarda arar. Türkçe karaktersiz yazımı da bulur ("sasirtici" → "şaşırtıcı"). Kesite gidince masada o kart yanıp söner.
- **Sayfaya dönünce çizgiler:** Kesit alınır alınmaz cümle sayfada fosforla çizilir. Açılır penceredeki **"Sayfalarda göster"** açıksa, sayfaya her dönüşte çizgiler yeniden belirir; paragraflar arası ve italik içeren cümleler de bulunur. Araç çubuğundaki ikonda o sayfadaki kesit sayısı görünür. Çizim CSS Custom Highlight API ile yapılıyor, sitenin HTML'ine dokunulmuyor.
  - Bu özellik "tüm sitelere erişim" izni ister. O yüzden isteğe bağlı: kapalıyken eklenti yalnızca sağ tıkladığın anda o sayfaya erişir.
- **Yan panel:** Açılır penceredeki "Yan panel" düğmesiyle açılır. Kesitler aranabilir, kopyalanabilir ve başka bir sayfaya (e-posta, doküman) sürüklenip bırakılabilir; bırakılan alıntı kaynağıyla birlikte gelir. "Bu sayfada" bölümü, açık sayfanın kesitlerini gösterir.
- **Dışa aktarma ve yedek:** Not → `.md` (editör araç çubuğu). Masada görünen kesitler → `.md` (süzgeç uygulanmış haliyle). Komut paletinden **Yedek indir (JSON)** ve **Yedekten geri yükle**; geri yükleme birleştirir, hiçbir şeyi silmez.
- **Ayna:** Uygulama, kesitlerin hafif bir kopyasını eklentiye gönderir. Uygulamada silinen ya da rengi değişen kesit, eklentideki çizgilere ve yan panele de yansır.
- **Doğrulama:** Edge'de 22 adımlı uçtan uca test yapıldı, hepsi geçti. Kapsamı: göç, etiketler, ayna, yeniden çizme, rozet, palet, Markdown, yedek, yan panel, telefon düzeni.

### Faz 3'te biten
- **Dosyalar rafı:** "Dosya ekle" ya da sürükle-bırak (toplu yükleme de olur). PDF, Word (.docx), Excel (.xlsx/.xls), CSV, TXT ve Markdown; en fazla 50 MB. Dosyalar tarayıcıda saklanır, asıl dosya da korunur.
- **Her dosyada "seç → Kes":** Metni seçince seçimin üstünde bir şerit çıkar; renge tıklamak kesit alır. Kesit masaya düşer (dosya adı ve PDF'te sayfa numarasıyla), dosyada fosforla çizili kalır. Masadan "Dosyada aç" ile o kesitin üstüne geri dönülür.
- **PDF:** Okunur, yakınlaştırılır, altı çizilir. İçeriği değiştirilmez. Sayfalar ekrana yaklaştıkça çizilir, böylece uzun PDF'ler de takılmaz. Metni aramaya dahil edilir (Ctrl+K).
- **Word:** Notlardaki editörle düzenlenir. Biçim korunarak yeniden `.docx` (başlık, kalın, liste, alıntı, bağlantı) ya da `.md` olarak indirilir.
- **Excel / CSV:** Hücre tablosu: tıkla/sürükle ile aralık seçme, klavyeyle gezinme ve düzenleme, Excel'den kopyala-yapıştır, satır/sütun ekleme-silme, sayfa sekmeleri. Formüller korunur ve Excel'de açılınca hesaplanır. Seçili aralıktan kesit alınır. `.xlsx` ya da sayfa sayfa `.csv` olarak indirilir.
- **Markdown:** Görsel olarak düzenlenir, her kayıtta yine Markdown'a yazılır. **TXT:** Satır yapısı korunarak düzenlenir.
- **Tema geçişi:** "Baskı silindiri" animasyonu: yeni tema, düğmenin olduğu köşeden çapraz bir çizgiyle sayfaya yayılır. Hareket azaltma ayarında anında değişir.
- **Bilinen sınırlar:** Excel formülleri uygulamada hesaplanmıyor, formül metni gösteriliyor. Word'deki görseller ve karmaşık tablolar içe aktarımda sadeleşiyor. PDF'e yazı eklenemiyor.
- **Doğrulama:** Edge'de 30 adımlı uçtan uca test geçti. İndirilen `.docx` mammoth ile, `.xlsx` SheetJS ile yeniden okunarak içerik ve formüller doğrulandı. Faz 2 testleri de (22/22) yeniden geçti.

### Faz 3 sonrası düzeltmeler
- **İndirme:** Kullanıcıya `.md` indirme kaldırıldı. Notlar, masadaki kesitler ve Word/Markdown/metin dosyaları **PDF** ya da **Word (.docx)** olarak iniyor. Excel/CSV dosyaları Excel, CSV ya da PDF tablosu olarak iniyor. PDF'ler seçilebilir metinli, Türkçe karakterli ve fosfor vurgulu.
- **Word tabloları:** Takvim, ders programı gibi tablolar editörde tablo olarak açılıyor, düzenleniyor ve Word/PDF'e tablo olarak geri yazılıyor. Tablodan alınan kesitlerde hücreler artık birbirine yapışmıyor.
- **Kesit paneli:** Uzun dosya adlı kesitler notlardaki ve dosyalardaki paneli artık taşırmıyor.

### Faz 4'te biten
- **Kesit'e sor:** Soldaki menüde "Sor". Soru sorulunca sorunla ilgili kesitler, notlar ve dosyalar tarayıcıda bulunuyor. Arama Türkçe eklere toleranslı ("kitaplarım" → "kitap"), "bu hafta", "geçen ay" gibi ifadeler de tarih süzgecine dönüşüyor.
- **Kaynak gösterme:** Cevaptaki her iddia numaralı bir atıfla dayandığı kesite, nota ya da dosyaya bağlanıyor. Altta kaynak kartları var; tıklayınca o kayda gidiliyor. Kayıtlarda olmayan bir şey sorulursa asistan bunu söylüyor, uydurmuyor.
- **Sohbetler** kaydediliyor, takip soruları önceki cevapları hatırlıyor. Cevap akış halinde geliyor ve **Durdur** ile kesilebiliyor. Komut paletinde yazılan her şey için en altta "Kesit'e sor: …" seçeneği var.
- **Sunucu (`server/`):** API anahtarını tarayıcıdan uzak tutuyor ve yalnızca bu bilgisayardan erişilebiliyor. Model `claude-opus-5-5`; reddedilen sorular otomatik olarak yedek modelle yeniden deneniyor. Anahtar yoksa ya da sunucu kapalıysa uygulama ne yapılacağını adım adım gösteriyor.
- **Doğrulama:** Edge'de 20 adımlı test geçti. Kapsamı: kaynak bulma, sunucu kapalı, anahtarsız, deneme modunda akış, atıflar, durdurma, palet ve telefon. Önceki fazların testleri de yeniden geçti (22 + 30 + 17). Gerçek Claude API ile deneme, anahtar eklenince yapılabilecek.

### Faz 4 kapatıldı (18 Ekim 2026)
Küçük yerel modelin cevap kalitesi yeterli bulunmadığı için "Sor" kullanıcı isteğiyle şimdilik kapatıldı. Kod silinmedi: `web/src/lib/brand.ts` → `FEATURES.sor = true` yapınca menüdeki "Sor", `/sor` sayfası ve komut paletindeki "Kesit'e sor" geri gelir; Claude sunucusu gerekiyorsa `npm run dev:sor`. Kapalıyken `/sor` adresleri masaya yönlenir ve hiçbir yapay zekâ servisine istek gitmez. `npm run dev` artık yalnızca uygulamayı başlatır.

### Faz 4 değişikliği: ücretsiz yapay zeka
Claude API ücretli olduğu için "Sor" artık varsayılan olarak **kullanıcının kendi bilgisayarındaki** ücretsiz bir modelle çalışıyor. Ücret ve kota yok, veri bilgisayardan çıkmıyor.
- **Motor sırası:** Ollama → LM Studio → Claude (yalnızca `server/.env`'de anahtar varsa) → yapay zekasız. Tarayıcı yerel modelle doğrudan konuşuyor, `server/` gerekmiyor. Soru kutusunun solunda hangi modelin cevapladığı görünüyor; birden fazla model varsa oradan seçiliyor.
- **Varsayılan model:** `gemma3:4b` (Google Gemma 3, 4 milyar parametre, ~3 GB). Türkçesi bu boyuttaki modellerin en iyisi; 4 GB ekran kartında çalışıyor.
- **Kaynak gösterme:** Küçük modeller Claude'un atıf özelliğine sahip değil. Model cümle sonlarına `[1]` yazıyor, uygulama bunları numaralı fosfor kutucuklara ve kaynak kartlarına çeviriyor. Kartta kaynağın soruyla en ilgili cümlesi gösteriliyor. Küçük modelin bağlamına sığması için en fazla 12 kesit, 3 not ve 2 dosya gidiyor (LM Studio'ya daha az).
- **Yapay zekasız mod:** Hiçbir model yoksa "Sor" en ilgili kayıtlardan en ilgili cümleleri numaralarıyla gösteriyor ve kurulumu üç adımda anlatıyor.
- **Başkaları için:** Siteyi kullanan herkes kendi bilgisayarına Ollama kurarsa kendi makinesinde çalışır. Site yayına alınınca (Faz 5) Ollama'ya o adresten gelen isteklere izin verilmesi gerekecek (`OLLAMA_ORIGINS`).
- **Cevap kalitesi (küçük model için):** Uzun kesitler baştan kırpılmıyor; soruyla en ilgili cümle ve devamı gönderiliyor. Aynı metin hem kesit hem not olarak kayıtlıysa bir kez gidiyor. Talimat özne karıştırmaya, sayı uydurmaya ve aynı olayı iki kez saymaya karşı yazıldı; sıcaklık 0,1. Kayıtlardan kurulmuş 5 soruluk ölçümde (her soru 3 kez) doğru cevap 6/15'ten 12/15'e çıktı, tekrarlı kaynak kartı 9'dan 0'a indi. Kalan hata: birden çok haberi birleştirip sayma gerektiren sorular ("kaç kez…").
- **Ollama kuruldu:** Model, LM Studio'daki `gemma-3-4b` dosyasından üretildi (`ollama create gemma3:4b`), yeniden indirilmedi. Ollama'da ilk kelime ~2 sn, cevabın tamamı ~5 sn.
- **Doğrulama:** Gerçek `gemma-3-4b` ile (LM Studio) 15 adımlı test geçti: atıf ayrıştırma, motor seçimi, Türkçe cevap ve atıflar, kayıtta olmayan soruya "bulamadım", Durdur, telefon. Faz 4 testi yapay zekasız mod için güncellendi (21/21); önceki fazlar da yeniden geçti (22 + 30 + 17).
