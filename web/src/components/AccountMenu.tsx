import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, SignOut } from '@phosphor-icons/react';
import { signOut, useAuth } from '../lib/auth';

/**
 * Raydaki hesap düğmesi: adının baş harfi. Google profil fotoğrafını kullanmıyoruz;
 * her açılışta Google'a istek giderdi (gizlilik sayfasındaki sözle çelişir).
 */
export function AccountMenu() {
    const auth = useAuth();
    const [open, setOpen] = useState(false);
    const [leaving, setLeaving] = useState(false);
    const box = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const onDown = (e: PointerEvent) => box.current?.contains(e.target as Node) || setOpen(false);
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('pointerdown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('pointerdown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [open]);

    if (auth.status !== 'signed-in') return null;
    const { name, email } = auth.account;
    const initial = name.trim().charAt(0).toLocaleUpperCase('tr-TR') || '?';

    return (
        <div className="acct" ref={box}>
            <button className="acct__btn" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-label={`Hesap: ${name}`} title={name}>
                {initial}
            </button>
            {open && (
                <div className="acct__pop" role="menu">
                    <p className="acct__name">{name}</p>
                    <p className="acct__mail mono">{email}</p>
                    <Link to="/gizlilik" className="acct__item" role="menuitem" onClick={() => setOpen(false)}>
                        <ShieldCheck size={16} weight="bold" /> Gizlilik
                    </Link>
                    <button
                        className="acct__item acct__item--out"
                        role="menuitem"
                        disabled={leaving}
                        onClick={() => {
                            setLeaving(true);
                            void signOut();
                        }}
                    >
                        <SignOut size={16} weight="bold" /> {leaving ? 'Çıkılıyor…' : 'Çıkış yap'}
                    </button>
                </div>
            )}
        </div>
    );
}
