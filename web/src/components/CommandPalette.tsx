import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FEATURES } from '../lib/brand';
import { useLiveQuery } from 'dexie-react-hooks';
import {
    ArrowCounterClockwise,
    ChatsCircle,
    CircleHalf,
    DownloadSimple,
    FileDoc,
    FilePdf,
    FilePlus,
    FileText,
    Hash,
    NotePencil,
    Plus,
    Scissors,
    ShieldCheck,
} from '@phosphor-icons/react';
import { db, type Marker } from '../db/db';
import { createNote } from '../db/notes';
import { exportBackup, importBackup } from '../db/backup';
import { downloadClips } from '../lib/exportDoc';
import { ago } from '../lib/format';
import { score } from '../lib/search';
import { toast } from '../lib/toast';

type Group = 'Komutlar' | 'Notlar' | 'Dosyalar' | 'Kesitler' | 'Etiketler' | 'Sor';
const GROUPS: Group[] = ['Komutlar', 'Notlar', 'Dosyalar', 'Kesitler', 'Etiketler', 'Sor'];
const PER_GROUP = 6;

interface Item {
    key: string;
    group: Group;
    label: string;
    sub?: string;
    color?: Marker;
    icon: ReactNode;
    score: number;
    run: () => unknown;
}

export function CommandPalette({ onClose, onToggleTheme }: { onClose: () => void; onToggleTheme: () => void }) {
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const [active, setActive] = useState(0);
    const listRef = useRef<HTMLUListElement>(null);
    const clips = useLiveQuery(() => db.clips.orderBy('createdAt').reverse().toArray(), []);
    const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), []);
    const files = useLiveQuery(() => db.files.orderBy('updatedAt').reverse().toArray(), []);

    const go = (to: string) => () => navigate(to);

    const items = useMemo<Item[]>(() => {
        const q = query.trim().replace(/^#/, '');
        const out: Item[] = [];
        const add = (item: Omit<Item, 'score'>, title: string, body = '') => {
            const s = score(q, title, body);
            if (s) out.push({ ...item, score: s });
        };

        // Yazılan her şey Kesit'e soru olarak da sorulabilir (listenin sonunda; eşleşme yoksa tek seçenek).
        if (FEATURES.sor && query.trim().length >= 4) {
            out.push({
                key: 'cmd:ask',
                group: 'Sor',
                label: `Kesit'e sor: “${query.trim()}”`,
                icon: <ChatsCircle size={16} weight="bold" />,
                score: 1000,
                run: () => navigate(`/sor?q=${encodeURIComponent(query.trim())}`),
            });
        }

        const commands: [string, ReactNode, () => unknown, string?][] = [
            ...(FEATURES.sor
                ? [['Kesit\'e sor', <ChatsCircle key="i" size={16} weight="bold" />, go('/sor'), 'soru sohbet yapay zeka asistan'] as [string, ReactNode, () => unknown, string]]
                : []),
            ['Yeni not', <Plus key="i" size={16} weight="bold" />, async () => navigate(`/notlar/${(await createNote()).id}`), 'not oluştur ekle'],
            ['Masaya git', <Scissors key="i" size={16} weight="bold" />, go('/'), 'ana sayfa kesitler'],
            ['Notlara git', <NotePencil key="i" size={16} weight="bold" />, go('/notlar')],
            ['Dosya ekle', <FilePlus key="i" size={16} weight="bold" />, go('/dosyalar?ekle=1'), 'yükle pdf word excel csv txt md içe aktar'],
            ['Dosyalara git', <FileText key="i" size={16} weight="bold" />, go('/dosyalar'), 'pdf word excel belge'],
            ['Gece / gündüz modu', <CircleHalf key="i" size={16} weight="bold" />, onToggleTheme, 'tema karanlık aydınlık'],
            [
                'Tüm kesitleri PDF olarak indir',
                <FilePdf key="i" size={16} weight="bold" />,
                async () => downloadClips('pdf', await db.clips.orderBy('createdAt').reverse().toArray(), 'Tüm kesitler'),
                'dışa aktar export pdf yazdır',
            ],
            [
                'Tüm kesitleri Word olarak indir',
                <FileDoc key="i" size={16} weight="bold" />,
                async () => downloadClips('docx', await db.clips.orderBy('createdAt').reverse().toArray(), 'Tüm kesitler'),
                'dışa aktar export docx belge',
            ],
            [
                'Yedek indir (JSON)',
                <DownloadSimple key="i" size={16} weight="bold" />,
                async () => {
                    const r = await exportBackup();
                    toast(`Yedek indirildi: ${r.clips} kesit, ${r.notes} not`);
                },
                'yedekle backup dışa aktar',
            ],
            [
                'Yedekten geri yükle',
                <ArrowCounterClockwise key="i" size={16} weight="bold" />,
                async () => {
                    try {
                        const r = await importBackup();
                        if (r) toast(`Geri yüklendi: ${r.clips} kesit, ${r.notes} not`);
                    } catch (err) {
                        toast(err instanceof Error ? err.message : 'Yedek okunamadı', 'error');
                    }
                },
                'içe aktar import restore',
            ],
            ['Gizlilik', <ShieldCheck key="i" size={16} weight="bold" />, go('/gizlilik'), 'gizlilik politikası veri izinler privacy'],
        ];
        for (const [label, icon, run, keywords] of commands) {
            add({ key: `cmd:${label}`, group: 'Komutlar', label, icon, run }, label, keywords);
        }

        for (const n of notes ?? []) {
            add(
                {
                    key: `note:${n.id}`,
                    group: 'Notlar',
                    label: n.title || 'Adsız not',
                    sub: ago(n.updatedAt),
                    icon: <NotePencil size={16} weight="bold" />,
                    run: go(`/notlar/${n.id}`),
                },
                n.title,
                n.plain,
            );
        }

        for (const f of files ?? []) {
            add(
                {
                    key: `file:${f.id}`,
                    group: 'Dosyalar',
                    label: f.name,
                    sub: ago(f.updatedAt),
                    icon: <FileText size={16} weight="bold" />,
                    run: go(`/dosyalar/${f.id}`),
                },
                f.name,
                f.plain ?? '',
            );
        }

        const tagCounts = new Map<string, number>();
        for (const c of clips ?? []) {
            c.tags.forEach((t) => tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1));
            add(
                {
                    key: `clip:${c.id}`,
                    group: 'Kesitler',
                    label: c.text || c.imageUrl || '',
                    sub: c.domain || 'elle',
                    color: c.color,
                    icon: <Scissors size={16} weight="bold" />,
                    run: go(`/?kesit=${c.id}`),
                },
                c.text,
                [c.comment, c.title, c.domain, ...c.tags].filter(Boolean).join(' '),
            );
        }
        for (const [t, n] of tagCounts) {
            add(
                {
                    key: `tag:${t}`,
                    group: 'Etiketler',
                    label: `#${t}`,
                    sub: `${n} kesit`,
                    icon: <Hash size={16} weight="bold" />,
                    run: go(`/?etiket=${encodeURIComponent(t)}`),
                },
                t,
            );
        }

        // Grup sırası sabit; grup içinde puana göre (boş sorguda tarih sırası korunur).
        return GROUPS.flatMap((g) =>
            out
                .filter((i) => i.group === g)
                .sort((a, b) => b.score - a.score)
                .slice(0, q ? PER_GROUP : g === 'Komutlar' ? 9 : 4),
        );
    }, [query, clips, notes, files]); // navigate/onToggleTheme kararlı

    useEffect(() => setActive(0), [query]);
    useEffect(() => {
        listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
    }, [active]);

    const run = (item: Item | undefined) => {
        if (!item) return;
        onClose();
        void item.run();
    };

    const onKey = (e: React.KeyboardEvent) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setActive((a) => (a + 1) % Math.max(items.length, 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => (a - 1 + items.length) % Math.max(items.length, 1));
        } else if (e.key === 'Enter') {
            e.preventDefault();
            run(items[active]);
        } else if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
        }
    };

    let lastGroup: Group | null = null;

    return (
        <div className="palette-backdrop" onMouseDown={onClose}>
            <div
                className="palette"
                role="dialog"
                aria-modal="true"
                aria-label="Komut paleti"
                onMouseDown={(e) => e.stopPropagation()}
                onKeyDown={onKey}
            >
                <input
                    className="palette__input"
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ara ya da bir komut yaz…"
                    role="combobox"
                    aria-expanded="true"
                    aria-controls="palette-list"
                    aria-activedescendant={items[active] ? `pi-${active}` : undefined}
                />
                <ul className="palette__list" id="palette-list" role="listbox" ref={listRef}>
                    {items.map((item, i) => {
                        const header = item.group !== lastGroup ? item.group : null;
                        lastGroup = item.group;
                        return (
                            <li key={item.key} role="presentation">
                                {header && <p className="palette__group mono">{header}</p>}
                                <button
                                    id={`pi-${i}`}
                                    data-i={i}
                                    role="option"
                                    aria-selected={i === active}
                                    className="palette__item"
                                    onMouseMove={() => setActive(i)}
                                    onClick={() => run(item)}
                                >
                                    <span className="palette__icon">{item.icon}</span>
                                    <span className="palette__label">
                                        {item.color ? (
                                            <span className="mark" data-c={item.color}>
                                                {item.label}
                                            </span>
                                        ) : (
                                            item.label
                                        )}
                                    </span>
                                    {item.sub && <span className="palette__sub mono">{item.sub}</span>}
                                </button>
                            </li>
                        );
                    })}
                    {items.length === 0 && <li className="palette__none">“{query}” için bir şey bulunamadı.</li>}
                </ul>
                <p className="palette__foot mono">
                    <span>↑↓ gez</span>
                    <span>↵ aç</span>
                    <span>esc kapat</span>
                </p>
            </div>
        </div>
    );
}
