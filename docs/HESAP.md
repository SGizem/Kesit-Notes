# Hesaplar: Google ile giriş (Supabase)

Kesit'e giriş Google hesabıyla yapılır; hesaplar ücretsiz bir Supabase projesinde tutulur. Kesitler, notlar ve dosyalar yine yalnızca kullanıcının tarayıcısında durur. Supabase'te sadece hesap (ad, e-posta, profil fotoğrafı adresi) bulunur.

Hiçbir adımda kredi kartı istenmez. Kart isteyen bir ekran görürsen orada dur.

Aşağıda `SITE` yazan yerler sitenin adresi (örn. `https://kesit.pages.dev`), `PROJE` yazan yerler Supabase proje kimliği (örn. `abcdwxyz`).

## 1. Supabase projesi

1. https://supabase.com → **Start your project** → GitHub ile giriş yap.
2. **New project**:
   - Name: `kesit`
   - Database password: güçlü bir şifre üret ve bir yere kaydet (uygulama kullanmıyor ama Supabase istiyor)
   - Region: **Central EU (Frankfurt)**. Gizlilik metni "Avrupa Birliği'ndeki sunucu" diyor; başka bölge seçersen metni de değiştir.
   - Plan: **Free**
3. Proje açılınca **Project Settings → API Keys** (ya da **Connect**):
   - **Project URL** → `https://PROJE.supabase.co`
   - **Publishable key** (`sb_publishable_…`; eski panellerde "anon public"). Bu anahtar tarayıcıda görünür, gizli değildir.
   - **Secret / service_role** anahtarını hiçbir yere koyma.

## 2. Google giriş anahtarı (Google Cloud, ücretsiz)

1. https://console.cloud.google.com → üstteki proje seçici → **New project** → `Kesit`.
2. **APIs & Services → OAuth consent screen** (yeni panelde **Google Auth Platform → Branding**):
   - App name: `Kesit`, User support email: kendi e-postan
   - Audience: **External**
   - Developer contact: kendi e-postan
   - İzinler (scopes) için bir şey ekleme; varsayılanlar (e-posta, profil) yeter.
3. **Clients → Create client** (ya da **Credentials → Create credentials → OAuth client ID**):
   - Application type: **Web application**, Name: `Kesit`
   - **Authorized JavaScript origins:** `SITE` ve `http://localhost:5173`
   - **Authorized redirect URIs:** `https://PROJE.supabase.co/auth/v1/callback`
   - **Create** → çıkan **Client ID** ve **Client secret**'ı kopyala.
4. **Audience → Publish app** ("In production"). Yalnızca e-posta ve profil istendiği için Google incelemesi gerekmez. Yayınlamazsan sadece "test kullanıcısı" olarak eklediğin kişiler girebilir.

## 3. Supabase'te Google'ı aç

1. Supabase → **Authentication → Sign In / Providers → Google** → **Enable**.
2. Client ID ve Client secret'ı yapıştır → **Save**.
3. **Authentication → URL Configuration**:
   - **Site URL:** `SITE`
   - **Redirect URLs** (ikisini de ekle):
     - `SITE/**`
     - `http://localhost:5173/**`

## 4. Uygulamaya anahtarları ver

**Kendi bilgisayarında:** `web/.env.local` dosyası oluştur (git'e girmez):

```
VITE_SUPABASE_URL=https://PROJE.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
```

`npm run dev`'i yeniden başlat. Giriş sayfasındaki "Google ile devam et" düğmesi etkinleşir.

**Yayındaki sitede:** Cloudflare → Workers & Pages → `kesit` → **Settings → Variables and Secrets** → Production için aynı iki değişkeni ekle → **Deployments → Retry deployment** (değişkenler derleme sırasında okunur).

## Ücretsiz plan hakkında bilmen gerekenler

- **Sınırlar:** Ayda 50.000 aktif kullanıcı, 500 MB veritabanı. Hesap tutmak için çok fazlası.
- **Uyku:** Bir hafta boyunca hiç kimse giriş yapmazsa Supabase projeyi duraklatır. Veriler silinmez. Duraklatılınca kimse giriş yapamaz; Supabase panelinde **Restore project**'e basınca açılır. Düzenli kullanılan bir sitede bu olmaz.
- Ücretli plana geçmek için Supabase senden açıkça kart ister; kendiliğinden geçiş yoktur.

## Geliştirirken

`npm run dev` altında giriş sayfasında **Geliştirici olarak gir** düğmesi de görünür. Supabase'e hiç bağlanmaz, hesaplardan önceki yerel veriyle (eski `kesit` veritabanı) açılır. Bu düğme yayındaki sitede yoktur.

## Nasıl çalışıyor

- `web/src/lib/auth.ts`: Google girişi (Supabase, PKCE akışı), oturum durumu, çıkış.
- `web/src/db/db.ts` → `openAccountDb`: Her hesabın verisi ayrı bir tarayıcı veritabanında (`kesit-<hesap kimliği>`) durur. Aynı tarayıcıda iki kişi giriş yapsa birbirinin kesitlerini görmez. Hesaplardan önce biriken veri, bu tarayıcıda giriş yapan **ilk** hesaba bir kez kopyalanır; eski veritabanı silinmez.
- Giriş yapılmadan eklenti köprüsü çalışmaz; alınan kesitler eklentide bekler, giriş yapılınca masaya düşer. Çıkışta eklentideki kesit kopyası temizlenir.
