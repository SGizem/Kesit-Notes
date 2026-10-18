import { lazy, StrictMode, Suspense, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider, useLocation, useSearchParams, type RouteObject } from 'react-router-dom';
import { FEATURES } from './lib/brand';
// Yazı tipleri sitenin içinde: dışarıya (Google Fonts) istek gitmez, internetsiz de çalışır.
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/archivo/wdth-italic.css';
import '@fontsource-variable/newsreader/opsz.css';
import '@fontsource-variable/newsreader/opsz-italic.css';
import '@fontsource-variable/jetbrains-mono/index.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/shell.css';
import './styles/clip.css';
import './styles/desk.css';
import './styles/notes.css';
import './styles/overlay.css';
import './styles/files.css';
import './styles/ask.css';
import './styles/legal.css';
import './styles/welcome.css';
import { Shell } from './components/Shell';
import { DeskPage } from './features/desk/DeskPage';
import { PrivacyPage } from './features/legal/PrivacyPage';
import { startBridge } from './bridge/extensionBridge';
import { openAccountDb } from './db/db';
import { startAuth, useAuth } from './lib/auth';
import { toast } from './lib/toast';
import { Landing } from './features/welcome/Landing';
import { AuthPage } from './features/welcome/AuthPage';
import { PublicPage } from './features/welcome/PublicPage';

// Editör (TipTap/ProseMirror) ağır; masayı açarken yüklenmesin.
const LazyNotes = lazy(() => import('./features/notes/NotesPage').then((m) => ({ default: m.NotesPage })));
const NotesPage = () => (
    <Suspense fallback={null}>
        <LazyNotes />
    </Suspense>
);

// Dosyalar: pdf.js, SheetJS, mammoth gibi ağır kütüphaneler sadece bu sayfada yüklenir.
const LazyFiles = lazy(() => import('./features/files/FilesPage').then((m) => ({ default: m.FilesPage })));
const FilesPage = () => (
    <Suspense fallback={null}>
        <LazyFiles />
    </Suspense>
);

const LazyAsk = lazy(() => import('./features/ask/AskPage').then((m) => ({ default: m.AskPage })));
const AskPage = () => (
    <Suspense fallback={null}>
        <LazyAsk />
    </Suspense>
);

/** Giriş yapılmışken /giris ve /kayit: Google dönüşünde ?next= ile istenen sayfaya geç. */
function AfterSignIn() {
    const [params] = useSearchParams();
    const next = params.get('next');
    return <Navigate to={next?.startsWith('/') && !next.startsWith('//') ? next : '/'} replace />;
}

/** Giriş yapmadan uygulama içi bir adrese gelindiyse: girişe, sonra o adrese. */
function ToSignIn() {
    const { pathname, search } = useLocation();
    return <Navigate to={`/giris?next=${encodeURIComponent(pathname + search)}`} replace />;
}

const appRoutes: RouteObject[] = [
    {
        element: <Shell />,
        children: [
            { index: true, element: <DeskPage /> },
            { path: 'notlar', element: <NotesPage /> },
            { path: 'notlar/:noteId', element: <NotesPage /> },
            { path: 'dosyalar', element: <FilesPage /> },
            { path: 'dosyalar/:fileId', element: <FilesPage /> },
            { path: 'gizlilik', element: <PrivacyPage /> },
            ...(FEATURES.sor
                ? [
                      { path: 'sor', element: <AskPage /> },
                      { path: 'sor/:chatId', element: <AskPage /> },
                  ]
                : []),
            { path: 'giris', element: <AfterSignIn /> },
            { path: 'kayit', element: <AfterSignIn /> },
            // Kapalı özelliklerin ya da yanlış yazılmış adreslerin yolu masaya çıkar.
            { path: '*', element: <Navigate to="/" replace /> },
        ],
    },
];

const publicRoutes: RouteObject[] = [
    { index: true, element: <Landing /> },
    { path: 'giris', element: <AuthPage mode="giris" /> },
    { path: 'kayit', element: <AuthPage mode="kayit" /> },
    {
        path: 'gizlilik',
        element: (
            <PublicPage>
                <PrivacyPage />
            </PublicPage>
        ),
    },
    { path: '*', element: <ToSignIn /> },
];

startAuth();

function App() {
    const auth = useAuth();
    // Hesabın veritabanı açılıp (gerekirse eski veri taşınıp) hazır olunca uygulama açılır.
    const [readyFor, setReadyFor] = useState<string | null>(null);
    const accountId = auth.status === 'signed-in' ? auth.account.id : null;
    const dev = auth.status === 'signed-in' && !!auth.account.dev;

    useEffect(() => {
        if (!accountId) return;
        let alive = true;
        void openAccountDb(accountId, dev).then(({ moved }) => {
            if (!alive) return;
            startBridge();
            setReadyFor(accountId);
            if (moved) toast(`Bu tarayıcıdaki ${moved} kayıt hesabına taşındı`);
        });
        return () => {
            alive = false;
        };
    }, [accountId, dev]);

    const mode = auth.status === 'signed-out' ? 'public' : accountId && readyFor === accountId ? 'app' : null;
    const router = useMemo(() => (mode ? createBrowserRouter(mode === 'app' ? appRoutes : publicRoutes) : null), [mode]);
    useEffect(() => () => router?.dispose(), [router]);

    if (!router) return <div className="boot" aria-busy="true" />;
    return <RouterProvider router={router} />;
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <App />
    </StrictMode>,
);
