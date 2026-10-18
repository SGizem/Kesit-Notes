import { db, type Clip, type Note, type SourceRef, type StoredFile } from '../db/db';
import { fold } from './search';
import { dayKey } from './format';

/**
 * "Kesit'e sor" için kaynak bulma — tamamen tarayıcıda, kullanıcının kendi verisinde.
 * Soru kelimelerini (Türkçe eklere toleranslı) kesit, not ve dosyalarda arar,
 * puanlar ve en ilgili olanları Claude'a gidecek belgelere çevirir.
 */

export interface Source extends SourceRef {
    /** Claude'a giden metin (atıf yapılabilir). */
    text: string;
    /** Belge bağlamı: tür, tarih, kaynak, etiket (atıf yapılmaz, sadece bilgi). */
    context: string;
}

const LIMITS = { clips: 24, notes: 5, files: 3, noteChars: 6000, fileChars: 9000, recentFallback: 15 };

const STOP = new Set(
    'acaba ama ancak bana beni benim biz bize bizim bu bunu bunun bunlar da daha de diye en gibi hakkinda hangi hem hep her hic icin ile ise kadar kim mi mu ne neden nedir neler nasil nerede o olan olarak sen sey seyi siz su sunu ve veya ya yani yok var mi mu mı mü ki cok az ben sana onu onun kaydettim kaydettigim kestim kestigim kesit kesitler kesitlerim notlarim notlar not yazdim'
        .split(' '),
);

/** Kelime kökü: Türkçe eklere karşı kaba ama işe yarar — "kitapları" → "kitap", "dikkatin" → "dikka". */
const stem = (w: string) => (w.length > 5 ? w.slice(0, 5) : w);

export function terms(question: string): string[] {
    return [...new Set(fold(question).split(/[^\p{L}\p{N}#]+/u))]
        .map((w) => w.replace(/^#/, ''))
        .filter((w) => w.length >= 3 && !STOP.has(w))
        .map(stem);
}

/** "bugün / dün / bu hafta / geçen hafta / bu ay / geçen ay" → tarih aralığı. */
export function dateRange(question: string, now = Date.now()): [number, number] | null {
    const q = fold(question);
    const today = dayKey(now);
    const day = 86_400_000;
    const weekStart = today - ((new Date(today).getDay() + 6) % 7) * day; // pazartesi
    const d = new Date(today);
    const monthStart = new Date(d.getFullYear(), d.getMonth(), 1).getTime();
    if (/\bbugun/.test(q)) return [today, now + 1];
    if (/\bdun\b|\bdunku/.test(q)) return [today - day, today];
    if (/gecen hafta/.test(q)) return [weekStart - 7 * day, weekStart];
    if (/bu hafta/.test(q)) return [weekStart, now + 1];
    if (/gecen ay/.test(q)) return [new Date(d.getFullYear(), d.getMonth() - 1, 1).getTime(), monthStart];
    if (/bu ay/.test(q)) return [monthStart, now + 1];
    if (/son (bir )?hafta|son 7 gun/.test(q)) return [today - 7 * day, now + 1];
    return null;
}

export function scoreText(haystack: string, ts: string[]): number {
    if (!ts.length) return 0;
    let s = 0;
    for (const t of ts) {
        let count = 0;
        let at = haystack.indexOf(t);
        while (at !== -1 && count < 5) {
            count++;
            at = haystack.indexOf(t, at + t.length);
        }
        if (count) s += 1 + Math.log(count);
    }
    return s;
}

const fmtDate = (t: number) => new Date(t).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' });

function clipSource(c: Clip): Source {
    const where = c.fileId ? `dosya: ${c.domain}${c.page ? `, sayfa ${c.page}` : ''}` : c.url ?? 'elle yazıldı';
    return {
        kind: 'clip',
        id: c.id,
        title: (c.title || c.domain || 'Kesit').slice(0, 200),
        href: c.fileId ? `/dosyalar/${c.fileId}?${c.page ? `sayfa=${c.page}&` : ''}kesit=${c.id}` : `/?kesit=${c.id}`,
        color: c.color,
        text: c.kind === 'image' ? `[görsel] ${c.imageUrl ?? ''}` : c.text,
        context: [
            `Tür: kesit (${c.kind})`,
            `Kaydedildi: ${fmtDate(c.createdAt)}`,
            `Kaynak: ${where}`,
            c.comment && `Kullanıcının notu: ${c.comment}`,
            c.tags.length && `Etiketler: ${c.tags.map((t) => `#${t}`).join(' ')}`,
            c.context && `Çevresindeki paragraf: ${c.context.slice(0, 500)}`,
        ]
            .filter(Boolean)
            .join(' | '),
    };
}

function noteSource(n: Note): Source {
    return {
        kind: 'note',
        id: n.id,
        title: n.title || 'Adsız not',
        href: `/notlar/${n.id}`,
        text: n.plain.slice(0, LIMITS.noteChars) || '(boş not)',
        context: `Tür: kullanıcının notu | Son düzenleme: ${fmtDate(n.updatedAt)}`,
    };
}

function fileSource(f: StoredFile): Source {
    return {
        kind: 'file',
        id: f.id,
        title: f.name,
        href: `/dosyalar/${f.id}`,
        text: (f.plain ?? '').slice(0, LIMITS.fileChars) || '(metni okunamadı)',
        context: `Tür: yüklenen dosya (${f.kind}) | Yüklendi: ${fmtDate(f.createdAt)}`,
    };
}

export async function retrieve(question: string): Promise<Source[]> {
    const ts = terms(question);
    const range = dateRange(question);
    const [clips, notes, files] = await Promise.all([db.clips.toArray(), db.notes.toArray(), db.files.toArray()]);
    const inRange = (t: number) => !range || (t >= range[0] && t < range[1]);

    const rank = <T,>(items: T[], text: (x: T) => string, time: (x: T) => number, limit: number) =>
        items
            .filter((x) => inRange(time(x)))
            .map((x) => ({ x, s: scoreText(fold(text(x)), ts) + (range ? 0.5 : 0) }))
            .filter((r) => r.s > 0)
            // Eşit puanda yeni olan önce
            .sort((a, b) => b.s - a.s || time(b.x) - time(a.x))
            .slice(0, limit)
            .map((r) => r.x);

    let pickedClips = rank(clips, (c) => [c.text, c.comment, c.title, c.domain, c.context, c.tags.join(' ')].join(' '), (c) => c.createdAt, LIMITS.clips);
    const pickedNotes = rank(notes, (n) => `${n.title} ${n.plain}`, (n) => n.updatedAt, LIMITS.notes);
    const pickedFiles = rank(files, (f) => `${f.name} ${f.plain ?? ''}`, (f) => f.updatedAt, LIMITS.files);

    // Hiçbir şey eşleşmediyse ("ne kaydettim?" gibi genel sorular): en yeni kesitler.
    if (!pickedClips.length && !pickedNotes.length && !pickedFiles.length) {
        pickedClips = clips
            .filter((c) => inRange(c.createdAt))
            .sort((a, b) => b.createdAt - a.createdAt)
            .slice(0, LIMITS.recentFallback);
    }

    return dedupe([...pickedClips.map(clipSource), ...pickedNotes.map(noteSource), ...pickedFiles.map(fileSource)]);
}

/**
 * Aynı metin hem kesit hem not olarak kayıtlıysa (ya da aynı cümle iki kez kesilmişse) bir kez gönder.
 * İlk gelen kalır: kesitler önce geldiği için kaynağın bağlantısı korunur.
 */
function dedupe(sources: Source[]): Source[] {
    const keys: string[] = [];
    return sources.filter((s) => {
        const key = fold(s.text).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
        if (key.length < 20) return true;
        const probe = key.slice(0, 200);
        if (keys.some((k) => k.includes(probe) || (k.length >= 20 && key.includes(k.slice(0, 200))))) return false;
        keys.push(key);
        return true;
    });
}
