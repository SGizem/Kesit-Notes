import type { AnswerPart } from '../db/db';
import { ask, serverStatus } from './ask';
import { askLmStudio, LMSTUDIO_BUDGET, lmstudioStatus } from './lmstudio';
import { askOllama, fitSources, localAnswer, ollamaStatus, pickModel } from './ollama';
import type { Source } from './retrieve';

/**
 * "Kesit'e sor"un cevap motoru, öncelik sırasıyla:
 *  1. Ollama — kullanıcının bilgisayarında, ücretsiz.
 *  2. LM Studio — yine yerel ve ücretsiz; yerel sunucusu açıksa.
 *  3. Claude — yalnızca server/.env'de anahtar varsa (isteğe bağlı, arayüzde önerilmez).
 *  4. Yapay zekasız — en ilgili cümleleri gösterir, kurulum gerektirmez.
 */
export type Engine =
    | { kind: 'ollama' | 'lmstudio'; model: string; models: string[] }
    | { kind: 'claude' }
    | { kind: 'local'; reason: 'noollama' | 'nomodel' };

type Forced = 'ollama' | 'lmstudio' | 'claude' | 'yerel' | null;

/** Geliştirme/test için motoru zorlamak: localStorage 'kesit.motor' = ollama | lmstudio | claude | yerel */
function forced(): Forced {
    try {
        return localStorage.getItem('kesit.motor') as Forced;
    } catch {
        return null;
    }
}

export async function detectEngine(): Promise<Engine> {
    const force = forced();
    if (force === 'yerel') return { kind: 'local', reason: 'noollama' };
    const allow = (k: Exclude<Forced, null>) => !force || force === k;

    const ollama = allow('ollama') ? await ollamaStatus() : null;
    const om = ollama && pickModel(ollama.models);
    if (ollama && om) return { kind: 'ollama', model: om, models: ollama.models };

    const lms = allow('lmstudio') ? await lmstudioStatus() : null;
    const lm = lms && pickModel(lms.models);
    if (lms && lm) return { kind: 'lmstudio', model: lm, models: lms.models };

    // Claude sunucusu yalnızca yerel model yoksa yoklanır (çoğu kullanıcıda hiç çalışmıyor).
    const server = allow('claude') ? await serverStatus() : null;
    if (server && (server.key || server.mock)) return { kind: 'claude' };
    return { kind: 'local', reason: ollama || lms ? 'nomodel' : 'noollama' };
}

export const engineLabel = (e: Engine) =>
    e.kind === 'ollama' || e.kind === 'lmstudio' ? e.model : e.kind === 'claude' ? 'claude' : 'yapay zekasız';

/** Motorun göreceği kaynaklar (cevaptaki numaralar bu listeye göre). */
export const sourcesFor = (e: Engine, sources: Source[], question: string) =>
    e.kind === 'ollama' ? fitSources(sources, question) : e.kind === 'lmstudio' ? fitSources(sources, question, LMSTUDIO_BUDGET) : sources;

export async function answer(
    e: Engine,
    question: string,
    sources: Source[],
    history: { q: string; a: string }[],
    signal: AbortSignal,
    onUpdate: (parts: AnswerPart[]) => void,
): Promise<void> {
    if (e.kind === 'ollama') return askOllama(e.model, question, sources, history, signal, onUpdate);
    if (e.kind === 'lmstudio') return askLmStudio(e.model, question, sources, history, signal, onUpdate);
    if (e.kind === 'claude') return ask(question, sources, history, signal, onUpdate);
    onUpdate(localAnswer(question, sources));
}
