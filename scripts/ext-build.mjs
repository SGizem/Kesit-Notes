// Mağaza için eklenti paketi: extension/ klasörünü yayındaki uygulama adresine bağlar ve zip'ler.
//   npm run ext:build -- https://kesit-notes.vercel.app
// Çıktı: dist-extension/ (geliştirici modunda denemek için) + dist-extension.zip (mağazaya yüklenecek).
// extension/ klasörü değişmez; geliştirmede localhost:5173 ile çalışmaya devam eder.
import { cpSync, readFileSync, readdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'extension');
const out = join(root, 'dist-extension');
const zip = join(root, 'dist-extension.zip');
const DEV = 'http://localhost:5173';

const arg = process.argv[2] ?? process.env.APP_URL;
let appUrl;
try {
    appUrl = new URL(arg).origin;
} catch {
    console.error('Uygulamanın yayındaki adresini ver:  npm run ext:build -- https://kesit-notes.vercel.app');
    process.exit(1);
}
// --yerel-test: derlenmiş siteyi `vite preview` ile (http://localhost:4173) denemek için. Mağazaya bu gönderilmez.
const localTest = process.argv.includes('--yerel-test');
if (!appUrl.startsWith('https://') && !(localTest && /^http:\/\/localhost:\d+$/.test(appUrl))) {
    console.error(`Adres https ile başlamalı: ${appUrl}`);
    process.exit(1);
}

rmSync(out, { recursive: true, force: true });
rmSync(zip, { force: true });
cpSync(src, out, { recursive: true });

// manifest: köprü yalnızca yayındaki uygulamada çalışsın.
const manifestPath = join(out, 'manifest.json');
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const bridge = manifest.content_scripts.find((c) => c.js.includes('bridge.js'));
bridge.matches = [`${appUrl}/*`];
writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 4)}\n`);

// background.js: uygulamayı açma adresi ve "sayfalarda göster" dışında tutulan adres.
const bgPath = join(out, 'background.js');
let bg = readFileSync(bgPath, 'utf8');
const before = bg;
bg = bg.replace(`const DEFAULT_APP_URL = '${DEV}';`, `const DEFAULT_APP_URL = '${appUrl}';`);
bg = bg.replace(`excludeMatches: ['${DEV}/*', 'http://127.0.0.1:5173/*'],`, `excludeMatches: ['${appUrl}/*'],`);
if (bg === before || bg.includes('localhost:5173')) {
    console.error('background.js beklenen biçimde değil; DEFAULT_APP_URL / excludeMatches satırlarını kontrol et.');
    process.exit(1);
}
writeFileSync(bgPath, bg);

// Geriye localhost kalmasın (mağaza incelemesinde soru işareti olur).
const leftovers = ['manifest.json', 'background.js', 'bridge.js', 'popup.js', 'sidepanel.js'].filter((f) =>
    existsSync(join(out, f)) && /localhost:5173|127\.0\.0\.1/.test(readFileSync(join(out, f), 'utf8')),
);
if (leftovers.length) {
    console.error(`Hâlâ localhost geçen dosyalar: ${leftovers.join(', ')}`);
    process.exit(1);
}

// Windows 10+ ve macOS/Linux'taki tar zip yazabiliyor (bsdtar). Dosyalar zip'in kökünde olmalı.
// Windows'ta Git'in GNU tar'ı zip yazamaz, sistemdekini kullan.
const tar = process.platform === 'win32' ? join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
execFileSync(tar, ['-a', '-c', '-f', 'dist-extension.zip', '-C', 'dist-extension', ...readdirSync(out)], { cwd: root, stdio: 'inherit' });
console.log(`Hazır: ${manifest.name} ${manifest.version} → ${appUrl}\n  ${out}\n  ${zip}`);
