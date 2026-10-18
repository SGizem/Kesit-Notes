import { useState } from 'react';
import { CaretDown, Warning } from '@phosphor-icons/react';
import { BRAND } from '../../lib/brand';

/** Boş masa, ürünün nasıl kullanıldığını gösterir: seç → sağ tık → kaydet. */
export function EmptyDesk() {
    return (
        <section className="empty">
            <h2 className="empty__title">
                Masan boş.
                <br />
                İlk <span className="mark">kesitini</span> al.
            </h2>
            <ol className="steps">
                <li className="step">
                    <span className="step__n">1</span>
                    <p className="step__t">Bir sayfada bir cümleyi seç</p>
                    <p className="step__demo">
                        Okuduğun her şeyin <span className="step__sel">en önemli cümlesi</span> burada kalsın.
                    </p>
                </li>
                <li className="step">
                    <span className="step__n">2</span>
                    <p className="step__t">Sağ tıkla</p>
                    <div className="ctx" aria-hidden>
                        <span className="ctx__row">Kopyala</span>
                        <span className="ctx__row">Google'da ara</span>
                        <span className="ctx__row ctx__row--kesit">
                            <img src="/kesit.svg" alt="" /> {BRAND.name}'e kaydet
                        </span>
                        <span className="ctx__row">İncele</span>
                    </div>
                </li>
                <li className="step">
                    <span className="step__n">3</span>
                    <p className="step__t">Masana düşer</p>
                    <p className="step__demo">
                        Kaynağı, bağlamı ve tarihiyle. Tıklayınca sayfa <b>o cümleye</b> kayarak açılır.
                    </p>
                </li>
            </ol>
            <p className="empty__alt mono">ya da yukarıdaki kutuya yaz · kısayol: Alt+Shift+K</p>
        </section>
    );
}

export function ExtensionBanner() {
    const [open, setOpen] = useState(false);
    return (
        <div className="banner">
            <button className="banner__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
                <Warning size={18} weight="bold" />
                <span>
                    <b>Eklenti bağlı değil.</b> Sağ tıkla kaydetmek için {BRAND.name} eklentisini kur.
                </span>
                <CaretDown size={16} weight="bold" className="banner__caret" />
            </button>
            {open && (
                <ol className="banner__steps">
                    <li>
                        Chrome'da <code>chrome://extensions</code> (Edge'de <code>edge://extensions</code>) adresini aç.
                    </li>
                    <li>Sağ üstten <b>Geliştirici modu</b>'nu aç.</li>
                    <li>
                        <b>Paketlenmemiş öğe yükle</b> → proje içindeki <code>extension</code> klasörünü seç.
                    </li>
                    <li>Bu sekmeyi yenile. Soldaki nokta yeşile döner.</li>
                </ol>
            )}
        </div>
    );
}
