import { ArrowUpRight } from '@phosphor-icons/react';
import type { Clip } from '../../db/db';
import { ago, dayKey } from '../../lib/format';

const MIN_AGE = 3 * 86_400_000;

/**
 * Hafızadan: her gün en az 3 günlük bir kesit öne çıkar.
 * Gün içinde aynı kesit kalır (tarihten türetilen sıra), ertesi gün değişir.
 */
export function Resurface({ clips }: { clips: Clip[] }) {
    const old = clips.filter((c) => c.kind !== 'image' && c.text && Date.now() - c.createdAt > MIN_AGE);
    if (old.length === 0) return null;
    const clip = old[Math.floor(dayKey(Date.now()) / 86_400_000) % old.length];
    const source = clip.fragmentUrl ?? clip.url;

    return (
        <aside className="resurface" data-c={clip.color}>
            <p className="resurface__label mono">Hafızadan · {ago(clip.createdAt)} altını çizmiştin</p>
            <blockquote className="resurface__quote">
                <span className="mark" data-c={clip.color}>
                    {clip.text}
                </span>
            </blockquote>
            <p className="resurface__src mono">
                {clip.domain ?? 'elle yazıldı'}
                {source && (
                    <a href={source} target="_blank" rel="noreferrer">
                        kaynağa dön <ArrowUpRight size={12} weight="bold" />
                    </a>
                )}
            </p>
        </aside>
    );
}
