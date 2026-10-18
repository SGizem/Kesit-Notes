import { db, newId, type Clip, type Note } from './db';
import { escapeHtml } from '../lib/format';

export async function createNote(seed: Partial<Note> = {}): Promise<Note> {
    const now = Date.now();
    const note: Note = {
        id: newId(),
        title: '',
        html: '',
        plain: '',
        pinned: 0,
        createdAt: now,
        updatedAt: now,
        ...seed,
    };
    await db.notes.add(note);
    return note;
}

export async function saveNote(id: string, patch: Partial<Pick<Note, 'title' | 'html' | 'plain' | 'pinned'>>) {
    await db.notes.update(id, { ...patch, updatedAt: Date.now() });
}

export async function deleteNote(id: string) {
    await db.transaction('rw', db.notes, db.clips, async () => {
        await db.notes.delete(id);
        const linked = await db.clips.where('noteIds').equals(id).toArray();
        for (const c of linked) {
            await db.clips.update(c.id, { noteIds: c.noteIds.filter((n) => n !== id) });
        }
    });
}

/** Kesitin nota eklenecek hali: alıntı + kaynak künyesi. */
export function clipToHtml(clip: Clip): string {
    const source = clip.fragmentUrl ?? clip.url;
    const label = [clip.title, clip.domain].filter(Boolean).join(' · ');
    const cite = source
        ? `<p><a href="${escapeHtml(source)}">— ${escapeHtml(label || source)}</a></p>`
        : '';
    if (clip.kind === 'image' && clip.imageUrl) {
        return `<blockquote><img src="${escapeHtml(clip.imageUrl)}" alt="${escapeHtml(clip.text)}">${cite}</blockquote><p></p>`;
    }
    const body = escapeHtml(clip.text).replace(/\n+/g, '</p><p>');
    const comment = clip.comment ? `<p><em>${escapeHtml(clip.comment)}</em></p>` : '';
    return `<blockquote><p><mark>${body}</mark></p>${cite}</blockquote>${comment}<p></p>`;
}

/** Kesiti notun sonuna ekler ve kesit ↔ not bağını kurar. */
export async function appendClipToNote(noteId: string, clip: Clip) {
    await db.transaction('rw', db.notes, db.clips, async () => {
        const note = await db.notes.get(noteId);
        if (!note) return;
        const html = note.html + clipToHtml(clip);
        await db.notes.update(noteId, {
            html,
            plain: `${note.plain}\n${clip.text}`,
            updatedAt: Date.now(),
        });
        if (!clip.noteIds.includes(noteId)) {
            await db.clips.update(clip.id, { noteIds: [...clip.noteIds, noteId] });
        }
    });
}

export async function linkClipToNote(noteId: string, clip: Clip) {
    if (clip.noteIds.includes(noteId)) return;
    await db.clips.update(clip.id, { noteIds: [...clip.noteIds, noteId] });
}

export async function linkClipIdToNote(noteId: string, clipId: string) {
    const clip = await db.clips.get(clipId);
    if (clip) await linkClipToNote(noteId, clip);
}
