import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck, SignOut, Trash } from '@phosphor-icons/react';
import { deleteAccount, signOut, useAuth } from '../lib/auth';
import { toast } from '../lib/toast';

/**
 * Raydaki hesap düğmesi: adının baş harfi. Google profil fotoğrafını kullanmıyoruz;
 * her açılışta Google'a istek giderdi (gizlilik sayfasındaki sözle çelişir).
 */
export function AccountMenu() {
    const auth = useAuth();
    const [open, setOpen] = useState(false);
    const [leaving, setLeaving] = useState<false | 'out' | 'delete'>(false);
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
    const { name, email, dev } = auth.account;

    const onDelete = async () => {
        const ok = window.confirm(
            'Hesabın kalıcı olarak silinsin mi?\n\n' +
                'Hesap kaydın ve bu tarayıcıdaki bütün kesitlerin, notların ve dosyaların silinir. Bu geri alınamaz.\n\n' +
                'Önce yedek almak istersen Vazgeç’e bas, sonra Ctrl+K → "Yedek indir".',
        );
        if (!ok) return;
        setLeaving('delete');
        try {
            await deleteAccount();
        } catch (e) {
            setLeaving(false);
            toast((e as Error).message, 'error');
        }
    };
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
                        disabled={Boolean(leaving)}
                        onClick={() => {
                            setLeaving('out');
                            void signOut();
                        }}
                    >
                        <SignOut size={16} weight="bold" /> {leaving === 'out' ? 'Çıkılıyor…' : 'Çıkış yap'}
                    </button>
                    {!dev && (
                        <button className="acct__item acct__item--del" role="menuitem" disabled={Boolean(leaving)} onClick={() => void onDelete()}>
                            <Trash size={16} weight="bold" /> {leaving === 'delete' ? 'Siliniyor…' : 'Hesabımı sil'}
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
