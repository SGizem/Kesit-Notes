import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Scissors, Trash } from '@phosphor-icons/react';
import { db, type Clip, type Marker, type StoredFile } from '../../db/db';
import { addFileClip } from '../../db/clips';
import { deleteFile, formatSize, KIND_LABEL, renameFile } from '../../db/files';
import { clearMarks, contextOfRange } from '../../lib/highlight';
import { downloadBlob, downloadText } from '../../lib/download';
import { downloadDoc } from '../../lib/exportDoc';
import { ago, escapeHtml } from '../../lib/format';
import { toast } from '../../lib/toast';
import type { Cut } from '../../components/SelectionCut';
import { DownloadMenu, type DownloadOption } from '../../components/DownloadMenu';
import { PdfView } from './PdfView';
import { DocView } from './DocView';
import { SheetView } from './SheetView';

export function FileView({ fileId }: { fileId: string }) {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const focusId = params.get('kesit');
    const [saved, setSaved] = useState(true);
    const [drawer, setDrawer] = useState(true);

    // undefined = yükleniyor, null = yok
    const file = useLiveQuery(async () => (await db.files.get(fileId)) ?? null, [fileId]);
    const clips = useLiveQuery(
        async () => (await db.clips.where('fileId').equals(fileId).sortBy('createdAt')).reverse(),
        [fileId],
        [] as Clip[],
    );

    // Bu sayfadan çıkınca dosyanın fosforları da silinsin.
    useEffect(() => () => clearMarks(), []);

    if (file === undefined) return null;
    if (file === null) {
        return (
            <div className="viewer__missing">
                <p>Bu dosya bulunamadı; silinmiş olabilir.</p>
                <Link className="btn" to="/dosyalar">
                    Dosyalara dön
                </Link>
            </div>
        );
    }

    const cut = async ({ text, range, color }: Cut, page?: number) => {
        await addFileClip(file, { text, color, page, context: contextOfRange(range, text) });
        toast('Kesildi — masada da görünüyor');
    };
    const cutText = async (text: string, color: Marker, context: string) => {
        await addFileClip(file, { text, color, context });
        toast('Kesildi — masada da görünüyor');
    };

    const remove = async () => {
        if (!window.confirm(`"${file.name}" silinsin mi? Ondan aldığın kesitler masada kalır.`)) return;
        await deleteFile(file.id);
        navigate('/dosyalar');
    };

    const focus = (c: Clip) =>
        setParams((p) => {
            p.set('kesit', c.id);
            if (c.page) p.set('sayfa', String(c.page));
            return p;
        });

    return (
        <div className={`viewer${drawer ? ' with-drawer' : ''}`}>
            <header className="viewer__head">
                <Link to="/dosyalar" className="icon-btn" aria-label="Dosyalara dön" title="Dosyalara dön">
                    <ArrowLeft size={18} weight="bold" />
                </Link>
                <span className="viewer__kind mono" data-kind={file.kind}>
                    {KIND_LABEL[file.kind]}
                </span>
                <NameField file={file} />
                <span className="viewer__meta mono">
                    {formatSize(file.size)} · {saved ? `kaydedildi ${ago(file.updatedAt)}` : 'kaydediliyor…'}
                </span>
                <span className="viewer__spacer" />
                <ExportMenu file={file} />
                <button className="icon-btn" onClick={remove} title="Dosyayı sil">
                    <Trash size={17} weight="bold" />
                </button>
                <button
                    className={`btn btn--sm${drawer ? ' btn--hi' : ''}`}
                    onClick={() => setDrawer((v) => !v)}
                    aria-pressed={drawer}
                >
                    <Scissors size={14} weight="bold" /> {clips.length}
                </button>
            </header>

            <div className="viewer__body">
                {file.kind === 'pdf' && <PdfView file={file} clips={clips} focusId={focusId} onCut={cut} />}
                {(file.kind === 'docx' || file.kind === 'md' || file.kind === 'txt') && (
                    <DocView file={file} clips={clips} focusId={focusId} onCut={cut} setSaved={setSaved} />
                )}
                {(file.kind === 'xlsx' || file.kind === 'csv') && (
                    <SheetView file={file} onCutText={cutText} setSaved={setSaved} />
                )}
            </div>

            {drawer && (
                <aside className="drawer viewer__drawer" aria-label="Bu dosyadan kesitler">
                    <div className="drawer__head">
                        <p className="drawer__title">Kesitler</p>
                        <p className="mono drawer__hint">
                            {file.kind === 'xlsx' || file.kind === 'csv' ? 'hücreleri seç → kes' : 'metni seç → kes'}
                        </p>
                    </div>
                    <ul className="drawer__list">
                        {clips.map((c) => (
                            <li key={c.id} className="mini mini--file" data-c={c.color} data-on={c.id === focusId || undefined}>
                                <button className="mini__body" onClick={() => focus(c)}>
                                    <p className="mini__meta mono">
                                        {c.page ? `s. ${c.page} · ` : ''}
                                        {ago(c.createdAt)}
                                    </p>
                                    <p className="mini__text">
                                        <span className="mark" data-c={c.color}>
                                            {c.text}
                                        </span>
                                    </p>
                                    {c.comment && <p className="mini__cmt">↳ {c.comment}</p>}
                                </button>
                                <Link className="icon-btn mini__add" to={`/?kesit=${c.id}`} title="Masada gör">
                                    <Scissors size={14} weight="bold" />
                                </Link>
                            </li>
                        ))}
                        {clips.length === 0 && (
                            <li className="drawer__empty">
                                Henüz kesit yok. Bir yeri seç, beliren şeritten bir renge tıkla.
                            </li>
                        )}
                    </ul>
                </aside>
            )}
        </div>
    );
}

function NameField({ file }: { file: StoredFile }) {
    const [name, setName] = useState(file.name);
    useEffect(() => setName(file.name), [file.name]);
    const save = () => {
        const n = name.trim();
        if (n && n !== file.name) void renameFile(file.id, n);
        else setName(file.name);
    };
    return (
        <input
            className="viewer__name"
            value={name}
            aria-label="Dosya adı"
            onChange={(e) => setName(e.target.value)}
            onBlur={save}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            size={Math.max(8, name.length)}
        />
    );
}

const base = (name: string) => name.replace(/\.[^.]+$/, '');

/** Dosyanın düzenlenmiş içeriği, PDF/Word'e verilecek HTML olarak. */
async function fileHtml(file: StoredFile): Promise<string> {
    if (file.kind === 'docx') return file.html ?? '';
    if (file.kind === 'md') {
        const { marked } = await import('marked');
        return marked.parse(file.text ?? '', { async: false });
    }
    return (file.text ?? '')
        .split(/\r?\n/)
        .map((l) => `<p>${escapeHtml(l)}</p>`)
        .join('');
}

/**
 * Türüne göre indirme seçenekleri: belgeler PDF / Word, tablolar Excel / CSV / PDF.
 * Kütüphaneler sadece gerektiğinde yüklenir.
 */
function ExportMenu({ file }: { file: StoredFile }) {
    const name = base(file.name);
    const options: DownloadOption[] = [];

    if (file.kind === 'docx' || file.kind === 'md' || file.kind === 'txt') {
        for (const format of ['pdf', 'docx'] as const) {
            options.push({
                label: format === 'pdf' ? 'PDF' : 'Word (.docx)',
                kind: format,
                run: async () => downloadDoc(format, await fileHtml(file), file.kind === 'docx' ? '' : name, { filename: name }),
            });
        }
        if (file.kind === 'txt') options.push({ label: 'Metin (.txt)', kind: 'original', run: async () => downloadText(`${name}.txt`, file.text ?? '') });
    } else if (file.kind === 'xlsx' || file.kind === 'csv') {
        const sheets = file.sheets ?? [];
        options.push({
            label: 'Excel (.xlsx)',
            kind: 'xlsx',
            run: async () => {
                const { sheetsToXlsx } = await import('../../lib/sheets');
                downloadBlob(`${name}.xlsx`, sheetsToXlsx(sheets));
            },
        });
        sheets.forEach((s) =>
            options.push({
                label: sheets.length > 1 ? `CSV — ${s.name}` : 'CSV',
                kind: 'csv',
                run: async () => {
                    const { sheetToCsv } = await import('../../lib/sheets');
                    downloadText(`${name}${sheets.length > 1 ? `-${s.name}` : ''}.csv`, sheetToCsv(s), 'text/csv;charset=utf-8');
                },
            }),
        );
        options.push({
            label: 'PDF (tablo)',
            kind: 'pdf',
            run: async () => {
                const { sheetsToPdf } = await import('../../lib/pdfExport');
                downloadBlob(`${name}.pdf`, await sheetsToPdf(sheets, name));
            },
        });
    } else if (file.kind === 'pdf') {
        options.push({ label: 'PDF', kind: 'pdf', run: async () => downloadBlob(file.name, file.blob) });
    }

    return <DownloadMenu options={options} />;
}
