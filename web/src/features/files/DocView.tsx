import { useEffect, useMemo, useRef } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { marked } from 'marked';
import type { Clip, StoredFile } from '../../db/db';
import { saveFile } from '../../db/files';
import { htmlToMarkdown } from '../../lib/markdown';
import { htmlToPlain, escapeHtml } from '../../lib/format';
import { focusRange, paintMarks } from '../../lib/highlight';
import { SelectionCut, type Cut } from '../../components/SelectionCut';
import { editorExtensions } from '../editor/extensions';
import { FormatButtons } from '../editor/FormatToolbar';

const SAVE_DELAY = 500;

/**
 * Word (.docx), Markdown ve düz metin: aynı editörde düzenlenir.
 * - docx: içerik HTML olarak saklanır, istenince yeniden .docx'e yazılır.
 * - md: açılırken HTML'e çevrilir, her kayıtta tekrar Markdown'a yazılır.
 * - txt: her satır bir paragraf; biçim düğmeleri gizli, düz metin olarak saklanır.
 */
export function DocView({
    file,
    clips,
    focusId,
    onCut,
    setSaved,
}: {
    file: StoredFile;
    clips: Clip[];
    focusId: string | null;
    onCut: (cut: Cut) => unknown;
    setSaved: (saved: boolean) => void;
}) {
    const root = useRef<HTMLDivElement>(null);
    const plainText = file.kind === 'txt';

    // İlk içerik bir kez okunur; sonrası editörün kendi durumu.
    const initial = useMemo(() => {
        if (file.kind === 'docx') return file.html ?? '';
        if (file.kind === 'md') return marked.parse(file.text ?? '', { async: false });
        return linesToHtml(file.text ?? '');
        // Sadece dosya değişince: kaydedilen içerik editörü baştan yüklemesin.
    }, [file.id]);

    const timer = useRef<number>(undefined);
    const pending = useRef<string | null>(null);
    const flush = useRef(async () => {
        window.clearTimeout(timer.current);
        const html = pending.current;
        pending.current = null;
        if (html === null) return;
        if (file.kind === 'docx') await saveFile(file.id, { html, plain: htmlToPlain(html) });
        else if (file.kind === 'md') await saveFile(file.id, { text: htmlToMarkdown(html), plain: htmlToPlain(html) });
        else {
            const text = editorRef.current?.getText({ blockSeparator: '\n' }) ?? htmlToPlain(html);
            await saveFile(file.id, { text, plain: text.slice(0, 20000) });
        }
    }).current;
    const editorRef = useRef<ReturnType<typeof useEditor>>(null);

    const editor = useEditor({
        extensions: editorExtensions(plainText ? 'Boş metin dosyası…' : 'Bu belge boş. Yazmaya başla…'),
        content: initial,
        editorProps: { attributes: { class: plainText ? 'tiptap--plain' : '' } },
        onUpdate: ({ editor }) => {
            pending.current = editor.getHTML();
            setSaved(false);
            window.clearTimeout(timer.current);
            timer.current = window.setTimeout(() => void flush().then(() => setSaved(true)), SAVE_DELAY);
            repaintSoon();
        },
    });
    editorRef.current = editor;

    useEffect(() => () => void flush(), [flush]);

    // Kesitleri editörün içinde fosforla göster (yazdıkça yeniden boyanır).
    const ranges = useRef(new Map<string, Range>());
    const paintTimer = useRef<number>(undefined);
    const clipsRef = useRef(clips);
    clipsRef.current = clips;
    const repaintSoon = () => {
        window.clearTimeout(paintTimer.current);
        paintTimer.current = window.setTimeout(() => {
            const el = root.current?.querySelector('.tiptap');
            if (el) ranges.current = paintMarks(el, clipsRef.current.map(({ id, text, color }) => ({ id, text, color })));
        }, 300);
    };
    useEffect(repaintSoon, [clips, editor]);

    useEffect(() => {
        if (!focusId) return;
        const t = window.setTimeout(() => {
            const r = ranges.current.get(focusId);
            if (!r) return;
            (r.startContainer.parentElement as HTMLElement | null)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
            focusRange(r);
        }, 450);
        return () => window.clearTimeout(t);
    }, [focusId]);

    return (
        <div className="docview" ref={root}>
            {!plainText && editor && (
                <div className="toolbar toolbar--doc" role="toolbar" aria-label="Biçim">
                    <FormatButtons editor={editor} />
                </div>
            )}
            <article className={`sheet sheet--doc${plainText ? ' sheet--plain' : ''}`}>
                <EditorContent editor={editor} className="sheet__body" />
            </article>
            <SelectionCut root={root} onCut={onCut} />
        </div>
    );
}

/** Düz metin: her satır bir paragraf; boş satırlar korunur. */
function linesToHtml(text: string): string {
    return text
        .split(/\r?\n/)
        .map((l) => `<p>${escapeHtml(l)}</p>`)
        .join('');
}
