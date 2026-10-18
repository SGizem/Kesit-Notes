import { useEffect, useRef, useState, type RefObject } from 'react';
import { Scissors } from '@phosphor-icons/react';
import { MARKERS, type Marker } from '../db/db';

export interface Cut {
    text: string;
    range: Range;
    color: Marker;
}

/**
 * Dosyalarda "altını çiz → kesit": kapsayıcının içinde metin seçilince seçimin
 * altında küçük bir şerit çıkar; renge tıklamak o renkte kesit alır.
 * Web'deki sağ tık menüsünün uygulama içindeki karşılığı.
 */
export function SelectionCut({ root, onCut }: { root: RefObject<HTMLElement | null>; onCut: (cut: Cut) => unknown }) {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
    const range = useRef<Range | null>(null);
    const selText = useRef('');
    const bar = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let dragging = false;
        let timer: number | undefined;

        const update = () => {
            const sel = window.getSelection();
            if (!sel || sel.isCollapsed || !sel.rangeCount || !sel.toString().trim()) return setPos(null);
            const r = sel.getRangeAt(0);
            if (!root.current?.contains(r.commonAncestorContainer)) return setPos(null);
            // Şerit seçimin üstünde dursun (okunacak sonraki satırı kapatmasın); yer yoksa altında.
            const rects = r.getClientRects();
            const first = rects[0] ?? r.getBoundingClientRect();
            const last = rects[rects.length - 1] ?? first;
            range.current = r.cloneRange();
            // Seçimin metni (Range'in değil): tablo hücreleri arasına sekme, satırlar arasına satır sonu koyar.
            selText.current = sel.toString();
            setPos(first.top > 90 ? { x: first.left + 90, y: first.top - 50 } : { x: last.right, y: last.bottom + 10 });
        };
        const onDown = (e: PointerEvent) => {
            if (bar.current?.contains(e.target as Node)) return;
            dragging = true;
            setPos(null);
        };
        const onUp = () => {
            dragging = false;
            window.setTimeout(update, 10);
        };
        // Klavyeyle seçim (Shift + oklar) için
        const onSelection = () => {
            if (dragging) return;
            window.clearTimeout(timer);
            timer = window.setTimeout(update, 150);
        };
        const onScroll = () => range.current && pos && update();

        document.addEventListener('pointerdown', onDown, true);
        document.addEventListener('pointerup', onUp, true);
        document.addEventListener('selectionchange', onSelection);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('pointerdown', onDown, true);
            document.removeEventListener('pointerup', onUp, true);
            document.removeEventListener('selectionchange', onSelection);
            window.removeEventListener('scroll', onScroll, true);
            window.clearTimeout(timer);
        };
    }, [root, pos]);

    if (!pos) return null;

    const cut = async (color: Marker) => {
        const r = range.current;
        if (!r) return;
        const text = (selText.current || r.toString())
            .replace(/\t+/g, ' · ')
            .replace(/[  ]*\n[\s]*/g, '\n')
            .trim();
        setPos(null);
        window.getSelection()?.removeAllRanges();
        if (text) await onCut({ text, range: r, color });
    };

    // Ekrandan taşmasın
    const left = Math.min(Math.max(8, pos.x - 90), window.innerWidth - 196);
    const top = Math.min(pos.y, window.innerHeight - 52);

    return (
        <div
            ref={bar}
            className="cutbar"
            style={{ left, top }}
            role="toolbar"
            aria-label="Seçimi kes"
            onMouseDown={(e) => e.preventDefault() /* seçim kaybolmasın */}
        >
            <span className="cutbar__label">
                <Scissors size={15} weight="bold" /> Kes
            </span>
            {MARKERS.map((m) => (
                <button key={m} className="swatch" data-c={m} aria-label={`${m} renkte kes`} onClick={() => cut(m)} />
            ))}
        </div>
    );
}
