import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Editor } from '@tiptap/react';
import { Check, DotsSixVertical, Plus } from '@phosphor-icons/react';
import { db, type Clip } from '../../db/db';
import { clipToHtml, linkClipToNote } from '../../db/notes';
import { ago } from '../../lib/format';

export const CLIP_DRAG_TYPE = 'application/x-kesit-clip';

/** Notun yanındaki kesit çekmecesi: tıkla ya da sürükle → alıntı olarak eklenir. */
export function ClipDrawer({ noteId, editor }: { noteId: string; editor: Editor }) {
    const clips = useLiveQuery(() => db.clips.orderBy('createdAt').reverse().limit(200).toArray(), []);
    const [query, setQuery] = useState('');

    const list = useMemo(() => {
        const q = query.trim().toLocaleLowerCase('tr');
        if (!clips) return [];
        return q
            ? clips.filter((c) => `${c.text} ${c.comment ?? ''} ${c.domain ?? ''}`.toLocaleLowerCase('tr').includes(q))
            : clips;
    }, [clips, query]);

    const insert = async (clip: Clip) => {
        editor.chain().focus().insertContent(clipToHtml(clip)).run();
        await linkClipToNote(noteId, clip);
    };

    return (
        <aside className="drawer" aria-label="Kesitler">
            <div className="drawer__head">
                <p className="drawer__title">Kesitler</p>
                <p className="mono drawer__hint">tıkla ya da nota sürükle</p>
                <input
                    className="field drawer__search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ara…"
                    aria-label="Kesitlerde ara"
                />
            </div>
            <ul className="drawer__list">
                {list.map((c) => {
                    const inNote = c.noteIds.includes(noteId);
                    return (
                        <li
                            key={c.id}
                            className="mini"
                            data-c={c.color}
                            draggable
                            onDragStart={(e) => {
                                e.dataTransfer.setData('text/html', clipToHtml(c));
                                e.dataTransfer.setData('text/plain', c.text);
                                e.dataTransfer.setData(CLIP_DRAG_TYPE, c.id);
                                e.dataTransfer.effectAllowed = 'copy';
                            }}
                        >
                            <DotsSixVertical size={16} weight="bold" className="mini__grip" />
                            <div className="mini__body">
                                <p className="mini__meta mono">
                                    {c.domain || 'elle'} · {ago(c.createdAt)}
                                </p>
                                {c.kind === 'image' && c.imageUrl ? (
                                    <img className="mini__img" src={c.imageUrl} alt="" loading="lazy" />
                                ) : (
                                    <p className="mini__text">
                                        <span className="mark" data-c={c.color}>
                                            {c.text}
                                        </span>
                                    </p>
                                )}
                            </div>
                            <button
                                className="icon-btn mini__add"
                                onClick={() => insert(c)}
                                title={inNote ? 'Bu notta var — yine de ekle' : 'Nota ekle'}
                            >
                                {inNote ? <Check size={15} weight="bold" /> : <Plus size={15} weight="bold" />}
                            </button>
                        </li>
                    );
                })}
                {clips && clips.length === 0 && <li className="drawer__empty">Henüz kesit yok.</li>}
            </ul>
        </aside>
    );
}
