import { useEffect, useRef, useState } from 'react';
import { CaretDown, DownloadSimple, FilePdf, FileDoc, FileXls, FileCsv, File as FileIcon } from '@phosphor-icons/react';
import { toast } from '../lib/toast';

export interface DownloadOption {
    label: string;
    kind: 'pdf' | 'docx' | 'xlsx' | 'csv' | 'original';
    run: () => Promise<void>;
}

const ICON = {
    pdf: FilePdf,
    docx: FileDoc,
    xlsx: FileXls,
    csv: FileCsv,
    original: FileIcon,
};

/** "İndir ▾" açılır menüsü: PDF, Word, Excel… Hazırlanırken düğme "hazırlanıyor" der. */
export function DownloadMenu({
    options,
    label = 'İndir',
    disabled,
    compact,
}: {
    options: DownloadOption[];
    label?: string;
    disabled?: boolean;
    /** Dar araç çubukları için: sadece simge. */
    compact?: boolean;
}) {
    const [open, setOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('mousedown', close);
        document.addEventListener('keydown', esc);
        return () => {
            document.removeEventListener('mousedown', close);
            document.removeEventListener('keydown', esc);
        };
    }, [open]);

    const run = async (o: DownloadOption) => {
        setOpen(false);
        setBusy(true);
        try {
            await o.run();
        } catch (err) {
            console.error('[kesit] dışa aktarma', err);
            toast('İndirme hazırlanamadı.', 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="menu" ref={ref}>
            {compact ? (
                <button
                    className="icon-btn"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    aria-label={label}
                    title={busy ? 'Hazırlanıyor…' : `${label} (PDF, Word)`}
                    disabled={disabled || busy}
                >
                    <DownloadSimple size={17} weight="bold" />
                </button>
            ) : (
                <button
                    className="btn btn--sm"
                    onClick={() => setOpen((v) => !v)}
                    aria-expanded={open}
                    aria-haspopup="menu"
                    disabled={disabled || busy}
                >
                    <DownloadSimple size={14} weight="bold" /> {busy ? 'Hazırlanıyor…' : label} <CaretDown size={12} weight="bold" />
                </button>
            )}
            {open && (
                <div className="menu__list" role="menu">
                    {options.map((o) => {
                        const Icon = ICON[o.kind];
                        return (
                            <button key={o.label} role="menuitem" className="menu__item" onClick={() => run(o)}>
                                <Icon size={16} weight="bold" /> {o.label}
                            </button>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
