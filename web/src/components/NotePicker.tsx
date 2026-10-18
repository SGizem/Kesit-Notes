import { useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Plus } from '@phosphor-icons/react';
import { db } from '../db/db';
import { ago } from '../lib/format';

/** "Hangi nota eklensin?" açılır listesi. null = yeni not. */
export function NotePicker({ onPick, onClose }: { onPick: (noteId: string | null) => void; onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    const notes = useLiveQuery(() => db.notes.orderBy('updatedAt').reverse().limit(8).toArray(), []);

    useEffect(() => {
        const onDown = (e: MouseEvent) => {
            if (!ref.current?.contains(e.target as Node)) onClose();
        };
        const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
        document.addEventListener('mousedown', onDown);
        document.addEventListener('keydown', onKey);
        return () => {
            document.removeEventListener('mousedown', onDown);
            document.removeEventListener('keydown', onKey);
        };
    }, [onClose]);

    return (
        <div className="picker" ref={ref} role="menu">
            <p className="picker__head mono">Nota ekle</p>
            <button className="picker__item picker__item--new" role="menuitem" onClick={() => onPick(null)}>
                <Plus size={14} weight="bold" /> Yeni not
            </button>
            {notes?.map((n) => (
                <button key={n.id} className="picker__item" role="menuitem" onClick={() => onPick(n.id)}>
                    <span className="picker__title">{n.title || 'Adsız not'}</span>
                    <span className="mono picker__meta">{ago(n.updatedAt)}</span>
                </button>
            ))}
        </div>
    );
}
