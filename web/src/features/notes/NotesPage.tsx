import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { MagnifyingGlass, Plus, PushPin } from '@phosphor-icons/react';
import { db } from '../../db/db';
import { createNote } from '../../db/notes';
import { ago } from '../../lib/format';
import { NoteEditor } from './NoteEditor';

export function NotesPage() {
    const { noteId } = useParams();
    const navigate = useNavigate();
    const [query, setQuery] = useState('');
    const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().toArray(), []);

    const list = useMemo(() => {
        if (!notes) return [];
        const q = query.trim().toLocaleLowerCase('tr');
        const hits = q
            ? notes.filter((n) => `${n.title} ${n.plain}`.toLocaleLowerCase('tr').includes(q))
            : notes;
        return [...hits].sort((a, b) => b.pinned - a.pinned);
    }, [notes, query]);

    const newNote = async () => {
        const n = await createNote();
        navigate(`/notlar/${n.id}`);
    };

    return (
        <div className="notes">
            <aside className="notes__index">
                <div className="notes__top">
                    <h1 className="notes__h">Notlar</h1>
                    <button className="btn btn--hi btn--sm" onClick={newNote}>
                        <Plus size={14} weight="bold" /> Yeni
                    </button>
                </div>
                <label className="notes__search">
                    <MagnifyingGlass size={15} weight="bold" />
                    <span className="visually-hidden">Notlarda ara</span>
                    <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Notlarda ara…" />
                </label>
                <ul className="notes__list">
                    {list.map((n) => (
                        <li key={n.id}>
                            <Link
                                to={`/notlar/${n.id}`}
                                className={`card-row${n.id === noteId ? ' active' : ''}`}
                            >
                                <span className="card-row__title">
                                    {n.pinned === 1 && <PushPin size={12} weight="fill" />}
                                    {n.title || 'Adsız not'}
                                </span>
                                <span className="card-row__preview">{n.plain.slice(0, 90) || 'Boş'}</span>
                                <span className="card-row__meta mono">{ago(n.updatedAt)}</span>
                            </Link>
                        </li>
                    ))}
                    {notes && notes.length === 0 && (
                        <li className="notes__empty-list">Henüz not yok. Masadaki bir kesitten de başlayabilirsin.</li>
                    )}
                </ul>
            </aside>

            <section className="notes__sheet">
                {noteId ? (
                    <NoteEditor key={noteId} noteId={noteId} />
                ) : (
                    <div className="notes__blank">
                        <p className="notes__blank-big">
                            Bir not seç
                            <br />
                            ya da <span className="mark">yenisini</span> aç.
                        </p>
                        <button className="btn btn--hi" onClick={newNote}>
                            <Plus size={16} weight="bold" /> Yeni not
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
