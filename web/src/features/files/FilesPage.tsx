import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { FilePlus, MagnifyingGlass, UploadSimple } from '@phosphor-icons/react';
import { db, type FileKind } from '../../db/db';
import { ACCEPT, formatSize, ImportError, importFile, KIND_LABEL } from '../../db/files';
import { pickFile } from '../../lib/download';
import { ago } from '../../lib/format';
import { score } from '../../lib/search';
import { toast } from '../../lib/toast';
import { FileView } from './FileView';

export function FilesPage() {
    const { fileId } = useParams();
    return fileId ? <FileView key={fileId} fileId={fileId} /> : <FileList />;
}

/** Yükleme: tek tek ya da toplu. Hatalı olanlar atlanır, kullanıcıya söylenir. */
export async function importMany(files: File[]): Promise<string | null> {
    let lastId: string | null = null;
    for (const f of files) {
        try {
            const { file, warning } = await importFile(f);
            lastId = file.id;
            if (warning) toast(warning, 'error');
        } catch (err) {
            toast(err instanceof ImportError ? err.message : `${f.name} açılamadı.`, 'error');
            if (!(err instanceof ImportError)) console.error('[kesit] içe aktarma', err);
        }
    }
    return lastId;
}

function FileList() {
    const navigate = useNavigate();
    const [params, setParams] = useSearchParams();
    const [query, setQuery] = useState('');
    const [dragging, setDragging] = useState(false);
    const depth = useRef(0);
    const files = useLiveQuery(() => db.files.orderBy('updatedAt').reverse().toArray(), []);
    const clipCounts = useLiveQuery(async () => {
        const counts = new Map<string, number>();
        await db.clips.where('fileId').above('').each((c) => counts.set(c.fileId!, (counts.get(c.fileId!) ?? 0) + 1));
        return counts;
    }, []);

    const list = useMemo(() => {
        if (!files) return [];
        const q = query.trim();
        return q ? files.filter((f) => score(q, f.name, f.plain ?? '') > 0) : files;
    }, [files, query]);

    const add = async () => {
        const f = await pickFile(ACCEPT);
        if (!f) return;
        const id = await importMany([f]);
        if (id) navigate(`/dosyalar/${id}`);
    };

    // Komut paletinden "Dosya ekle" → /dosyalar?ekle=1 (yalnızca açılışta)
    useEffect(() => {
        if (params.get('ekle') !== '1') return;
        setParams({}, { replace: true });
        void add();
    }, []);

    const onDrop = async (e: React.DragEvent) => {
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        const dropped = Array.from(e.dataTransfer.files);
        if (!dropped.length) return;
        const id = await importMany(dropped);
        if (id && dropped.length === 1) navigate(`/dosyalar/${id}`);
        else if (id) toast(`${dropped.length} dosya eklendi`);
    };

    return (
        <div
            className="files"
            onDragEnter={(e) => {
                if (!e.dataTransfer.types.includes('Files')) return;
                depth.current++;
                setDragging(true);
            }}
            onDragLeave={() => {
                depth.current = Math.max(0, depth.current - 1);
                if (depth.current === 0) setDragging(false);
            }}
            onDragOver={(e) => e.dataTransfer.types.includes('Files') && e.preventDefault()}
            onDrop={onDrop}
        >
            <header className="files__head">
                <h1 className="files__h">Dosyalar</h1>
                <p className="files__sub">
                    PDF'te altını çiz, Word ve Excel'i düzenle, hepsinden <span className="mark">kesit</span> al.
                </p>
                <div className="files__actions">
                    <label className="files__search">
                        <MagnifyingGlass size={15} weight="bold" />
                        <span className="visually-hidden">Dosyalarda ara</span>
                        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Dosyalarda ara…" />
                    </label>
                    <button className="btn btn--hi" onClick={add}>
                        <FilePlus size={16} weight="bold" /> Dosya ekle
                    </button>
                </div>
            </header>

            {files && files.length === 0 ? (
                <button className="dropzone" onClick={add}>
                    <UploadSimple size={40} weight="bold" />
                    <span className="dropzone__big">Dosyayı buraya bırak</span>
                    <span className="mono">PDF · Word · Excel · CSV · TXT · Markdown — en fazla 50 MB</span>
                </button>
            ) : (
                <ul className="shelf">
                    {list.map((f) => (
                        <li key={f.id}>
                            <Link to={`/dosyalar/${f.id}`} className="doc" data-kind={f.kind}>
                                <span className="doc__kind mono">{badge(f.kind)}</span>
                                <span className="doc__name">{f.name}</span>
                                <span className="doc__meta mono">
                                    {KIND_LABEL[f.kind]} · {formatSize(f.size)} · {ago(f.updatedAt)}
                                </span>
                                <span className="doc__foot">
                                    {!!clipCounts?.get(f.id) && <span className="doc__chip mono">{clipCounts.get(f.id)} kesit</span>}
                                    {f.edited === 1 && <span className="doc__chip doc__chip--edit mono">düzenlendi</span>}
                                </span>
                            </Link>
                        </li>
                    ))}
                    {files && files.length > 0 && list.length === 0 && <li className="shelf__none">“{query}” ile eşleşen dosya yok.</li>}
                </ul>
            )}

            {dragging && (
                <div className="dropveil" aria-hidden>
                    <p>Bırak, masaya dizelim.</p>
                </div>
            )}
        </div>
    );
}

function badge(kind: FileKind) {
    return kind === 'docx' ? 'DOC' : kind === 'xlsx' ? 'XLS' : kind.toUpperCase();
}
