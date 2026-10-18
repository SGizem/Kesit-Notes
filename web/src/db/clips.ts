import { db, newId, type Clip, type Marker, type StoredFile } from './db';
import { domainOf } from '../lib/format';
import { extractTags, mergeTags, normalizeTag } from '../lib/tags';

/** Eklentiden gelen ya da elle yazılan bir kesiti ekler/günceller. */
export async function upsertClip(input: Partial<Clip> & { id: string }) {
    const existing = await db.clips.get(input.id);
    const now = Date.now();
    if (existing) {
        await patchClip(input.id, input);
        return;
    }
    await db.clips.add({
        kind: 'text',
        text: '',
        color: 'lime',
        noteIds: [],
        createdAt: now,
        ...input,
        tags: mergeTags(input.tags, extractTags(input.comment)),
        updatedAt: now,
    } as Clip);
}

/**
 * Eklentiden gelen "put": sadece yoksa oluşturur. Kuyruk aynı işlemi iki kez
 * gönderebilir; ikinci gelişte uygulamada yapılan düzenlemeleri ezmemeli.
 */
export async function createClipIfMissing(input: Partial<Clip> & { id: string }) {
    if (await db.clips.get(input.id)) return;
    await upsertClip({ ...input, noteIds: [] });
}

/** Yorum değişirse içindeki #etiketler mevcut etiketlere eklenir (silinmez). */
export async function patchClip(id: string, patch: Partial<Clip>) {
    await db.transaction('rw', db.clips, async () => {
        const clip = await db.clips.get(id);
        if (!clip) return;
        const next: Partial<Clip> = { ...patch, updatedAt: Date.now() };
        if (patch.comment !== undefined) next.tags = mergeTags(patch.tags ?? clip.tags, extractTags(patch.comment));
        await db.clips.update(id, next);
    });
}

export async function addTag(clip: Clip, tag: string) {
    const t = normalizeTag(tag);
    if (!t || clip.tags.includes(t)) return;
    await db.clips.update(clip.id, { tags: [...clip.tags, t], updatedAt: Date.now() });
}

export async function removeTag(clip: Clip, tag: string) {
    await db.clips.update(clip.id, { tags: clip.tags.filter((t) => t !== tag), updatedAt: Date.now() });
}

export async function deleteClip(id: string) {
    await db.clips.delete(id);
}

/**
 * Uygulama içindeki bir dosyadan (PDF, Word, Excel, metin) kesit. Kaynağı açınca
 * dosya o sayfada açılır ve kesit vurgulanır; masada dosya adıyla görünür.
 */
export async function addFileClip(
    file: Pick<StoredFile, 'id' | 'name'>,
    input: { text: string; color: Marker; context?: string; page?: number },
): Promise<string> {
    const id = newId();
    const base = `${window.location.origin}/dosyalar/${file.id}`;
    const params = new URLSearchParams();
    if (input.page) params.set('sayfa', String(input.page));
    params.set('kesit', id);
    await upsertClip({
        id,
        kind: 'text',
        text: input.text.trim(),
        color: input.color,
        context: input.context,
        fileId: file.id,
        page: input.page,
        title: input.page ? `${file.name} · s. ${input.page}` : file.name,
        domain: file.name,
        url: base,
        fragmentUrl: `${base}?${params}`,
    });
    return id;
}

const URL_RE = /^https?:\/\/\S+$/i;

/** Masadaki hızlı giriş kutusundan gelen metin: URL ise bağlantı kesiti olur, #etiketler ayrılır. */
export async function addManualClip(raw: string, color: Marker = 'lime') {
    const text = raw.trim();
    if (!text) return;
    const isUrl = URL_RE.test(text);
    await upsertClip({
        id: newId(),
        kind: isUrl ? 'link' : 'manual',
        text,
        color,
        tags: extractTags(text),
        url: isUrl ? text : undefined,
        domain: isUrl ? domainOf(text) : undefined,
    });
}
