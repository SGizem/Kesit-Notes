import type { Clip } from '../db/db';
import { dayKey, escapeHtml } from './format';
import { downloadBlob, today } from './download';
import { slugify } from './markdown';

export type DocFormat = 'pdf' | 'docx';

/**
 * Not, dosya ya da kesit listesi → PDF veya Word olarak indir.
 * Ağır kütüphaneler (pdfmake, docx) sadece indirme anında yüklenir.
 */
export async function downloadDoc(format: DocFormat, html: string, title: string, opts: { filename?: string; subtitle?: string } = {}) {
    const name = `${opts.filename ?? slugify(title || 'kesit')}.${format}`;
    if (format === 'pdf') {
        const { htmlToPdf } = await import('./pdfExport');
        downloadBlob(name, await htmlToPdf(html, title || undefined, opts.subtitle));
    } else {
        const { htmlToDocx } = await import('./docxExport');
        downloadBlob(name, await htmlToDocx(html, title || undefined));
    }
}

/** Kesitler: günlere göre, alıntı + kaynak + yorum + etiket. */
export function clipsToHtml(clips: Clip[]): string {
    let html = '';
    let currentDay = -1;
    for (const c of clips) {
        const d = dayKey(c.createdAt);
        if (d !== currentDay) {
            currentDay = d;
            html += `<h2>${new Date(d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', weekday: 'long' })}</h2>`;
        }
        const src = c.fragmentUrl ?? c.url;
        const label = escapeHtml([c.title, c.domain].filter(Boolean).join(' · ') || src || '');
        const body =
            c.kind === 'image' && c.imageUrl
                ? `<p><a href="${escapeHtml(c.imageUrl)}">[görsel] ${escapeHtml(c.imageUrl)}</a></p>`
                : c.text
                      .split(/\n+/)
                      .map((line) => `<p><mark data-c="${c.color}">${escapeHtml(line)}</mark></p>`)
                      .join('');
        const cite = src ? `<p><a href="${escapeHtml(src)}">— ${label}</a></p>` : '';
        html += `<blockquote>${body}${cite}</blockquote>`;
        if (c.comment) html += `<p><em>↳ ${escapeHtml(c.comment)}</em></p>`;
        if (c.tags.length) html += `<p><strong>${c.tags.map((t) => `#${escapeHtml(t)}`).join(' ')}</strong></p>`;
    }
    return html;
}

export async function downloadClips(format: DocFormat, clips: Clip[], heading = 'Kesitler') {
    const subtitle = `${clips.length} kesit · ${new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}`;
    await downloadDoc(format, clipsToHtml(clips), heading, { filename: `kesit-${slugify(heading)}-${today()}`, subtitle });
}
