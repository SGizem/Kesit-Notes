import type { ReactNode } from 'react';
import { useEditorState, type Editor } from '@tiptap/react';
import {
    Code,
    HighlighterCircle,
    ListBullets,
    ListChecks,
    ListNumbers,
    Quotes,
    TextB,
    TextItalic,
    TextStrikethrough,
} from '@phosphor-icons/react';

/** Notlar ve dosya editörlerinin ortak biçim düğmeleri. */
export function FormatButtons({ editor }: { editor: Editor }) {
    const s = useEditorState({
        editor,
        selector: ({ editor: e }) => ({
            bold: e.isActive('bold'),
            italic: e.isActive('italic'),
            strike: e.isActive('strike'),
            h1: e.isActive('heading', { level: 1 }),
            h2: e.isActive('heading', { level: 2 }),
            bullet: e.isActive('bulletList'),
            ordered: e.isActive('orderedList'),
            task: e.isActive('taskList'),
            quote: e.isActive('blockquote'),
            mark: e.isActive('highlight'),
            code: e.isActive('codeBlock'),
        }),
    });
    const c = () => editor.chain().focus();

    return (
        <>
            <Tool on={s.h1} label="Büyük başlık" onClick={() => c().toggleHeading({ level: 1 }).run()}>
                <b className="tool-txt">B1</b>
            </Tool>
            <Tool on={s.h2} label="Ara başlık" onClick={() => c().toggleHeading({ level: 2 }).run()}>
                <b className="tool-txt">B2</b>
            </Tool>
            <span className="toolbar__sep" />
            <Tool on={s.bold} label="Kalın" onClick={() => c().toggleBold().run()}>
                <TextB size={17} weight="bold" />
            </Tool>
            <Tool on={s.italic} label="İtalik" onClick={() => c().toggleItalic().run()}>
                <TextItalic size={17} weight="bold" />
            </Tool>
            <Tool on={s.strike} label="Üstü çizili" onClick={() => c().toggleStrike().run()}>
                <TextStrikethrough size={17} weight="bold" />
            </Tool>
            <Tool on={s.mark} label="Fosforlu kalem" onClick={() => c().toggleHighlight().run()}>
                <HighlighterCircle size={17} weight="bold" />
            </Tool>
            <span className="toolbar__sep" />
            <Tool on={s.bullet} label="Madde listesi" onClick={() => c().toggleBulletList().run()}>
                <ListBullets size={17} weight="bold" />
            </Tool>
            <Tool on={s.ordered} label="Numaralı liste" onClick={() => c().toggleOrderedList().run()}>
                <ListNumbers size={17} weight="bold" />
            </Tool>
            <Tool on={s.task} label="Yapılacaklar" onClick={() => c().toggleTaskList().run()}>
                <ListChecks size={17} weight="bold" />
            </Tool>
            <Tool on={s.quote} label="Alıntı" onClick={() => c().toggleBlockquote().run()}>
                <Quotes size={17} weight="bold" />
            </Tool>
            <Tool on={s.code} label="Kod" onClick={() => c().toggleCodeBlock().run()}>
                <Code size={17} weight="bold" />
            </Tool>
        </>
    );
}

function Tool({ on, label, onClick, children }: { on: boolean; label: string; onClick: () => void; children: ReactNode }) {
    return (
        <button className="icon-btn" aria-pressed={on} aria-label={label} title={label} onClick={onClick}>
            {children}
        </button>
    );
}
