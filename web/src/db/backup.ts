import { db, type Clip, type Note } from './db';
import { downloadText, pickFile, today } from '../lib/download';
import { mergeTags } from '../lib/tags';

/**
 * Veriler sadece bu tarayıcıda durduğu için yedek, kullanıcının tek güvencesi.
 * Biçim: { app: 'kesit', version, exportedAt, clips, notes }
 */
const FORMAT_VERSION = 1;

export async function exportBackup() {
    const [clips, notes] = await Promise.all([db.clips.toArray(), db.notes.toArray()]);
    const data = { app: 'kesit', version: FORMAT_VERSION, exportedAt: new Date().toISOString(), clips, notes };
    downloadText(`kesit-yedek-${today()}.json`, JSON.stringify(data, null, 2), 'application/json');
    return { clips: clips.length, notes: notes.length };
}

/**
 * Yedeği mevcut verinin üzerine birleştirir: aynı kimlikte kayıt varsa
 * daha yeni olan (updatedAt) kalır. Hiçbir şey silinmez.
 */
export async function importBackup(): Promise<{ clips: number; notes: number } | null> {
    const file = await pickFile('application/json,.json');
    if (!file) return null;
    const data = JSON.parse(await file.text());
    if (data?.app !== 'kesit' || !Array.isArray(data.clips) || !Array.isArray(data.notes)) {
        throw new Error('Bu dosya bir Kesit yedeği değil.');
    }
    let clips = 0;
    let notes = 0;
    await db.transaction('rw', db.clips, db.notes, async () => {
        for (const c of data.clips as Clip[]) {
            if (typeof c?.id !== 'string') continue;
            const cur = await db.clips.get(c.id);
            if (cur && cur.updatedAt >= c.updatedAt) continue;
            await db.clips.put({ ...c, tags: mergeTags(c.tags), noteIds: c.noteIds ?? [] });
            clips++;
        }
        for (const n of data.notes as Note[]) {
            if (typeof n?.id !== 'string') continue;
            const cur = await db.notes.get(n.id);
            if (cur && cur.updatedAt >= n.updatedAt) continue;
            await db.notes.put(n);
            notes++;
        }
    });
    return { clips, notes };
}
