import { BRAND } from '../../lib/brand';

/**
 * Gizlilik politikası. Edge Add-ons mağazası eklenti için bir gizlilik adresi istiyor: /gizlilik
 * Burada yazan her şey kodun bugünkü davranışıyla birebir uyuşmalı; davranış değişirse burası da değişir.
 */
export function PrivacyPage() {
    return (
        <article className="legal">
            <p className="legal__kicker mono">Son güncelleme: 18 Ekim 2026</p>
            <h1 className="legal__title">
                <span className="mark">Gizlilik</span>
            </h1>
            <p className="legal__lead">
                Kısaca: {BRAND.name} senin kesitlerini görmez. Kesitlerin, notların ve dosyaların yalnızca senin tarayıcında durur. Sunucuda
                sadece hesabın (adın ve e-posta adresin) tutulur. Reklam ve izleme yok.
            </p>

            <h2>Ne kaydediliyor, nerede duruyor?</h2>
            <ul>
                <li>
                    <b>Hesap:</b> Google ile giriş yaptığında Google'dan adın, e-posta adresin ve profil fotoğrafının adresi gelir. Bunlar ve giriş
                    zamanların, hesabını tanımak için Supabase'te (Avrupa Birliği'ndeki sunucu) tutulur. Google, {BRAND.name}'e giriş yaptığını bilir;
                    şifren {BRAND.name}'e hiç gelmez. Profil fotoğrafın uygulamada gösterilmez.
                </li>
                <li>
                    <b>Uygulama:</b> Kesitlerin, notların ve yüklediğin dosyalar tarayıcının yerel deposunda (IndexedDB), bu cihazda durur. Sitenin
                    sunucusuna gönderilmez; site yalnızca uygulamanın kendisini (sayfa ve kod dosyalarını) sunar.
                </li>
                <li>
                    <b>Eklenti:</b> Sağ tıklayıp kaydettiğinde seçtiğin metin (ya da görselin veya bağlantının adresi), sayfanın adresi ve başlığı,
                    seçimin çevresindeki paragraf ve eklediğin yorum kaydedilir. Bunlar önce eklentinin tarayıcıdaki yerel deposuna yazılır,{' '}
                    {BRAND.name} sekmesi açılınca uygulamaya aktarılır. Eklenti ayrıca açılır pencere, yan panel ve sayfadaki çizgiler için son
                    kesitlerinin hafif bir kopyasını (en fazla 1000) yerelde tutar.
                </li>
                <li>
                    Kesitlerin, notların ve dosyaların {BRAND.name}'e ya da üçüncü taraflara gönderilmez; hesap sunucusunda da tutulmaz. Analitik, çerez, reklam ya da izleme kodu yoktur. Yazı tipleri de
                    sitenin içindedir; açılışta başka bir siteye istek gitmez.
                </li>
            </ul>

            <h2>Eklenti izinleri neden gerekli?</h2>
            <dl className="legal__perms">
                <dt>Sağ tık menüsü (contextMenus)</dt>
                <dd>Menüdeki “{BRAND.name}’e kaydet” satırı için.</dd>
                <dt>Etkin sekme ve betik (activeTab, scripting)</dt>
                <dd>Yalnızca sen kaydettiğin anda, o sekmede seçili metni ve çevresini okumak ve sayfada kaydedildi kartını göstermek için.</dd>
                <dt>Yerel depo (storage)</dt>
                <dd>Kesitleri uygulamaya aktarılana kadar ve ayarlarını cihazında tutmak için.</dd>
                <dt>Yan panel (sidePanel)</dt>
                <dd>Gezinirken kesitlerini yanda göstermek için.</dd>
                <dt>Tüm sitelere erişim (isteğe bağlı, varsayılan kapalı)</dt>
                <dd>
                    Yalnızca açılır penceredeki “Sayfalarda göster” ayarını açarsan istenir: daha önce kesit aldığın bir sayfaya döndüğünde o cümleleri
                    fosforla çizmek için. Sayfanın içeriği hiçbir yere gönderilmez.
                </dd>
            </dl>

            <h2>Verini nasıl indirir ya da silersin?</h2>
            <ul>
                <li>
                    Uygulamada <kbd>Ctrl</kbd>+<kbd>K</kbd> → “Yedek indir (JSON)” tüm kesitlerini ve notlarını indirir. Yüklediğin dosyalar bu
                    yedeğe girmez; onları Dosyalar bölümünden tek tek indirebilirsin.
                </li>
                <li>
                    Tarayıcıda bu sitenin verilerini silmek uygulamadaki her şeyi siler; eklentiyi kaldırmak eklentinin yerel deposunu siler. Yedeğin
                    yoksa silinen veri geri gelmez, çünkü başka bir yerde kopyası yoktur.
                </li>
                <li>
                    Çıkış yapınca eklentideki kesit kopyası da temizlenir. Hesabının silinmesini istersen bize yaz; hesap kaydın silinir (kesitlerin
                    zaten yalnızca senin cihazındadır).
                </li>
            </ul>

            <h2>Barındırma</h2>
            <p>
                Site Cloudflare Pages üzerinde yayınlanır. Cloudflare, her web sunucusu gibi, sayfayı sana ulaştırmak için IP adresi gibi teknik
                bilgileri işleyebilir. {BRAND.name} bu kayıtlara erişmez ve onları kullanmaz.
            </p>

            <h2>Değişiklikler</h2>
            <p>
                İleride cihazlar arası eşitleme eklenirse kesitlerin sunucuda saklanmaya başlar; bu sayfa, özellik yayına girmeden önce
                güncellenecek.
            </p>

            <section className="legal__en" lang="en">
                <h2>In English</h2>
                <p>
                    You sign in with Google; your name, email address and profile picture URL are stored in Supabase (EU) to identify your
                    account. {BRAND.name} does not collect your content. Clips, notes and files are stored only in your browser (IndexedDB and the extension’s
                    local storage) on your device. When you save a clip, the extension records the selected text (or image/link URL), the page URL
                    and title, the surrounding paragraph and your comment, keeps it in local extension storage and hands it to the {BRAND.name} tab.
                    Nothing is sent to us or to third parties; there are no analytics, cookies, ads or trackers, and fonts are self-hosted. The
                    optional “all sites” permission is requested only if you turn on “Sayfalarda göster” (show highlights on pages) and is used
                    solely to draw your existing highlights. Clearing this site’s data or removing the extension deletes everything. The site is
                    hosted on Cloudflare Pages, which may process technical data such as IP addresses to deliver it.
                </p>
            </section>
        </article>
    );
}
