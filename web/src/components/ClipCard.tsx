import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowUpRight, FileText, Globe, NotePencil, TextAlignLeft, Trash, X } from '@phosphor-icons/react';
import { MARKERS, type Clip } from '../db/db';
import { addTag, deleteClip, patchClip, removeTag } from '../db/clips';
import { appendClipToNote, createNote } from '../db/notes';
import { clock } from '../lib/format';
import { NotePicker } from './NotePicker';

export function ClipCard({
    clip,
    onTag,
    flash,
}: {
    clip: Clip;
    /** Etikete tıklanınca (masada süzgeç olur). */
    onTag?: (tag: string) => void;
    /** Komut paletinden gelindiyse kart bir an yanıp söner. */
    flash?: boolean;
}) {
    const navigate = useNavigate();
    const [showContext, setShowContext] = useState(false);
    const [picking, setPicking] = useState(false);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [tagging, setTagging] = useState(false);
    const source = clip.fragmentUrl ?? clip.url;

    const toNote = async (noteId: string | null) => {
        setPicking(false);
        const id = noteId ?? (await createNote({ title: clip.title ?? '' })).id;
        await appendClipToNote(id, clip);
        navigate(`/notlar/${id}`);
    };

    return (
        <article
            id={`kesit-${clip.id}`}
            className={`clip${flash ? ' clip--flash' : ''}`}
            data-c={clip.color}
            data-kind={clip.kind}
        >
            <header className="clip__head mono">
                {clip.fileId ? (
                    <FileText size={14} weight="bold" />
                ) : clip.favicon ? (
                    <img className="clip__fav" src={clip.favicon} alt="" loading="lazy" />
                ) : (
                    <Globe size={14} weight="bold" />
                )}
                <span className="clip__domain">{clip.domain || (clip.kind === 'manual' ? 'elle yazıldı' : 'kaynak yok')}</span>
                <span className="clip__time">{clock(clip.createdAt)}</span>
            </header>

            {(clip.kind === 'image' || clip.kind === 'page') && clip.imageUrl && (
                <img className="clip__img" src={clip.imageUrl} alt={clip.text} loading="lazy" />
            )}

            {clip.text && clip.kind !== 'image' && (
                <blockquote className={`clip__quote${clip.kind === 'link' ? ' clip__quote--link' : ''}`}>
                    <span className="mark" data-c={clip.color}>
                        {/* Paragraflar arası boş satır, fosforda boş bir leke bırakmasın */}
                        {clip.text.replace(/\n\s*\n+/g, '\n')}
                    </span>
                </blockquote>
            )}

            {clip.comment && <p className="clip__comment">{clip.comment}</p>}

            {showContext && clip.context && <Context context={clip.context} text={clip.text} color={clip.color} />}

            <div className="tags">
                {clip.tags.map((t) => (
                    <span key={t} className="tag">
                        <button className="tag__name" onClick={() => onTag?.(t)} title={`#${t} ile süz`}>
                            #{t}
                        </button>
                        <button className="tag__x" onClick={() => removeTag(clip, t)} aria-label={`#${t} etiketini kaldır`}>
                            <X size={10} weight="bold" />
                        </button>
                    </span>
                ))}
                {tagging ? (
                    <input
                        className="tag__input"
                        autoFocus
                        placeholder="etiket"
                        onBlur={() => setTagging(false)}
                        onKeyDown={(e) => {
                            const v = e.currentTarget.value;
                            if (e.key === 'Escape') setTagging(false);
                            if ((e.key === 'Enter' || e.key === ' ' || e.key === ',') && v.trim()) {
                                e.preventDefault();
                                void addTag(clip, v);
                                e.currentTarget.value = '';
                            }
                        }}
                    />
                ) : (
                    <button className="tag tag--add" onClick={() => setTagging(true)}>
                        + etiket
                    </button>
                )}
            </div>

            <footer className="clip__foot">
                {clip.title && (
                    <span className="clip__title" title={clip.title}>
                        {clip.title}
                    </span>
                )}
                {clip.noteIds.length > 0 && <span className="clip__chip mono">{clip.noteIds.length} notta</span>}

                <div className="clip__actions">
                    <div className="clip__swatches" role="group" aria-label="Kalem rengi">
                        {MARKERS.map((m) => (
                            <button
                                key={m}
                                className="swatch"
                                data-c={m}
                                aria-pressed={clip.color === m}
                                aria-label={m}
                                onClick={() => patchClip(clip.id, { color: m })}
                            />
                        ))}
                    </div>
                    {clip.context && (
                        <button
                            className="icon-btn"
                            aria-pressed={showContext}
                            onClick={() => setShowContext((v) => !v)}
                            title="Bağlamı göster"
                        >
                            <TextAlignLeft size={16} weight="bold" />
                        </button>
                    )}
                    {clip.fileId ? (
                        <Link
                            className="icon-btn"
                            to={`/dosyalar/${clip.fileId}?${clip.page ? `sayfa=${clip.page}&` : ''}kesit=${clip.id}`}
                            title="Dosyada aç"
                        >
                            <ArrowUpRight size={16} weight="bold" />
                        </Link>
                    ) : source && (
                        <a className="icon-btn" href={source} target="_blank" rel="noreferrer" title="Kaynakta aç">
                            <ArrowUpRight size={16} weight="bold" />
                        </a>
                    )}
                    <span className="clip__picker-anchor">
                        <button className="icon-btn" onClick={() => setPicking((v) => !v)} title="Nota ekle">
                            <NotePencil size={16} weight="bold" />
                        </button>
                        {picking && <NotePicker onPick={toNote} onClose={() => setPicking(false)} />}
                    </span>
                    <button
                        className={`icon-btn${confirmDelete ? ' icon-btn--danger' : ''}`}
                        onClick={() => (confirmDelete ? deleteClip(clip.id) : setConfirmDelete(true))}
                        onBlur={() => setConfirmDelete(false)}
                        title={confirmDelete ? 'Silmek için tekrar tıkla' : 'Sil'}
                    >
                        <Trash size={16} weight="bold" />
                    </button>
                </div>
            </footer>
        </article>
    );
}

function Context({ context, text, color }: { context: string; text: string; color: string }) {
    const i = context.indexOf(text);
    return (
        <p className="clip__context">
            {i === -1 ? (
                context
            ) : (
                <>
                    {context.slice(0, i)}
                    <span className="mark" data-c={color}>
                        {text}
                    </span>
                    {context.slice(i + text.length)}
                </>
            )}
        </p>
    );
}
