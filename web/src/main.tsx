import { lazy, StrictMode, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
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
import { Shell } from './components/Shell';
import { DeskPage } from './features/desk/DeskPage';
import { PrivacyPage } from './features/legal/PrivacyPage';
import { startBridge } from './bridge/extensionBridge';

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

startBridge();

const router = createBrowserRouter([
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
            // Kapalı özelliklerin ya da yanlış yazılmış adreslerin yolu masaya çıkar.
            { path: '*', element: <Navigate to="/" replace /> },
        ],
    },
]);

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>,
);
