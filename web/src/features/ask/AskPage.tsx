import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowUp, FileText, NotePencil, Plus, Scissors, Stop, Trash, Warning } from '@phosphor-icons/react';
import { db, newId, type AnswerPart, type Chat, type ChatTurn } from '../../db/db';
import { retrieve, type Source } from '../../lib/retrieve';
import { AskError, plainAnswer } from '../../lib/ask';
import { answer, detectEngine, engineLabel, sourcesFor, type Engine } from '../../lib/engine';
import { DEFAULT_MODEL, saveModel } from '../../lib/ollama';
import { ago } from '../../lib/format';

interface Live {
    chatId: string;
    q: string;
    sources: Source[];
    parts: AnswerPart[];
    phase: 'searching' | 'waiting' | 'writing';
}

export function AskPage() {
    const { chatId } = useParams();
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const chats = useLiveQuery(() => db.chats.orderBy('updatedAt').reverse().toArray(), []);
    const chat = useLiveQuery(async () => (chatId ? ((await db.chats.get(chatId)) ?? null) : null), [chatId]);
    const [live, setLive] = useState<Live | null>(null);
    const [engine, setEngine] = useState<Engine | undefined>(undefined);
    const abort = useRef<AbortController | null>(null);
    const bottom = useRef<HTMLDivElement>(null);

    useEffect(() => {
        void detectEngine().then(setEngine);
    }, []);

    useEffect(() => {
        bottom.current?.scrollIntoView({ block: 'end' });
    }, [chat?.turns.length, live?.parts, live?.phase]);

    // Sayfadan çıkınca yarım kalan cevabı durdur. (Başka sohbete geçmek durdurmaz:
    // cevap arka planda biter ve kendi sohbetine kaydedilir.)
    useEffect(() => () => abort.current?.abort(), []);

    const submit = async (question: string) => {
        const q = question.trim();
        if (!q || live) return;
        const eng = engine ?? (await detectEngine());

        let current: Chat | null = chat ?? null;
        if (!current) {
            const now = Date.now();
            current = { id: newId(), title: q.slice(0, 80), turns: [], createdAt: now, updatedAt: now };
            await db.chats.add(current);
            navigate(`/sor/${current.id}`, { replace: !chatId });
        }
        const chatRef = current.id;
        const history = current.turns
            .filter((t) => t.status === 'done')
            .slice(-6)
            .map((t) => ({ q: t.q, a: plainAnswer(t.parts) }));

        const ctrl = new AbortController();
        abort.current = ctrl;
        setLive({ chatId: chatRef, q, sources: [], parts: [], phase: 'searching' });

        const sources = sourcesFor(eng, await retrieve(q), q);
        setLive({ chatId: chatRef, q, sources, parts: [], phase: 'waiting' });

        const turn: ChatTurn = {
            q,
            parts: [],
            sources: sources.map(({ kind, id, title, href, color }) => ({ kind, id, title, href, color })),
            status: 'done',
            engine: engineLabel(eng),
            at: Date.now(),
        };
        try {
            await answer(eng, q, sources, history, ctrl.signal, (parts) => {
                turn.parts = parts;
                setLive({ chatId: chatRef, q, sources, parts, phase: 'writing' });
            });
            if (ctrl.signal.aborted) turn.status = 'stopped';
        } catch (err) {
            if (ctrl.signal.aborted) turn.status = 'stopped';
            else {
                turn.status = 'error';
                turn.error = err instanceof AskError ? err.message : 'Beklenmeyen bir hata oldu.';
                if (err instanceof AskError && ['offline', 'nomodel', 'nokey', 'auth'].includes(err.code)) {
                    void detectEngine().then(setEngine);
                }
            }
        }
        await db.chats.update(chatRef, (c) => {
            c.turns.push(turn);
            c.updatedAt = Date.now();
        });
        abort.current = null;
        setLive(null);
    };

    // Komut paletinden "Sor: …" → /sor?q=… (veriler yüklenince bir kez)
    const loaded = chats !== undefined;
    useEffect(() => {
        const q = params.get('q');
        if (!q || !loaded) return;
        setParams({}, { replace: true });
        void submit(q);
    }, [loaded]);

    const removeChat = async (id: string) => {
        if (!window.confirm('Bu sohbet silinsin mi?')) return;
        await db.chats.delete(id);
        if (id === chatId) navigate('/sor');
    };

    const turns = chat?.turns ?? [];
    const liveHere = live && live.chatId === chatId ? live : null;
    const empty = !turns.length && !liveHere;

    return (
        <div className="ask">
            <aside className="ask__index">
                <div className="notes__top">
                    <h1 className="notes__h">Sor</h1>
                    <button className="btn btn--hi btn--sm" onClick={() => navigate('/sor')} disabled={!chatId}>
                        <Plus size={14} weight="bold" /> Yeni
                    </button>
                </div>
                <ul className="notes__list">
                    {chats?.map((c) => (
                        <li key={c.id} className="ask__row">
                            <Link to={`/sor/${c.id}`} className={`card-row${c.id === chatId ? ' active' : ''}`}>
                                <span className="card-row__title">{c.title}</span>
                                <span className="card-row__meta mono">
                                    {c.turns.length} soru · {ago(c.updatedAt)}
                                </span>
                            </Link>
                            <button className="icon-btn ask__del" onClick={() => removeChat(c.id)} aria-label="Sohbeti sil">
                                <Trash size={14} weight="bold" />
                            </button>
                        </li>
                    ))}
                    {chats?.length === 0 && <li className="notes__empty-list">Sorduğun sorular burada birikir.</li>}
                </ul>
            </aside>

            <section className="ask__main">
                <div className="ask__scroll">
                    {engine && <SetupNote engine={engine} />}
                    {empty ? (
                        <Welcome onPick={submit} engine={engine} />
                    ) : (
                        <div className="thread">
                            {turns.map((t, i) => (
                                <Turn key={i} q={t.q} parts={t.parts} sources={t.sources} status={t.status} error={t.error} engine={t.engine} />
                            ))}
                            {liveHere && (
                                <Turn q={liveHere.q} parts={liveHere.parts} sources={liveHere.sources} status="live" phase={liveHere.phase} />
                            )}
                            <div ref={bottom} />
                        </div>
                    )}
                </div>
                <Composer
                    busy={!!live}
                    onSend={submit}
                    onStop={() => abort.current?.abort()}
                    engine={engine}
                    onModel={(model) => {
                        saveModel(model);
                        setEngine((e) => (e && 'models' in e ? { ...e, model } : e));
                    }}
                />
            </section>
        </div>
    );
}

function Welcome({ onPick, engine }: { onPick: (q: string) => void; engine?: Engine }) {
    const examples = useLiveQuery(async () => {
        const out: string[] = [];
        const clips = await db.clips.orderBy('createdAt').reverse().limit(300).toArray();
        const tags = new Map<string, number>();
        clips.forEach((c) => c.tags.forEach((t) => tags.set(t, (tags.get(t) ?? 0) + 1)));
        const topTag = [...tags.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
        if (topTag) out.push(`#${topTag} hakkında neler kaydettim?`);
        out.push('Bu hafta neler kestim? Kısaca özetle.');
        const file = await db.files.orderBy('updatedAt').last();
        if (file) out.push(`${file.name} dosyasının ana fikri ne?`);
        if ((await db.notes.count()) > 0) out.push('Notlarımda tekrar eden fikirler neler?');
        return out;
    }, []);

    return (
        <div className="welcome">
            <h2 className="welcome__title">
                Kesit'e <span className="mark">sor.</span>
            </h2>
            <p className="welcome__sub">
                {engine?.kind === 'local'
                    ? 'Kaydettiğin kesitler, notların ve dosyaların içinde sorunla en ilgili cümleleri bulur ve fosforla gösterir.'
                    : 'Kaydettiğin kesitler, notların ve dosyaların üzerinden cevap verir; her cümlenin hangi kaynaktan geldiğini numarayla gösterir. Emin olmak için numaraya tıklayıp kaynağa bakabilirsin.'}
            </p>
            <div className="welcome__examples">
                {examples?.map((e) => (
                    <button key={e} className="example" onClick={() => onPick(e)}>
                        {e}
                    </button>
                ))}
            </div>
        </div>
    );
}

function SetupNote({ engine }: { engine: Engine }) {
    if (engine.kind !== 'local') return null;
    return (
        <div className="banner setup">
            <div className="banner__head">
                <Warning size={18} weight="bold" />
                <div>
                    {engine.reason === 'nomodel' ? (
                        <p>
                            <b>Ollama çalışıyor ama model yok.</b> Terminalde <code>ollama pull {DEFAULT_MODEL}</code> yaz, bitince sayfayı yenile.
                        </p>
                    ) : (
                        <>
                            <p>
                                <b>Yapay zekasız moddasın.</b> Sorunla en ilgili cümleleri gösteririm ama cevabı cümleyle yazamam. Ücretsiz yerel yapay
                                zeka için:
                            </p>
                            <ol className="setup__steps">
                                <li>
                                    <a href="https://ollama.com/download" target="_blank" rel="noreferrer">
                                        ollama.com/download
                                    </a>{' '}
                                    adresinden Ollama’yı kur.
                                </li>
                                <li>
                                    Terminalde <code>ollama pull {DEFAULT_MODEL}</code> yaz (yaklaşık 3 GB, bir kez).
                                </li>
                                <li>Bu sayfayı yenile.</li>
                            </ol>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}

function Composer({
    busy,
    onSend,
    onStop,
    engine,
    onModel,
}: {
    busy: boolean;
    onSend: (q: string) => void;
    onStop: () => void;
    engine?: Engine;
    onModel: (model: string) => void;
}) {
    const [text, setText] = useState('');
    const send = () => {
        if (!text.trim() || busy) return;
        onSend(text);
        setText('');
    };
    return (
        <form
            className="composer"
            onSubmit={(e) => {
                e.preventDefault();
                send();
            }}
        >
            <textarea
                className="composer__input"
                rows={1}
                value={text}
                autoFocus
                onChange={(e) => setText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        send();
                    }
                }}
                placeholder="Kayıtlarına bir şey sor… (örn. “geçen ay dikkat hakkında ne okumuştum?”)"
                aria-label="Soru"
            />
            {engine && (
                <span className="engine mono" title={ENGINE_TITLE[engine.kind]}>
                    <span className={`engine__dot engine__dot--${engine.kind}`} aria-hidden />
                    {'models' in engine && engine.models.length > 1 ? (
                        <select value={engine.model} onChange={(e) => onModel(e.target.value)} disabled={busy} aria-label="Model">
                            {engine.models.map((m) => (
                                <option key={m}>{m}</option>
                            ))}
                        </select>
                    ) : (
                        engineLabel(engine)
                    )}
                </span>
            )}
            {busy ? (
                <button type="button" className="btn btn--act" onClick={onStop}>
                    <Stop size={16} weight="fill" /> Durdur
                </button>
            ) : (
                <button type="submit" className="btn btn--hi" disabled={!text.trim()}>
                    Sor <ArrowUp size={16} weight="bold" />
                </button>
            )}
        </form>
    );
}

const KIND_ICON = { clip: Scissors, note: NotePencil, file: FileText };

const ENGINE_TITLE: Record<Engine['kind'], string> = {
    ollama: 'Bilgisayarında çalışan yerel yapay zeka (Ollama)',
    lmstudio: 'Bilgisayarında çalışan yerel yapay zeka (LM Studio)',
    claude: 'Claude (API)',
    local: 'Yapay zeka bağlı değil: en ilgili cümleler gösteriliyor',
};

function Turn({
    q,
    parts,
    sources,
    status,
    error,
    phase,
    engine,
}: {
    q: string;
    parts: AnswerPart[];
    sources: { kind: 'clip' | 'note' | 'file'; id: string; title: string; href: string; color?: string }[];
    status: ChatTurn['status'] | 'live';
    error?: string;
    phase?: Live['phase'];
    engine?: string;
}) {
    // Kaynaklara ilk atıf sırasına göre numara ver: [1], [2]…
    const numbering = useMemo(() => {
        const map = new Map<number, number>();
        parts.forEach((p) => p.cites.forEach((c) => map.has(c.doc) || map.set(c.doc, map.size + 1)));
        return map;
    }, [parts]);
    const quoteOf = (doc: number) => parts.flatMap((p) => p.cites).find((c) => c.doc === doc)?.quote;
    const counts = sources.reduce((m, s) => ({ ...m, [s.kind]: (m[s.kind] ?? 0) + 1 }), {} as Record<string, number>);

    return (
        <article className="turn">
            <h3 className="turn__q">{q}</h3>
            <p className="turn__meta mono">
                {phase === 'searching'
                    ? 'kayıtların taranıyor…'
                    : `${counts.clip ?? 0} kesit · ${counts.note ?? 0} not · ${counts.file ?? 0} dosya tarandı${engine ? ` · ${engine}` : ''}`}
            </p>

            <div className="answer">
                {parts.map((p, i) => (
                    <span key={i}>
                        {format(p.text)}
                        {p.cites.length > 0 && (
                            <span className="cites">
                                {p.cites.map((c) => {
                                    const src = sources[c.doc];
                                    const n = numbering.get(c.doc);
                                    if (!src || !n) return null;
                                    return (
                                        <Link key={c.doc} className="cite" to={src.href} title={`${src.title}\n“${c.quote.trim()}”`}>
                                            {n}
                                        </Link>
                                    );
                                })}
                            </span>
                        )}
                    </span>
                ))}
                {status === 'live' && <span className="caret" aria-hidden />}
                {status === 'live' && phase === 'waiting' && !parts.length && <span className="answer__wait">düşünüyor</span>}
            </div>

            {status === 'stopped' && <p className="turn__note mono">durduruldu</p>}
            {status === 'error' && (
                <p className="turn__error">
                    <Warning size={16} weight="bold" /> {error}
                </p>
            )}

            {numbering.size > 0 && (
                <ol className="refs">
                    {[...numbering.entries()].map(([doc, n]) => {
                        const src = sources[doc];
                        if (!src) return null;
                        const Icon = KIND_ICON[src.kind];
                        return (
                            <li key={doc} className="ref" data-c={src.color}>
                                <span className="ref__n">{n}</span>
                                <Link to={src.href} className="ref__body">
                                    <span className="ref__title">
                                        <Icon size={13} weight="bold" /> {src.title}
                                    </span>
                                    {quoteOf(doc) && (
                                        <span className="ref__quote">
                                            <span className="mark" data-c={src.color ?? 'lime'}>
                                                {quoteOf(doc)!.trim()}
                                            </span>
                                        </span>
                                    )}
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            )}
        </article>
    );
}

/** Güvenli, küçük biçimlendirme: **kalın** ve satır sonları. HTML yorumlanmaz. */
function format(text: string): ReactNode[] {
    return text.split(/(\*\*[^*]+\*\*)/g).map((chunk, i) =>
        chunk.startsWith('**') && chunk.endsWith('**') && chunk.length > 4 ? <strong key={i}>{chunk.slice(2, -2)}</strong> : chunk,
    );
}
