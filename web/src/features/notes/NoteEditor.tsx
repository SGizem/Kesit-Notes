import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { EditorContent, useEditor } from '@tiptap/react';
import { PushPin, Scissors, Trash } from '@phosphor-icons/react';
import { editorExtensions } from '../editor/extensions';
import { FormatButtons } from '../editor/FormatToolbar';
import { db } from '../../db/db';
import { deleteNote, linkClipIdToNote, saveNote } from '../../db/notes';
import { htmlToPlain } from '../../lib/format';
import { downloadDoc } from '../../lib/exportDoc';
import { DownloadMenu } from '../../components/DownloadMenu';
import { ClipDrawer, CLIP_DRAG_TYPE } from './ClipDrawer';

const SAVE_DELAY = 400;

export function NoteEditor({ noteId }: { noteId: string }) {
    const navigate = useNavigate();
    // undefined = yükleniyor, null = yok
    const note = useLiveQuery(async () => (await db.notes.get(noteId)) ?? null, [noteId]);

    if (note === undefined) return null;
    if (note === null) return <p className="notes__missing">Bu not bulunamadı.</p>;

    // Başlık ve içerik sadece ilk açılışta okunur; sonrası editörün kendi durumu.
    return (
        <LoadedEditor
            noteId={noteId}
            initialTitle={note.title}
            initialHtml={note.html}
            pinned={note.pinned === 1}
            onDeleted={() => navigate('/notlar')}
        />
    );
}

function LoadedEditor({
    noteId,
    initialTitle,
    initialHtml,
    pinned,
    onDeleted,
}: {
    noteId: string;
    initialTitle: string;
    initialHtml: string;
    pinned: boolean;
    onDeleted: () => void;
}) {
    const [title, setTitle] = useState(initialTitle);
    const [drawer, setDrawer] = useState(true);
    const [saved, setSaved] = useState(true);
    const titleRef = useRef<HTMLTextAreaElement>(null);

    // Kaydedilmeyi bekleyen değişiklikler. Sayfadan çıkarken de boşaltılır, yazı kaybolmaz.
    const pending = useRef<{ title?: string; html?: string }>({});
    const timer = useRef<number>(undefined);
    const flush = useRef(async () => {
        window.clearTimeout(timer.current);
        const { title: t, html } = pending.current;
        pending.current = {};
        if (t === undefined && html === undefined) return;
        await saveNote(noteId, {
            ...(t !== undefined && { title: t }),
            ...(html !== undefined && { html, plain: htmlToPlain(html) }),
        });
    }).current;
    const schedule = (patch: { title?: string; html?: string }) => {
        Object.assign(pending.current, patch);
        setSaved(false);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => void flush().then(() => setSaved(true)), SAVE_DELAY);
    };

    const editor = useEditor({
        extensions: editorExtensions('Yazmaya başla… ya da sağdaki kesitlerden birini ekle.'),
        content: initialHtml,
        onUpdate: ({ editor }) => schedule({ html: editor.getHTML() }),
        editorProps: {
            // Çekmeceden sürüklenen kesit: içeriği ProseMirror kendisi ekler, biz bağı kurarız.
            handleDrop: (_view, event) => {
                const clipId = event.dataTransfer?.getData(CLIP_DRAG_TYPE);
                if (clipId) void linkClipIdToNote(noteId, clipId);
                return false;
            },
        },
    });

    // Yeni boş not açıldığında imleç başlıkta başlasın; açılışta bir kez.
    const isBlank = useRef(!initialTitle && !initialHtml);
    useEffect(() => {
        if (isBlank.current) titleRef.current?.focus();
        return () => void flush();
    }, [flush]);

    const remove = async () => {
        if (!window.confirm('Bu not silinsin mi? Kesitler masada kalır.')) return;
        await deleteNote(noteId);
        onDeleted();
    };

    return (
        <div className={`editor-wrap${drawer ? ' with-drawer' : ''}`}>
            <div className="editor-main">
                <div className="toolbar" role="toolbar" aria-label="Biçim">
                    {editor && <FormatButtons editor={editor} />}
                    <span className="toolbar__spacer" />
                    <span className="toolbar__state mono">{saved ? 'kaydedildi' : 'yazılıyor…'}</span>
                    <button
                        className="icon-btn"
                        aria-pressed={pinned}
                        onClick={() => saveNote(noteId, { pinned: pinned ? 0 : 1 })}
                        title={pinned ? 'Sabitlemeyi kaldır' : 'Sabitle'}
                    >
                        <PushPin size={17} weight="bold" />
                    </button>
                    <DownloadMenu
                        compact
                        options={(['pdf', 'docx'] as const).map((format) => ({
                            label: format === 'pdf' ? 'PDF' : 'Word (.docx)',
                            kind: format,
                            run: () => downloadDoc(format, editor?.getHTML() ?? '', title.trim() || 'Adsız not'),
                        }))}
                    />
                    <button className="icon-btn" onClick={remove} title="Notu sil">
                        <Trash size={17} weight="bold" />
                    </button>
                    <button
                        className={`btn btn--sm${drawer ? ' btn--hi' : ''}`}
                        onClick={() => setDrawer((v) => !v)}
                        aria-pressed={drawer}
                    >
                        <Scissors size={14} weight="bold" /> Kesitler
                    </button>
                </div>

                <article className="sheet">
                    <textarea
                        ref={titleRef}
                        className="sheet__title"
                        rows={1}
                        value={title}
                        placeholder="Başlık"
                        onChange={(e) => {
                            setTitle(e.target.value);
                            schedule({ title: e.target.value });
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                editor?.commands.focus('start');
                            }
                        }}
                    />
                    <EditorContent editor={editor} className="sheet__body" />
                </article>
            </div>
            {drawer && editor && <ClipDrawer noteId={noteId} editor={editor} />}
        </div>
    );
}
