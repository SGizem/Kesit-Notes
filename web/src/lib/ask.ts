import type { AnswerPart } from '../db/db';
import type { Source } from './retrieve';

/** Sunucunun (server/index.mjs) akıttığı satırlar. */
type Event =
    | { t: 'text'; i: number; text: string }
    | { t: 'cite'; i: number; doc: number; quote: string }
    | { t: 'done'; stop: string }
    | { t: 'error'; code: string; message: string };

export class AskError extends Error {
    constructor(
        public code: string,
        message: string,
    ) {
        super(message);
    }
}

export interface ServerStatus {
    ok: boolean;
    key: boolean;
    mock: boolean;
}

export async function serverStatus(): Promise<ServerStatus | null> {
    try {
        const r = await fetch('/api/durum');
        if (!r.ok) return null;
        return (await r.json()) as ServerStatus;
    } catch {
        return null;
    }
}

/**
 * Soruyu kaynaklarla birlikte sunucuya gönderir; cevap geldikçe onUpdate'i
 * güncel parçalarla çağırır. Hata olursa AskError fırlatır.
 */
export async function ask(
    question: string,
    sources: Source[],
    history: { q: string; a: string }[],
    signal: AbortSignal,
    onUpdate: (parts: AnswerPart[]) => void,
): Promise<void> {
    let res: Response;
    try {
        res = await fetch('/api/sor', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                question,
                history,
                today: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' }),
                sources: sources.map(({ title, context, text }) => ({ title, context, text })),
            }),
            signal,
        });
    } catch (err) {
        if (signal.aborted) throw err;
        throw new AskError('offline', 'Sor sunucusuna ulaşılamadı. Terminalde `npm run dev` ile başlatıldığından emin ol.');
    }
    if (!res.ok || !res.body) {
        const msg = await res.json().then((j: { error?: string }) => j.error).catch(() => null);
        throw new AskError(res.status === 404 || res.status >= 500 ? 'offline' : 'bad', msg ?? 'Sor sunucusu cevap vermedi.');
    }

    // Blok sırasına göre parçalar: her blok bir metin ve (varsa) dayandığı kaynaklar.
    const blocks = new Map<number, AnswerPart>();
    const emit = () => onUpdate([...blocks.entries()].sort((a, b) => a[0] - b[0]).map(([, p]) => ({ ...p, cites: [...p.cites] })));
    const block = (i: number) => {
        let p = blocks.get(i);
        if (!p) blocks.set(i, (p = { text: '', cites: [] }));
        return p;
    };

    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    let done = false;
    for (;;) {
        const { value, done: end } = await reader.read();
        if (end) break;
        buf += value;
        let nl: number;
        let changed = false;
        while ((nl = buf.indexOf('\n')) !== -1) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (!line) continue;
            const ev = JSON.parse(line) as Event;
            if (ev.t === 'text') {
                block(ev.i).text += ev.text;
                changed = true;
            } else if (ev.t === 'cite') {
                const p = block(ev.i);
                if (!p.cites.some((c) => c.doc === ev.doc)) p.cites.push({ doc: ev.doc, quote: ev.quote });
                changed = true;
            } else if (ev.t === 'error') {
                throw new AskError(ev.code, ev.message);
            } else if (ev.t === 'done') {
                done = true;
            }
        }
        if (changed) emit();
    }
    if (!done && !signal.aborted) throw new AskError('cut', 'Cevap yarıda kesildi.');
}

/** Geçmiş için düz metin cevap. */
export const plainAnswer = (parts: AnswerPart[]) => parts.map((p) => p.text).join('');
