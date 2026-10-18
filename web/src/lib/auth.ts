import { useSyncExternalStore } from 'react';
import type { SupabaseClient, User as SbUser } from '@supabase/supabase-js';
import { clearExtensionMirror } from '../bridge/extensionBridge';

/**
 * Oturum: Google ile giriş, Supabase Auth üzerinden. Kesitler, notlar ve dosyalar yine tarayıcıda
 * durur; Supabase'te yalnızca hesap (ad, e-posta, profil fotoğrafı adresi) tutulur.
 *
 * Geliştirme/test kolaylığı: yalnızca `npm run dev` altında, localStorage 'kesit.dev-oturum' = '1'
 * ise "Geliştirici" hesabıyla girilir ve hesaplardan önceki "kesit" veritabanı kullanılır.
 */

export interface Account {
    id: string;
    name: string;
    email: string;
    avatar?: string;
    dev?: boolean;
}

export type AuthState =
    | { status: 'loading' }
    | { status: 'signed-out'; error?: string }
    | { status: 'signed-in'; account: Account };

const URL_ = import.meta.env.VITE_SUPABASE_URL;
const KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
export const AUTH_CONFIGURED = Boolean(URL_ && KEY);

const DEV_KEY = 'kesit.dev-oturum';
export const DEV_ACCOUNT: Account = { id: 'gelistirici', name: 'Geliştirici', email: 'gelistirici@yerel', dev: true };

let state: AuthState = { status: 'loading' };
const listeners = new Set<() => void>();
const set = (s: AuthState) => {
    state = s;
    listeners.forEach((l) => l());
};

let client: Promise<SupabaseClient> | null = null;
/** Supabase kütüphanesi yalnızca gerektiğinde yüklenir (tanıtım sayfası hafif kalsın). */
function supabase(): Promise<SupabaseClient> {
    if (!AUTH_CONFIGURED) return Promise.reject(new Error('Supabase ayarlanmamış'));
    client ??= import('@supabase/supabase-js').then(({ createClient }) =>
        createClient(URL_!, KEY!, {
            auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'kesit-oturum' },
        }),
    );
    return client;
}

const toAccount = (u: SbUser): Account => {
    const m = u.user_metadata ?? {};
    return {
        id: u.id,
        name: (m.full_name || m.name || u.email?.split('@')[0] || 'Okur') as string,
        email: u.email ?? '',
        avatar: (m.avatar_url || m.picture) as string | undefined,
    };
};

const devOn = () => {
    if (!import.meta.env.DEV) return false;
    try {
        return localStorage.getItem(DEV_KEY) === '1';
    } catch {
        return false;
    }
};

/** Google'dan dönüşte adres çubuğundaki hata (örn. kullanıcı izin vermedi). */
function urlError(): string | undefined {
    const q = new URLSearchParams(location.search);
    const h = new URLSearchParams(location.hash.slice(1));
    const msg = q.get('error_description') ?? h.get('error_description');
    if (!msg) return undefined;
    return /denied|cancel/i.test(msg) ? 'Google girişi iptal edildi.' : `Giriş tamamlanamadı: ${msg}`;
}

let started = false;
export function startAuth() {
    if (started) return;
    started = true;
    if (devOn()) return set({ status: 'signed-in', account: DEV_ACCOUNT });
    if (!AUTH_CONFIGURED) return set({ status: 'signed-out' });

    const error = urlError();
    void supabase()
        .then(async (sb) => {
            // Google'dan ?code=… ile dönüldüyse kütüphane oturumu kendisi kurar; getSession bunu bekler.
            const { data } = await sb.auth.getSession();
            set(data.session ? { status: 'signed-in', account: toAccount(data.session.user) } : { status: 'signed-out', error });
            sb.auth.onAuthStateChange((event, session) => {
                if (session?.user) {
                    if (state.status !== 'signed-in' || state.account.id !== session.user.id) set({ status: 'signed-in', account: toAccount(session.user) });
                } else if (event === 'SIGNED_OUT') set({ status: 'signed-out' });
            });
        })
        .catch(() => set({ status: 'signed-out', error: 'Giriş servisine ulaşılamadı. İnternet bağlantını kontrol et.' }));
}

export function useAuth(): AuthState {
    return useSyncExternalStore(
        (cb) => {
            listeners.add(cb);
            return () => listeners.delete(cb);
        },
        () => state,
    );
}

/** Google'a yönlendirir; dönüşte /giris?next=… sayfası oturumu tamamlar. */
export async function signInWithGoogle(next = '/') {
    const sb = await supabase();
    const redirectTo = `${location.origin}/giris?next=${encodeURIComponent(next)}`;
    const { error } = await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo } });
    if (error) throw error;
}

export function signInAsDeveloper() {
    if (!import.meta.env.DEV) return;
    try {
        localStorage.setItem(DEV_KEY, '1');
    } catch {}
    set({ status: 'signed-in', account: DEV_ACCOUNT });
}

export async function signOut() {
    try {
        localStorage.removeItem(DEV_KEY);
    } catch {}
    if (AUTH_CONFIGURED && state.status === 'signed-in' && !state.account.dev) {
        const sb = await supabase();
        await sb.auth.signOut({ scope: 'local' });
    }
    clearExtensionMirror();
    await new Promise((r) => setTimeout(r, 150)); // köprü mesajı eklentiye ulaşsın
    // Sayfayı baştan yükle: eklenti köprüsü ve açık veritabanı kapanır, tanıtım sayfası açılır.
    location.assign('/');
}
