import Dexie, { type EntityTable } from 'dexie';
import { extractTags } from '../lib/tags';

/** Fosforlu kalem renkleri — eklentideki capture.js ile aynı anahtarlar. */
export const MARKERS = ['lime', 'orange', 'pink', 'violet'] as const;
export type Marker = (typeof MARKERS)[number];

export type ClipKind = 'text' | 'image' | 'link' | 'page' | 'manual';

export interface Clip {
    id: string;
    kind: ClipKind;
    text: string;
    /** Seçimin etrafındaki paragraf; "bu ne demekti?" sorusunun cevabı. */
    context?: string;
    comment?: string;
    color: Marker;
    url?: string;
    /** Kaynağı açınca seçili cümleye kaydıran #:~:text= bağlantısı. */
    fragmentUrl?: string;
    title?: string;
    domain?: string;
    favicon?: string;
    imageUrl?: string;
    /** Yorumdaki #etiketler + elle eklenenler; küçük harf. */
    tags: string[];
    /** Bu kesitin eklendiği notlar. */
    noteIds: string[];
    /** Uygulamaya yüklenmiş bir dosyadan alındıysa: dosya ve (PDF'te) sayfa. */
    fileId?: string;
    page?: number;
    createdAt: number;
    updatedAt: number;
}

export interface Note {
    id: string;
    title: string;
    /** TipTap HTML çıktısı. */
    html: string;
    /** Arama ve önizleme için düz metin. */
    plain: string;
    pinned: 0 | 1;
    createdAt: number;
    updatedAt: number;
}

export type FileKind = 'pdf' | 'docx' | 'xlsx' | 'csv' | 'txt' | 'md';

export interface Sheet {
    name: string;
    /** Hücreler metin; '=' ile başlayan formüldür. */
    rows: string[][];
}

export interface StoredFile {
    id: string;
    name: string;
    kind: FileKind;
    size: number;
    /** Yüklenen asıl dosya; PDF görüntüleme ve "aslını indir" için. */
    blob: Blob;
    /** docx: düzenlenen içerik (TipTap HTML). */
    html?: string;
    /** txt / md: düzenlenen metin. */
    text?: string;
    /** xlsx / csv: düzenlenen tablolar. */
    sheets?: Sheet[];
    /** Arama için düz metin (PDF'te ilk açılışta çıkarılır). */
    plain?: string;
    /** Düzenlendi mi? (asıl dosyadan farklı) */
    edited: 0 | 1;
    createdAt: number;
    updatedAt: number;
}

/** Cevapta atıf yapılabilecek bir kaynak (soru sorulurken Claude'a belge olarak gider). */
export interface SourceRef {
    kind: 'clip' | 'note' | 'file';
    id: string;
    title: string;
    /** Uygulama içi bağlantı: kesit masada, not editörde, dosya görüntüleyicide açılır. */
    href: string;
    color?: Marker;
}

/** Cevabın bir parçası ve dayandığı kaynaklar (sources dizisindeki sıra numaraları). */
export interface AnswerPart {
    text: string;
    cites: { doc: number; quote: string }[];
}

export interface ChatTurn {
    q: string;
    parts: AnswerPart[];
    sources: SourceRef[];
    status: 'done' | 'error' | 'stopped';
    error?: string;
    /** Cevabı yazan motor: model adı, "claude" ya da "yapay zekasız". */
    engine?: string;
    at: number;
}

export interface Chat {
    id: string;
    title: string;
    turns: ChatTurn[];
    createdAt: number;
    updatedAt: number;
}

export const db = new Dexie('kesit') as Dexie & {
    clips: EntityTable<Clip, 'id'>;
    notes: EntityTable<Note, 'id'>;
    files: EntityTable<StoredFile, 'id'>;
    chats: EntityTable<Chat, 'id'>;
};

db.version(1).stores({
    clips: 'id, createdAt, domain, color, *noteIds',
    notes: 'id, updatedAt, pinned',
});

// v2: etiketler. Eski kesitlerin yorumlarındaki #etiketler geriye dönük çıkarılır.
db.version(2)
    .stores({ clips: 'id, createdAt, domain, color, *noteIds, *tags' })
    .upgrade((tx) =>
        tx
            .table('clips')
            .toCollection()
            .modify((c: Clip) => {
                c.tags = extractTags(c.comment);
            }),
    );

// v3: dosyalar (PDF, Word, Excel, metin) ve dosyadan alınan kesitler.
db.version(3).stores({
    clips: 'id, createdAt, domain, color, *noteIds, *tags, fileId',
    files: 'id, updatedAt, kind',
});

// v4: "Kesit'e sor" sohbetleri.
db.version(4).stores({ chats: 'id, updatedAt' });

export const newId = () => crypto.randomUUID();
