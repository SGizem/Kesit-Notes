import { useCallback, useEffect, useRef, useState } from 'react';
import * as pdfjs from 'pdfjs-dist';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { ArrowsOutLineHorizontal, MagnifyingGlassMinus, MagnifyingGlassPlus } from '@phosphor-icons/react';
import { db, type Clip, type StoredFile } from '../../db/db';
import { SelectionCut, type Cut } from '../../components/SelectionCut';
import { focusRange, paintMarks } from '../../lib/highlight';

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;

const MEASURE_ALL_MAX = 200; // daha uzun PDF'lerde sayfa boyutu ilk sayfadan tahmin edilir
const PLAIN_PAGES = 60; // arama için çıkarılan metin

interface Size {
    w: number;
    h: number;
}

/**
 * PDF: içerik değiştirilmez; okunur, altı çizilir. Seçilen metin "Kes" ile
 * kesit olur; önceki kesitler sayfada fosforla görünür.
 */
export function PdfView({
    file,
    clips,
    focusId,
    onCut,
}: {
    file: StoredFile;
    clips: Clip[];
    focusId: string | null;
    onCut: (cut: Cut, page?: number) => unknown;
}) {
    const scroller = useRef<HTMLDivElement>(null);
    const pagesRef = useRef<HTMLDivElement>(null);
    const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
    const [sizes, setSizes] = useState<Size[]>([]);
    const [fit, setFit] = useState(1);
    const [zoom, setZoom] = useState(1);
    const [error, setError] = useState<string | null>(null);
    const [current, setCurrent] = useState(1);
    const scale = fit * zoom;

    useEffect(() => {
        let cancelled = false;
        let task: ReturnType<typeof pdfjs.getDocument> | null = null;
        (async () => {
            try {
                const data = new Uint8Array(await file.blob.arrayBuffer());
                if (cancelled) return;
                task = pdfjs.getDocument({ data });
                const d = await task.promise;
                const first = (await d.getPage(1)).getViewport({ scale: 1 });
                const s: Size[] = [{ w: first.width, h: first.height }];
                for (let i = 2; i <= d.numPages; i++) {
                    if (d.numPages > MEASURE_ALL_MAX) s.push(s[0]);
                    else {
                        const v = (await d.getPage(i)).getViewport({ scale: 1 });
                        s.push({ w: v.width, h: v.height });
                    }
                }
                if (cancelled) return;
                const width = (scroller.current?.clientWidth ?? 900) - 64;
                setFit(Math.min(1.8, Math.max(0.5, width / s[0].w)));
                setSizes(s);
                setDoc(d);
                if (!file.plain) void extractPlain(d).then((plain) => db.files.update(file.id, { plain }));
            } catch (err) {
                console.error('[kesit] pdf', err);
                if (!cancelled) setError('Bu PDF açılamadı. Dosya bozuk ya da parola korumalı olabilir.');
            }
        })();
        return () => {
            cancelled = true;
            void task?.destroy();
        };
        // Sadece dosya değişince yeniden aç: kaydetmeler (plain vb.) belgeyi baştan yüklemesin.
    }, [file.id]);

    // Kesitleri boya: sayfalar çizildikçe ve kesitler değiştikçe.
    // repaint sabit kalmalı: değişirse görünen tüm sayfalar baştan çizilir. Kesitler ref'ten okunur.
    const ranges = useRef(new Map<string, Range>());
    const paintTimer = useRef<number>(undefined);
    const clipsRef = useRef(clips);
    clipsRef.current = clips;
    const repaint = useCallback(() => {
        window.clearTimeout(paintTimer.current);
        paintTimer.current = window.setTimeout(() => {
            if (pagesRef.current) {
                ranges.current = paintMarks(pagesRef.current, clipsRef.current.map(({ id, text, color }) => ({ id, text, color })));
            }
        }, 80);
    }, []);
    useEffect(repaint, [repaint, clips]);

    // Listeden ya da masadan gelinen kesite git.
    useEffect(() => {
        if (!focusId || !sizes.length) return;
        const clip = clips.find((c) => c.id === focusId);
        if (!clip?.page) return;
        const el = pagesRef.current?.querySelector<HTMLElement>(`[data-page="${clip.page}"]`);
        el?.scrollIntoView({ block: 'center' });
        const t = window.setTimeout(() => {
            const r = ranges.current.get(focusId);
            if (r) {
                (r.startContainer.parentElement as HTMLElement | null)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
                focusRange(r);
            }
        }, 900);
        return () => window.clearTimeout(t);
    }, [focusId, sizes.length, clips]);

    const cut = (c: Cut) => {
        const pageEl = (c.range.startContainer.parentElement as HTMLElement | null)?.closest<HTMLElement>('[data-page]');
        return onCut(c, pageEl ? Number(pageEl.dataset.page) : undefined);
    };

    if (error) return <p className="viewer__error">{error}</p>;

    return (
        <div className="pdf">
            <div className="pdf__bar">
                <span className="mono">
                    {doc ? `Sayfa ${current} / ${doc.numPages}` : 'Açılıyor…'}
                </span>
                <span className="pdf__spacer" />
                <button className="icon-btn" onClick={() => setZoom((z) => Math.max(0.4, z / 1.2))} title="Uzaklaştır">
                    <MagnifyingGlassMinus size={17} weight="bold" />
                </button>
                <span className="mono pdf__zoom">%{Math.round(scale * 100)}</span>
                <button className="icon-btn" onClick={() => setZoom((z) => Math.min(4, z * 1.2))} title="Yakınlaştır">
                    <MagnifyingGlassPlus size={17} weight="bold" />
                </button>
                <button className="icon-btn" onClick={() => setZoom(1)} title="Genişliğe sığdır">
                    <ArrowsOutLineHorizontal size={17} weight="bold" />
                </button>
            </div>
            <div className="pdf__scroll" ref={scroller}>
                <div className="pdf__pages" ref={pagesRef}>
                    {doc &&
                        sizes.map((s, i) => (
                            <PdfPage
                                key={i}
                                doc={doc}
                                n={i + 1}
                                size={s}
                                scale={scale}
                                root={scroller}
                                onRendered={repaint}
                                onVisible={setCurrent}
                            />
                        ))}
                </div>
            </div>
            <SelectionCut root={pagesRef} onCut={cut} />
        </div>
    );
}

function PdfPage({
    doc,
    n,
    size,
    scale,
    root,
    onRendered,
    onVisible,
}: {
    doc: PDFDocumentProxy;
    n: number;
    size: Size;
    scale: number;
    root: React.RefObject<HTMLDivElement | null>;
    onRendered: () => void;
    onVisible: (n: number) => void;
}) {
    const ref = useRef<HTMLDivElement>(null);
    const canvas = useRef<HTMLCanvasElement>(null);
    const textLayer = useRef<HTMLDivElement>(null);
    const [near, setNear] = useState(false);

    // Ekrana yaklaşınca çiz; yüzlerce sayfalık PDF'te bellek dolmasın.
    useEffect(() => {
        const io = new IntersectionObserver(
            ([e]) => {
                setNear(e.isIntersecting);
            },
            { root: root.current, rootMargin: '900px 0px' },
        );
        const vis = new IntersectionObserver(([e]) => e.isIntersecting && onVisible(n), {
            root: root.current,
            threshold: 0.5,
        });
        if (ref.current) {
            io.observe(ref.current);
            vis.observe(ref.current);
        }
        return () => {
            io.disconnect();
            vis.disconnect();
        };
    }, [root, n, onVisible]);

    useEffect(() => {
        if (!near || !canvas.current || !textLayer.current) return;
        let cancelled = false;
        let task: ReturnType<pdfjs.PDFPageProxy['render']> | null = null;
        (async () => {
            const page = await doc.getPage(n);
            if (cancelled) return;
            const viewport = page.getViewport({ scale });
            const dpr = window.devicePixelRatio || 1;
            const c = canvas.current!;
            c.width = Math.floor(viewport.width * dpr);
            c.height = Math.floor(viewport.height * dpr);
            task = page.render({ canvas: c, viewport, transform: dpr === 1 ? undefined : [dpr, 0, 0, dpr, 0, 0] });
            try {
                await task.promise;
            } catch {
                return; // iptal edildi (yakınlaştırma / sayfadan çıkış)
            }
            if (cancelled) return;
            const tl = textLayer.current!;
            tl.replaceChildren();
            const layer = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: tl, viewport });
            await layer.render();
            if (!cancelled) onRendered();
        })();
        return () => {
            cancelled = true;
            task?.cancel();
        };
    }, [near, doc, n, scale, onRendered]);

    return (
        <div
            ref={ref}
            className="pdf-page"
            data-page={n}
            style={{ width: size.w * scale, height: size.h * scale, ['--total-scale-factor' as string]: scale }}
        >
            <canvas ref={canvas} style={{ width: size.w * scale, height: size.h * scale }} />
            <div ref={textLayer} className="textLayer" />
            <span className="pdf-page__n mono">{n}</span>
        </div>
    );
}

async function extractPlain(doc: PDFDocumentProxy): Promise<string> {
    const parts: string[] = [];
    for (let i = 1; i <= Math.min(doc.numPages, PLAIN_PAGES); i++) {
        const content = await (await doc.getPage(i)).getTextContent();
        parts.push(content.items.map((it) => ('str' in it ? it.str : '')).join(' '));
    }
    return parts.join(' ').replace(/\s+/g, ' ').slice(0, 50000);
}
