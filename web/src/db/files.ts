import { db, newId, type FileKind, type StoredFile } from './db';
import { readSheets } from '../lib/sheets';
import { htmlToPlain } from '../lib/format';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const ACCEPT = '.pdf,.docx,.xlsx,.xls,.csv,.txt,.md,.markdown';

export function kindOf(name: string): FileKind | null {
    const ext = name.toLowerCase().split('.').pop() ?? '';
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'csv') return 'csv';
    if (ext === 'txt') return 'txt';
    if (ext === 'md' || ext === 'markdown') return 'md';
    return null;
}

export class ImportError extends Error {}

/**
 * Dosyayı okuyup düzenlenebilir biçime çevirir ve kaydeder. Asıl dosya da saklanır.
 * PDF içeriği değiştirilmez; düzenleme yerine üzerinde kesit alınır.
 */
export async function importFile(file: File): Promise<{ file: StoredFile; warning?: string }> {
    const kind = kindOf(file.name);
    if (!kind) throw new ImportError(`${file.name}: bu dosya türü desteklenmiyor (PDF, Word, Excel, CSV, TXT, MD).`);
    if (file.size > MAX_FILE_BYTES) throw new ImportError(`${file.name}: 50 MB'tan büyük dosyalar şimdilik yüklenemiyor.`);

    const now = Date.now();
    const stored: StoredFile = {
        id: newId(),
        name: file.name,
        kind,
        size: file.size,
        blob: file,
        edited: 0,
        createdAt: now,
        updatedAt: now,
    };
    let warning: string | undefined;

    if (kind === 'docx') {
        const mammoth = await import('mammoth');
        const { value } = await mammoth.convertToHtml({ arrayBuffer: await file.arrayBuffer() });
        stored.html = value;
        stored.plain = htmlToPlain(value);
    } else if (kind === 'xlsx' || kind === 'csv') {
        const { sheets, truncated } = readSheets(await file.arrayBuffer(), kind);
        stored.sheets = sheets;
        stored.plain = sheets.flatMap((s) => s.rows.flat()).join(' ').slice(0, 20000);
        if (truncated) warning = `${file.name}: tablo çok büyük, ilk 5000 satır ve 200 sütun açıldı.`;
    } else if (kind === 'txt' || kind === 'md') {
        stored.text = await file.text();
        stored.plain = stored.text.slice(0, 20000);
    }

    await db.files.add(stored);
    return { file: stored, warning };
}

export async function saveFile(id: string, patch: Partial<Pick<StoredFile, 'name' | 'html' | 'text' | 'sheets' | 'plain'>>) {
    await db.files.update(id, { ...patch, edited: 1, updatedAt: Date.now() });
}

export async function renameFile(id: string, name: string) {
    await db.files.update(id, { name, updatedAt: Date.now() });
}

/** Dosya silinir; ondan alınan kesitler masada kalır ama artık dosyaya bağlı değildir. */
export async function deleteFile(id: string) {
    await db.transaction('rw', db.files, db.clips, async () => {
        await db.files.delete(id);
        await db.clips.where('fileId').equals(id).modify((c) => {
            delete c.fileId;
            delete c.page;
            c.url = undefined;
            c.fragmentUrl = undefined;
        });
    });
}

export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export const KIND_LABEL: Record<FileKind, string> = {
    pdf: 'PDF',
    docx: 'Word',
    xlsx: 'Excel',
    csv: 'CSV',
    txt: 'Metin',
    md: 'Markdown',
};
