import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Warning } from '@phosphor-icons/react';
import { AUTH_CONFIGURED, signInAsDeveloper, signInWithGoogle, useAuth } from '../../lib/auth';
import { BRAND } from '../../lib/brand';

const COPY = {
    giris: {
        title: 'Tekrar hoş geldin.',
        lead: 'Masana dönmek için Google hesabınla giriş yap.',
        switchText: 'Hesabın yok mu?',
        switchLink: { to: '/kayit', label: 'Kayıt ol' },
    },
    kayit: {
        title: 'Masanı kur.',
        lead: 'Google hesabınla saniyeler içinde hesap aç. Şifre yok, form yok.',
        switchText: 'Zaten hesabın var mı?',
        switchLink: { to: '/giris', label: 'Giriş yap' },
    },
} as const;

/** Giriş ve kayıt aynı akış: Google ile devam et. İlk girişte hesap kendiliğinden açılır. */
export function AuthPage({ mode }: { mode: 'giris' | 'kayit' }) {
    const auth = useAuth();
    const [params] = useSearchParams();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const copy = COPY[mode];
    const next = params.get('next') ?? '/';
    const shownError = error ?? (auth.status === 'signed-out' ? auth.error : undefined);

    const go = async () => {
        setError(null);
        setBusy(true);
        try {
            await signInWithGoogle(next);
            // Tarayıcı Google'a gidiyor; sayfa değişene kadar düğme meşgul kalır.
        } catch {
            setBusy(false);
            setError('Google girişi başlatılamadı. İnternet bağlantını kontrol edip tekrar dene.');
        }
    };

    return (
        <div className="auth">
            <aside className="auth__side" aria-hidden>
                <Link to="/" className="auth__brand">
                    <img src="/kesit.svg" alt="" /> {BRAND.name}
                </Link>
                <blockquote className="auth__quote">
                    <span className="mark">Bir fikri sahiplenmenin en iyi yolu</span> onu kendi cümlelerinle yeniden kurmaktır.
                </blockquote>
                <p className="auth__src mono">masandan · 4 gün önce altını çizmiştin</p>
            </aside>

            <main className="auth__main">
                <Link to="/" className="auth__back mono">
                    <ArrowLeft size={14} weight="bold" /> {BRAND.name}
                </Link>
                <h1 className="auth__title">{copy.title}</h1>
                <p className="auth__lead">{copy.lead}</p>

                <button className="gbtn" onClick={go} disabled={busy || !AUTH_CONFIGURED}>
                    <GoogleMark />
                    <span>{busy ? 'Google’a yönlendiriliyor…' : 'Google ile devam et'}</span>
                </button>

                {shownError && (
                    <p className="auth__error" role="alert">
                        <Warning size={16} weight="bold" /> {shownError}
                    </p>
                )}
                {!AUTH_CONFIGURED && (
                    <p className="auth__note">
                        Giriş servisi henüz ayarlanmadı. Kurulum: <code>docs/HESAP.md</code>
                    </p>
                )}
                {import.meta.env.DEV && (
                    <button className="btn btn--sm auth__dev" onClick={signInAsDeveloper}>
                        Geliştirici olarak gir (yalnızca yerelde)
                    </button>
                )}

                <p className="auth__switch">
                    {copy.switchText} <Link to={`${copy.switchLink.to}${params.size ? `?${params}` : ''}`}>{copy.switchLink.label}</Link>
                    <span className="auth__hint"> · İlk girişte hesabın kendiliğinden açılır.</span>
                </p>
                <p className="auth__legal">
                    Devam ederek <Link to="/gizlilik">gizlilik metnini</Link> okumuş sayılırsın. {BRAND.name} Google hesabından yalnızca adını, e-posta
                    adresini ve profil fotoğrafını alır.
                </p>
            </main>
        </div>
    );
}

/** Google'ın marka kurallarındaki çok renkli "G" (giriş düğmesinde zorunlu). */
function GoogleMark() {
    return (
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );
}
