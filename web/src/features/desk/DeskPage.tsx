import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { MagnifyingGlass, X } from '@phosphor-icons/react';
import { db, MARKERS, type Clip, type Marker } from '../../db/db';
import { dayKey, dayLabel } from '../../lib/format';
import { downloadClips } from '../../lib/exportDoc';
import { ClipCard } from '../../components/ClipCard';
import { DownloadMenu, type DownloadOption } from '../../components/DownloadMenu';
import { useBridgeStatus } from '../../bridge/extensionBridge';
import { Masthead } from './Masthead';
import { QuickCapture } from './QuickCapture';
import { Resurface } from './Resurface';
import { EmptyDesk, ExtensionBanner } from './EmptyDesk';

export function DeskPage() {
    const clips = useLiveQuery(() => db.clips.orderBy('createdAt').reverse().toArray(), []);
    const { status } = useBridgeStatus();
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = useState('');
    const [color, setColor] = useState<Marker | null>(null);
    const [domain, setDomain] = useState<string | null>(null);

    // Etiket ve odaklanan kesit adreste durur: komut paleti buraya bağlanır, geri tuşu çalışır.
    const tag = params.get('etiket');
    const focusId = params.get('kesit');
    const setTag = (t: string | null) =>
        setParams((p) => {
            p.delete('kesit');
            if (t) p.set('etiket', t);
            else p.delete('etiket');
            return p;
        });

    useEffect(() => {
        if (!focusId || !clips) return;
        document.getElementById(`kesit-${focusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, [focusId, clips]);

    const counts = useMemo(() => {
        const domains = new Map<string, number>();
        const tags = new Map<string, number>();
        clips?.forEach((c) => {
            if (c.domain) domains.set(c.domain, (domains.get(c.domain) ?? 0) + 1);
            c.tags.forEach((t) => tags.set(t, (tags.get(t) ?? 0) + 1));
        });
        const top = (m: Map<string, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
        return { domains: top(domains, 8), tags: top(tags, 12) };
    }, [clips]);

    const filtered = useMemo(() => {
        if (!clips) return [];
        const q = query.trim().toLocaleLowerCase('tr');
        return clips.filter(
            (c) =>
                (!color || c.color === color) &&
                (!domain || c.domain === domain) &&
                (!tag || c.tags.includes(tag)) &&
                (!q ||
                    [c.text, c.comment, c.title, c.domain, ...c.tags]
                        .filter(Boolean)
                        .some((s) => s!.toLocaleLowerCase('tr').includes(q))),
        );
    }, [clips, query, color, domain, tag]);

    const days = useMemo(() => groupByDay(filtered), [filtered]);
    const filtering = !!(query || color || domain || tag);

    // Görünen (süzülmüş) kesitler indirilir.
    const heading = tag ? `#${tag}` : domain ?? 'Kesitler';
    const downloads: DownloadOption[] = [
        { label: 'PDF', kind: 'pdf', run: () => downloadClips('pdf', filtered, heading) },
        { label: 'Word (.docx)', kind: 'docx', run: () => downloadClips('docx', filtered, heading) },
    ];

    if (!clips) return null;

    return (
        <div className="desk">
            <Masthead clips={clips} />
            {status === 'missing' && <ExtensionBanner />}
            <QuickCapture />

            {clips.length === 0 ? (
                <EmptyDesk />
            ) : (
                <>
                    {!filtering && !focusId && <Resurface clips={clips} />}

                    <div className="filters" role="search">
                        <label className="filters__search">
                            <MagnifyingGlass size={16} weight="bold" />
                            <span className="visually-hidden">Kesitlerde ara</span>
                            <input
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="Kesitlerde ara…"
                            />
                        </label>
                        <div className="filters__swatches" role="group" aria-label="Renge göre süz">
                            {MARKERS.map((m) => (
                                <button
                                    key={m}
                                    className="swatch"
                                    data-c={m}
                                    aria-pressed={color === m}
                                    aria-label={m}
                                    onClick={() => setColor(color === m ? null : m)}
                                />
                            ))}
                        </div>
                        <div className="filters__domains">
                            {counts.domains.map(([d, n]) => (
                                <button
                                    key={d}
                                    className="chip"
                                    aria-pressed={domain === d}
                                    onClick={() => setDomain(domain === d ? null : d)}
                                >
                                    {d} <span className="chip__n">{n}</span>
                                </button>
                            ))}
                        </div>
                        <span className="filters__spacer" />
                        {filtering && (
                            <button
                                className="btn btn--ghost btn--sm"
                                onClick={() => {
                                    setQuery('');
                                    setColor(null);
                                    setDomain(null);
                                    setTag(null);
                                }}
                            >
                                <X size={14} weight="bold" /> Temizle
                            </button>
                        )}
                        <DownloadMenu options={downloads} disabled={filtered.length === 0} />
                        {counts.tags.length > 0 && (
                            <div className="filters__tags" role="group" aria-label="Etikete göre süz">
                                {counts.tags.map(([t, n]) => (
                                    <button
                                        key={t}
                                        className="chip chip--tag"
                                        aria-pressed={tag === t}
                                        onClick={() => setTag(tag === t ? null : t)}
                                    >
                                        #{t} <span className="chip__n">{n}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    {days.length === 0 && <p className="desk__none">Bu süzgeçle eşleşen kesit yok.</p>}

                    {days.map(([key, items]) => (
                        <section key={key} className="day">
                            <h2 className="day__rule">
                                <span>{dayLabel(key)}</span>
                                <span className="mono">{items.length} kesit</span>
                            </h2>
                            <div className="board">
                                {items.map((c) => (
                                    <ClipCard key={c.id} clip={c} onTag={setTag} flash={c.id === focusId} />
                                ))}
                            </div>
                        </section>
                    ))}
                </>
            )}
        </div>
    );
}

function groupByDay(clips: Clip[]): [number, Clip[]][] {
    const map = new Map<number, Clip[]>();
    for (const c of clips) {
        const k = dayKey(c.createdAt);
        const list = map.get(k);
        if (list) list.push(c);
        else map.set(k, [c]);
    }
    return [...map.entries()];
}
