interface ImportMetaEnv {
    /** Supabase proje adresi, örn. https://abcd.supabase.co (web/.env.local ve Cloudflare Pages ortam değişkeni) */
    readonly VITE_SUPABASE_URL?: string;
    /** Supabase "publishable" (eski adıyla anon) anahtarı. Tarayıcıda görünmesi normaldir, gizli değildir. */
    readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
