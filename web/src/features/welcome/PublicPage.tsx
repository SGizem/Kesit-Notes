import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { BRAND } from '../../lib/brand';

/** Giriş yapmamış ziyaretçinin sayfaları (tanıtım, gizlilik) için üst çubuk ve alt bilgi. */
export function PublicPage({ children }: { children: ReactNode }) {
    return (
        <div className="pub">
            <PublicTop />
            <main className="pub__main">{children}</main>
            <PublicFoot />
        </div>
    );
}

export function PublicTop() {
    return (
        <header className="pub-top">
            <Link to="/" className="pub-top__brand" aria-label={`${BRAND.name} ana sayfa`}>
                <img src="/kesit.svg" alt="" />
                <span>{BRAND.name}</span>
            </Link>
            <nav className="pub-top__nav">
                <a href="/#nasil" className="pub-top__link">
                    Nasıl çalışır
                </a>
                <Link to="/gizlilik" className="pub-top__link">
                    Gizlilik
                </Link>
                <Link to="/giris" className="btn btn--sm">
                    Giriş yap
                </Link>
                <Link to="/kayit" className="btn btn--hi btn--sm">
                    Kayıt ol
                </Link>
            </nav>
        </header>
    );
}

export function PublicFoot() {
    return (
        <footer className="pub-foot mono">
            <span>
                {BRAND.name} · {BRAND.tagline}
            </span>
            <span className="pub-foot__links">
                <Link to="/gizlilik">Gizlilik</Link>
                <Link to="/giris">Giriş yap</Link>
            </span>
        </footer>
    );
}
