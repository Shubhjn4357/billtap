import { execSync } from 'child_process';

const log = (msg) => console.log('\x1b[34m' + msg + '\x1b[0m');
const success = (msg) => console.log('\x1b[32m' + msg + '\x1b[0m');
const error = (msg) => console.log('\x1b[31m' + msg + '\x1b[0m');

async function runStep(name, command) {
    log(`\n[${name.toUpperCase().padEnd(12)}]  ${command.padEnd(40)}`);
    try {
        const start = Date.now();
        execSync(command, { stdio: 'inherit' });
        const duration = ((Date.now() - start) / 1000).toFixed(2);
        success(`PASS   ${duration}s`);
    } catch (e) {
        error(`FAIL`);
        process.exit(1);
    }
}

async function verify() {
    console.log('\x1b[1m' + '═'.repeat(72));
    console.log('  🔬  VAHI SERVER VERIFICATION PIPELINE');
    console.log('  ' + new Date().toLocaleString());
    console.log('═'.repeat(72) + '\x1b[0m');

    await runStep('Typecheck', 'pnpm typecheck');

    console.log('\x1b[32m\x1b[1m\n✅  SERVER VERIFICATION COMPLETE - READY FOR DEPLOY\n\x1b[0m');
}

verify();
