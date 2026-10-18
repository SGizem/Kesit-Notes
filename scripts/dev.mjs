// "Kesit'e sor" açıkken kullanılır (web/src/lib/brand.ts → FEATURES.sor): uygulama + sunucu birlikte. Ctrl+C ikisini de kapatır.
import { spawn } from 'node:child_process';

const run = (name, args) => {
    const p = spawn('npm', args, { stdio: 'inherit', shell: true });
    p.on('exit', (code) => {
        console.log(`[${name}] kapandı (${code})`);
        process.exit(code ?? 0);
    });
    return p;
};

const procs = [run('sunucu', ['run', 'dev:server']), run('web', ['run', 'dev:web'])];
const stop = () => procs.forEach((p) => p.kill());
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
