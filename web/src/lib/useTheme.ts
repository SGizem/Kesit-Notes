import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

type Theme = 'light' | 'dark';
const KEY = 'kesit-theme';
const SWEEP_MS = 720;
const mq = () => window.matchMedia('(prefers-color-scheme: dark)');

function storedTheme(): Theme | null {
    try {
        const t = localStorage.getItem(KEY);
        return t === 'light' || t === 'dark' ? t : null;
    } catch {
        return null;
    }
}

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Tema değişimi "baskı silindiri" gibi: yeni tema, düğmenin olduğu noktadan
 * çapraz bir çizgiyle sayfanın üstüne yayılır (View Transitions API).
 * Desteklemeyen tarayıcıda renkler yumuşakça geçer; hareket azaltma açıksa anında değişir.
 */
function animateThemeChange(apply: () => void, origin?: { x: number; y: number }) {
    const root = document.documentElement;
    if (reducedMotion()) return apply();

    if (!document.startViewTransition) {
        root.classList.add('theme-fade');
        apply();
        window.setTimeout(() => root.classList.remove('theme-fade'), 450);
        return;
    }

    const w = window.innerWidth;
    const h = window.innerHeight;
    const x = origin?.x ?? 0;
    const y = origin?.y ?? h;
    // Noktanın etrafında büyüyen bir elmas: kenarları 45° eğik, w+h her köşeyi kapsar.
    const reach = w + h;

    const vt = document.startViewTransition(apply);
    vt.ready.then(() => {
        root.animate(
            {
                clipPath: [
                    `polygon(${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px, ${x}px ${y}px)`,
                    `polygon(${x - reach}px ${y}px, ${x}px ${y - reach}px, ${x + reach}px ${y}px, ${x}px ${y + reach}px)`,
                ],
            },
            { duration: SWEEP_MS, easing: 'cubic-bezier(0.65, 0, 0.25, 1)', pseudoElement: '::view-transition-new(root)' },
        );
    });
}

/**
 * Kullanıcı seçim yapmadıysa sistem temasını canlı takip eder (data-theme yok,
 * CSS media query devrede). Düğmeye basınca seçim kalıcı olur.
 */
export function useTheme() {
    const [chosen, setChosen] = useState<Theme | null>(storedTheme);
    const [system, setSystem] = useState<Theme>(() => (mq().matches ? 'dark' : 'light'));

    useEffect(() => {
        const m = mq();
        const on = () => setSystem(m.matches ? 'dark' : 'light');
        m.addEventListener('change', on);
        return () => m.removeEventListener('change', on);
    }, []);

    useEffect(() => {
        if (chosen) document.documentElement.dataset.theme = chosen;
        else delete document.documentElement.dataset.theme;
    }, [chosen]);

    const theme = chosen ?? system;

    /** origin: animasyonun başlayacağı nokta (genelde tıklanan düğme). */
    const toggle = useCallback(
        (origin?: { x: number; y: number }) => {
            const next: Theme = theme === 'dark' ? 'light' : 'dark';
            animateThemeChange(() => {
                // Geçiş, yeni temanın ekranda olduğu anın görüntüsünü alır; o yüzden senkron uygula.
                document.documentElement.dataset.theme = next;
                flushSync(() => setChosen(next));
            }, origin);
            try {
                localStorage.setItem(KEY, next);
            } catch {
                /* gizli pencere: sadece bu oturumda geçerli */
            }
        },
        [theme],
    );

    return { theme, toggle };
}
