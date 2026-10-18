/** "#okuma #yapay-zeka" gibi etiketleri metinden çıkarır. Türkçe harfleri destekler. */
const TAG_RE = /(?:^|\s)#([\p{L}\p{N}_-]{1,40})/gu;

export function normalizeTag(tag: string): string {
    return tag.replace(/^#/, '').trim().toLocaleLowerCase('tr');
}

export function extractTags(text: string | undefined): string[] {
    if (!text) return [];
    return [...new Set([...text.matchAll(TAG_RE)].map((m) => normalizeTag(m[1])))];
}

export function mergeTags(...lists: (string[] | undefined)[]): string[] {
    return [...new Set(lists.flatMap((l) => l ?? []).map(normalizeTag).filter(Boolean))];
}
