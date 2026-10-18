import { NavLink, Outlet } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ChatsCircle, FileText, MagnifyingGlass, Moon, NotePencil, Scissors, Sun } from '@phosphor-icons/react';
import { useEffect, useState, type ReactNode } from 'react';
import { CommandPalette } from './CommandPalette';
import { Toasts } from './Toasts';
import { db } from '../db/db';
import { dayKey } from '../lib/format';
import { useBridgeStatus } from '../bridge/extensionBridge';
import { useTheme } from '../lib/useTheme';
import { BRAND, FEATURES } from '../lib/brand';

const BRIDGE_TITLE = {
    checking: 'Eklenti aranıyor…',
    connected: 'Eklenti bağlı',
    missing: 'Eklenti bağlı değil',
} as const;

export function Shell() {
    const todayCount = useLiveQuery(
        () => db.clips.where('createdAt').aboveOrEqual(dayKey(Date.now())).count(),
        [],
        0,
    );
    const { status } = useBridgeStatus();
    const { theme, toggle } = useTheme();
    const [palette, setPalette] = useState(false);

    // Ctrl+K / ⌘K her yerden; editörün içindeyken de çalışsın diye yakalama evresinde.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                e.stopPropagation();
                setPalette((v) => !v);
            }
        };
        window.addEventListener('keydown', onKey, true);
        return () => window.removeEventListener('keydown', onKey, true);
    }, []);

    return (
        <div className="shell">
            <aside className="rail" aria-label="Ana menü">
                <NavLink to="/" className="rail__logo" aria-label={BRAND.name}>
                    <img src="/kesit.svg" alt="" />
                </NavLink>
                <nav className="rail__nav">
                    <Spine to="/" icon={<Scissors size={22} weight="bold" />} label="Masa" badge={todayCount} />
                    <Spine to="/notlar" icon={<NotePencil size={22} weight="bold" />} label="Notlar" />
                    <Spine to="/dosyalar" icon={<FileText size={22} weight="bold" />} label="Dosyalar" />
                    {FEATURES.sor && <Spine to="/sor" icon={<ChatsCircle size={22} weight="bold" />} label="Sor" />}
                </nav>
                <div className="rail__foot">
                    <button className="icon-btn" onClick={() => setPalette(true)} aria-label="Ara (Ctrl+K)" title="Ara (Ctrl+K)">
                        <MagnifyingGlass size={18} weight="bold" />
                    </button>
                    <span className="ext-dot" data-s={status} title={BRIDGE_TITLE[status]} />
                    <button
                        className="icon-btn"
                        onClick={(e) => {
                            const r = e.currentTarget.getBoundingClientRect();
                            toggle({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
                        }}
                        aria-label={theme === 'dark' ? 'Gündüz moduna geç' : 'Gece moduna geç'}
                    >
                        {theme === 'dark' ? <Sun size={18} weight="bold" /> : <Moon size={18} weight="bold" />}
                    </button>
                </div>
            </aside>
            <main className="page">
                <Outlet />
            </main>
            {palette && <CommandPalette onClose={() => setPalette(false)} onToggleTheme={() => toggle()} />}
            <Toasts />
        </div>
    );
}

function Spine({
    to,
    icon,
    label,
    badge,
    soon,
}: {
    to?: string;
    icon: ReactNode;
    label: string;
    badge?: number;
    soon?: string;
}) {
    const body = (
        <>
            {icon}
            <span className="spine__label">{label}</span>
            {soon && <span className="spine__soon">{soon}</span>}
            {!!badge && <span className="spine__badge">{badge}</span>}
        </>
    );
    if (!to) {
        return (
            <span className="spine" aria-disabled="true" title={`${label} — yakında`}>
                {body}
            </span>
        );
    }
    return (
        <NavLink to={to} end={to === '/'} className={({ isActive }) => `spine${isActive ? ' active' : ''}`}>
            {body}
        </NavLink>
    );
}
