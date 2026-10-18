import { Link } from 'react-router-dom';
import { ArrowRight, BookOpenText, FileText, NotePencil, Scissors } from '@phosphor-icons/react';
import { BRAND } from '../../lib/brand';
import { PublicFoot, PublicTop } from './PublicPage';

const today = new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' });

/** Giriş yapmamış ziyaretçinin gördüğü ilk sayfa: ne olduğunu anlat, kayda çağır. */
export function Landing() {
    return (
        <div className="pub">
            <PublicTop />

            <main className="pub__main landing">
                {/* Künye: gazete başlığı gibi */}
                <p className="landing__dateline mono">
                    <span>{today}</span>
                    <span>Ücretsiz · Reklamsız</span>
                </p>

                <section className="hero">
                    <div className="hero__copy">
                        <h1 className="hero__title">
                            Okuduğun her şeyin <span className="sweep">en önemli cümlesi</span> burada kalsın.
                        </h1>
                        <p className="hero__lead">
                            {BRAND.name}, internette altını çizdiğin cümleleri kaynağı ve bağlamıyla birlikte saklar. Seç, sağ tıkla, kaydet. Gerisi
                            masanda.
                        </p>
                        <div className="hero__cta">
                            <Link to="/kayit" className="btn btn--hi btn--lg">
                                Ücretsiz başla <ArrowRight size={18} weight="bold" />
                            </Link>
                            <Link to="/giris" className="hero__login">
                                Hesabın var mı? Giriş yap
                            </Link>
                        </div>
                    </div>

                    {/* Bir sayfada sağ tık → Kesit'e kaydet → kart: ürünün kendisi */}
                    <figure className="demo" aria-label="Bir yazıda cümle seçip Kesit'e kaydetme örneği">
                        <div className="demo__page">
                            <p className="demo__kicker mono">pazar eki · deneme</p>
                            <p className="demo__h">Yavaş okumanın savunusu</p>
                            <p className="demo__p">
                                Ekranlar bize her gün binlerce cümle gösteriyor. Bir metni gerçekten okumuş olmanın kanıtı, ondan geriye bir cümle
                                taşıyabilmektir; <span className="demo__sel">altını çizdiğimiz satırlar, unutmaya karşı bıraktığımız işaretlerdir.</span>
                            </p>
                            <div className="ctx demo__ctx" aria-hidden>
                                <span className="ctx__row">Kopyala</span>
                                <span className="ctx__row ctx__row--kesit">
                                    <img src="/kesit.svg" alt="" /> {BRAND.name}’e kaydet
                                </span>
                                <span className="ctx__row">Yazdır…</span>
                            </div>
                        </div>
                        <div className="demo__card" aria-hidden>
                            <p className="demo__card-head mono">
                                <span>Kesildi</span>
                                <span>pazar.ornek</span>
                            </p>
                            <p className="demo__card-text">
                                <span className="mark">altını çizdiğimiz satırlar, unutmaya karşı bıraktığımız işaretlerdir.</span>
                            </p>
                            <p className="demo__card-tag mono">#okuma</p>
                        </div>
                    </figure>
                </section>

                <section id="nasil" className="how">
                    <h2 className="section-h">Üç hareket.</h2>
                    <ol className="how__list">
                        <li>
                            <span className="how__n">1</span>
                            <b>Seç.</b> Okuduğun sayfada seni durduran cümleyi işaretle.
                        </li>
                        <li>
                            <span className="how__n">2</span>
                            <b>Sağ tıkla.</b> Menüde “{BRAND.name}’e kaydet”. Ya da Alt+Shift+K.
                        </li>
                        <li>
                            <span className="how__n">3</span>
                            <b>Masanda.</b> Cümle; sayfanın adresi, başlığı ve çevresindeki paragrafla birlikte saklanır.
                        </li>
                    </ol>
                </section>

                <section className="feats">
                    <h2 className="section-h">Kesitten sonrası.</h2>
                    <div className="feats__grid">
                        <article className="feat" data-c="lime">
                            <Scissors size={26} weight="bold" />
                            <h3>Masa</h3>
                            <p>Kesitlerin gün gün dizilir; kaynağa, renge ve #etikete göre süzülür. Tıklayınca seni sayfadaki cümlenin tam üstüne götürür.</p>
                        </article>
                        <article className="feat" data-c="orange">
                            <BookOpenText size={26} weight="bold" />
                            <h3>Sayfada iz</h3>
                            <p>Kesit aldığın sayfaya döndüğünde cümleler fosforla çizili kalır. Yan panel gezinirken kesitlerini yanında tutar.</p>
                        </article>
                        <article className="feat" data-c="pink">
                            <NotePencil size={26} weight="bold" />
                            <h3>Notlar</h3>
                            <p>Kesitleri notlarına kaynağıyla birlikte alıntıla. Notunu PDF ya da Word olarak indir.</p>
                        </article>
                        <article className="feat" data-c="violet">
                            <FileText size={26} weight="bold" />
                            <h3>Dosyalar</h3>
                            <p>PDF, Word, Excel ve metin dosyalarını aç; altını çiz, düzenle, yeniden indir.</p>
                        </article>
                    </div>
                </section>

                <section className="promise">
                    <p className="promise__kicker mono">Söz</p>
                    <p className="promise__text">
                        Kesitlerin, notların ve dosyaların <span className="mark">yalnızca senin tarayıcında</span> durur. Reklam yok, izleme yok;
                        hesabın sadece seni tanımak için.
                    </p>
                    <Link to="/gizlilik" className="promise__link mono">
                        Gizlilik metni →
                    </Link>
                </section>

                <section className="final">
                    <h2 className="final__h">
                        İlk <span className="mark">kesitini</span> bugün al.
                    </h2>
                    <Link to="/kayit" className="btn btn--hi btn--lg">
                        Google ile başla <ArrowRight size={18} weight="bold" />
                    </Link>
                </section>
            </main>

            <PublicFoot />
        </div>
    );
}
