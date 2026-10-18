import type { AnswerPart } from '../db/db';
import { AskError } from './ask';
import { chatMessages, parseCited } from './ollama';
import type { Source } from './retrieve';

/**
 * LM Studio: bilgisayarda çalışan bir başka ücretsiz yerel yapay zeka.
 * Yerel sunucusu (Developer → Start Server) OpenAI uyumlu bir uç sunar.
 * Modeli ilk istekte kendisi yükler; varsayılan bağlam penceresi küçük (4096) olduğu için
 * kaynak bütçesi Ollama'dan düşük tutulur.
 */

export const LMSTUDIO_URL = 'http://127.0.0.1:1234';
export const LMSTUDIO_BUDGET = 7_000;

export async function lmstudioStatus(): Promise<{ models: string[] } | null> {
    try {
        const r = await fetch(`${LMSTUDIO_URL}/v1/models`, { signal: AbortSignal.timeout(1500) });
        if (!r.ok) return null;
        const j = (await r.json()) as { data?: { id: string }[] };
        return { models: (j.data ?? []).map((m) => m.id).filter((n) => !/embed/i.test(n)) };
    } catch {
        return null;
    }
}

export async function askLmStudio(
    model: string,
    question: string,
    sources: Source[],
    history: { q: string; a: string }[],
    signal: AbortSignal,
    onUpdate: (parts: AnswerPart[]) => void,
): Promise<void> {
    let res: Response;
    try {
        res = await fetch(`${LMSTUDIO_URL}/v1/chat/completions`, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ model, messages: chatMessages(question, sources, history), stream: true, temperature: 0.1, max_tokens: 1200 }),
            signal,
        });
    } catch (err) {
        if (signal.aborted) throw err;
        throw new AskError('offline', 'LM Studio sunucusu kapalı görünüyor. LM Studio’da Developer → Start Server’a bas ve tekrar dene.');
    }
    if (!res.ok || !res.body) {
        const msg = await res
            .json()
            .then((j: { error?: string | { message?: string } }) => (typeof j.error === 'string' ? j.error : j.error?.message))
            .catch(() => null);
        throw new AskError('bad', msg ? `LM Studio hatası: ${msg}` : 'LM Studio cevap vermedi.');
    }

    // Akış: "data: {…}" satırları, sonunda "data: [DONE]"
    const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
    let buf = '';
    let raw = '';
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
            if (!line.startsWith('data:')) continue;
            const data = line.slice(5).trim();
            if (data === '[DONE]') {
                done = true;
                continue;
            }
            const ev = JSON.parse(data) as { choices?: { delta?: { content?: string }; finish_reason?: string | null }[]; error?: { message?: string } | string };
            if (ev.error) throw new AskError('bad', `LM Studio hatası: ${typeof ev.error === 'string' ? ev.error : ev.error.message}`);
            const c = ev.choices?.[0];
            if (c?.delta?.content) {
                raw += c.delta.content;
                changed = true;
            }
            if (c?.finish_reason) done = true;
        }
        if (changed) onUpdate(parseCited(raw, sources));
    }
    if (!done && !signal.aborted) throw new AskError('cut', 'Cevap yarıda kesildi.');
    if (done) onUpdate(parseCited(raw.trimEnd(), sources));
}
