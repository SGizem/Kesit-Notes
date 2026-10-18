import { useSyncExternalStore } from 'react';
import { liveQuery } from 'dexie';
import type { Clip } from '../db/db';
import { db } from '../db/db';
import { createClipIfMissing, patchClip } from '../db/clips';

/**
 * Eklenti ↔ uygulama köprüsü.
 *
 * Eklentinin bridge.js içerik betiği bu sayfada çalışır ve chrome.storage'daki
 * kesit kuyruğunu window.postMessage ile buraya taşır. Biz işlemleri IndexedDB'ye
 * yazar, opId'leri onaylarız; eklenti onaylananları kuyruktan siler.
 * Uygulama kapalıyken alınan kesitler kuyrukta bekler, kaybolmaz.
 */

const APP = 'kesit-app';
const EXT = 'kesit-ext';

type Op =
    | { opId: string; op: 'put'; clip: Partial<Clip> & { id: string } }
    | { opId: string; op: 'patch'; id: string; patch: Partial<Clip> }
    | { opId: string; op: 'delete'; id: string };

type ExtMessage =
    | { source: typeof EXT; type: 'hello'; version: string }
    | { source: typeof EXT; type: 'ops'; ops: Op[] };

export type BridgeStatus = 'checking' | 'connected' | 'missing';

let status: BridgeStatus = 'checking';
let version = '';
const listeners = new Set<() => void>();

function setStatus(next: BridgeStatus) {
    if (status === next) return;
    status = next;
    listeners.forEach((l) => l());
}

function post(type: string, extra: Record<string, unknown> = {}) {
    window.postMessage({ source: APP, type, ...extra }, window.location.origin);
}

async function applyOps(ops: Op[]) {
    const done: string[] = [];
    for (const op of ops) {
        try {
            if (op.op === 'put') await createClipIfMissing(op.clip);
            else if (op.op === 'patch') await patchClip(op.id, op.patch);
            else if (op.op === 'delete') await db.clips.delete(op.id);
            done.push(op.opId);
        } catch (err) {
            // Onaylanmayan işlem kuyrukta kalır, bir sonraki çekişte tekrar denenir.
            console.error('[kesit] işlem uygulanamadı', op, err);
        }
    }
    if (done.length) post('ack', { opIds: done });
}

/**
 * Uygulama → eklenti: kesitlerin hafif bir kopyası (bağlam ve not bağları hariç).
 * Eklenti bununla yan paneli doldurur ve sayfalardaki cümleleri yeniden çizer.
 * Uygulamada silinen ya da rengi değişen kesit böylece eklentiye de yansır.
 */
const MIRROR_MAX = 1000;
let mirrorSub: { unsubscribe(): void } | null = null;
let mirrorTimer: number | undefined;
let lastMirror: unknown[] | null = null;

function startMirror() {
    // Eklenti yeniden yüklendiyse yeni köprü son kopyayı bir daha ister.
    if (mirrorSub) {
        if (lastMirror) post('mirror', { clips: lastMirror });
        return;
    }
    mirrorSub = liveQuery(() => db.clips.orderBy('createdAt').reverse().limit(MIRROR_MAX).toArray()).subscribe({
        next: (clips) => {
            window.clearTimeout(mirrorTimer);
            mirrorTimer = window.setTimeout(() => {
                lastMirror = clips.map((c) => ({
                    id: c.id,
                    kind: c.kind,
                    text: c.text.slice(0, 1000),
                    comment: c.comment,
                    color: c.color,
                    url: c.url,
                    fragmentUrl: c.fragmentUrl,
                    title: c.title,
                    domain: c.domain,
                    favicon: c.favicon,
                    imageUrl: c.imageUrl,
                    tags: c.tags,
                    createdAt: c.createdAt,
                }));
                post('mirror', { clips: lastMirror });
            }, 400);
        },
        error: (err) => console.error('[kesit] ayna', err),
    });
}

let started = false;

/** Çıkışta: eklentideki kesit kopyasını boşalt; bir sonraki hesap öncekinin kesitlerini görmesin. */
export function clearExtensionMirror() {
    post('mirror', { clips: [] });
}

export function startBridge() {
    if (started) return;
    started = true;

    window.addEventListener('message', (e: MessageEvent) => {
        if (e.source !== window || e.origin !== window.location.origin) return;
        const msg = e.data as ExtMessage;
        if (!msg || msg.source !== EXT) return;
        if (msg.type === 'hello') {
            version = msg.version;
            setStatus('connected');
            post('pull');
            startMirror();
        } else if (msg.type === 'ops') {
            void applyOps(msg.ops);
        }
    });

    post('hello', { appUrl: window.location.origin });
    // Eklenti yoksa kimse cevap vermez.
    window.setTimeout(() => {
        if (status === 'checking') setStatus('missing');
    }, 1200);
}

export function useBridgeStatus() {
    const s = useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        () => status,
    );
    return { status: s, version };
}
