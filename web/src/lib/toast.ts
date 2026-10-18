import { useSyncExternalStore } from 'react';

export interface Toast {
    id: number;
    text: string;
    tone: 'ok' | 'error';
}

let toasts: Toast[] = [];
let seq = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function toast(text: string, tone: Toast['tone'] = 'ok') {
    const t = { id: ++seq, text, tone };
    toasts = [...toasts, t].slice(-3);
    emit();
    setTimeout(() => {
        toasts = toasts.filter((x) => x.id !== t.id);
        emit();
    }, tone === 'error' ? 6000 : 3200);
}

export function useToasts() {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        () => toasts,
    );
}
