import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extension-placeholder';
import { Highlight } from '@tiptap/extension-highlight';
import { Image } from '@tiptap/extension-image';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import { TableKit } from '@tiptap/extension-table';

/** Notlar, Word ve Markdown editörlerinin ortak TipTap ayarları. */
export function editorExtensions(placeholder: string) {
    return [
        StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
        Placeholder.configure({ placeholder }),
        Highlight,
        Image,
        TaskList,
        TaskItem.configure({ nested: true }),
        // Word belgelerindeki tablolar (ders programı, takvim…) hücreleriyle korunur.
        TableKit.configure({ table: { resizable: false } }),
    ];
}
