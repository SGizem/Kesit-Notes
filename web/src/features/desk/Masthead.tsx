import type { Clip } from '../../db/db';
import { dayKey } from '../../lib/format';
import { BRAND } from '../../lib/brand';

/** Gazete künyesi: ad, tarih satırı, sayı numarası. */
export function Masthead({ clips }: { clips: Clip[] }) {
    const now = Date.now();
    const today = dayKey(now);
    const todayCount = clips.filter((c) => c.createdAt >= today).length;
    const sources = new Set(clips.map((c) => c.domain).filter(Boolean)).size;
    const first = clips.length ? clips[clips.length - 1].createdAt : now;
    const issue = Math.floor((today - dayKey(first)) / 86_400_000) + 1;

    const date = new Date(now).toLocaleDateString('tr-TR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });

    return (
        <header className="masthead">
            <div className="masthead__dateline mono">
                <span>{date}</span>
                <span>Sayı {issue}</span>
            </div>
            <h1 className="masthead__name">
                {BRAND.name}
                <span className="masthead__dot" aria-hidden />
            </h1>
            <div className="masthead__stats mono">
                <span>
                    Bugün <b>{todayCount}</b> kesit
                </span>
                <span>
                    Toplam <b>{clips.length}</b>
                </span>
                <span>
                    <b>{sources}</b> kaynak
                </span>
                <span className="masthead__tag">— {BRAND.tagline}</span>
            </div>
        </header>
    );
}
