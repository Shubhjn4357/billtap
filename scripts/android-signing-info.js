const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const scriptDir = path.dirname(process.argv[1]);
const projectRoot = path.resolve(scriptDir, '..');

const parseArgs = () => {
  const args = process.argv.slice(2);
  const map = {};
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = args[i + 1];
    if (!next || next.startsWith('--')) {
      map[key] = 'true';
      continue;
    }
    map[key] = next;
    i += 1;
  }
  return map;
};

const args = parseArgs();

const debugKeystore = path.resolve(projectRoot, args['debug-keystore'] || 'android/app/debug.keystore');
const debugAlias = args['debug-alias'] || 'androiddebugkey';
const debugStorePass = args['debug-store-pass'] || 'android';

const releaseKeystore = path.resolve(projectRoot, args['release-keystore'] || 'android/app/release.keystore');
const releaseAlias = args['release-alias'] || process.env.BILLTAP_UPLOAD_KEY_ALIAS || '';
const releaseStorePass = args['release-store-pass'] || process.env.BILLTAP_UPLOAD_STORE_PASSWORD || '';
const releaseKeyPass = args['release-key-pass'] || process.env.BILLTAP_UPLOAD_KEY_PASSWORD || '';
const includeBase64 = args.base64 === 'true';

const ensureKeytoolAvailable = () => {
  try {
    execFileSync('keytool', ['-help'], { stdio: 'ignore' });
  } catch (error) {
    const code = error && typeof error === 'object' ? error.code : undefined;
    if (code === 'ENOENT') {
      throw new Error('`keytool` not found in PATH. Install JDK 17+ and reopen your terminal.');
    }
    throw error;
  }
};

const runKeytool = (keystorePath, alias, storePass, keyPass) => {
  if (!fs.existsSync(keystorePath)) {
    throw new Error(`Keystore not found: ${keystorePath}`);
  }

  const keytoolArgs = ['-list', '-v', '-keystore', keystorePath, '-alias', alias, '-storepass', storePass];
  if (keyPass) {
    keytoolArgs.push('-keypass', keyPass);
  }

  const output = execFileSync('keytool', keytoolArgs, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const sha1 = output.match(/SHA1:\s*([A-F0-9:]+)/i)?.[1] || '';
  const sha256 = output.match(/SHA256:\s*([A-F0-9:]+)/i)?.[1] || '';

  if (!sha1 || !sha256) {
    throw new Error(`Unable to parse SHA fingerprints for alias "${alias}" in ${keystorePath}`);
  }

  return { sha1, sha256 };
};

const printSection = (title) => {
  console.log('\n' + '='.repeat(80));
  console.log(title);
  console.log('='.repeat(80));
};

try {
  ensureKeytoolAvailable();
  const debug = runKeytool(debugKeystore, debugAlias, debugStorePass);
  printSection('DEBUG SIGNING FINGERPRINTS');
  console.log(`debug_keystore_path=${debugKeystore}`);
  console.log(`debug_alias=${debugAlias}`);
  console.log(`debug_sha1=${debug.sha1}`);
  console.log(`debug_sha256=${debug.sha256}`);

  const canReadRelease = fs.existsSync(releaseKeystore) && releaseAlias && releaseStorePass;

  if (canReadRelease) {
    const release = runKeytool(releaseKeystore, releaseAlias, releaseStorePass, releaseKeyPass || undefined);
    printSection('RELEASE SIGNING FINGERPRINTS');
    console.log(`release_keystore_path=${releaseKeystore}`);
    console.log(`release_alias=${releaseAlias}`);
    console.log(`release_sha1=${release.sha1}`);
    console.log(`release_sha256=${release.sha256}`);

    if (includeBase64) {
      printSection('GITHUB SECRET VALUE');
      const base64 = fs.readFileSync(releaseKeystore).toString('base64');
      console.log('ANDROID_KEYSTORE_BASE64=' + base64);
    }
  } else {
    printSection('RELEASE SIGNING FINGERPRINTS');
    console.log('release_keystore=not_found_or_missing_credentials');
    console.log(`expected_path=${releaseKeystore}`);
    console.log('To read release SHA, pass:');
    console.log('  --release-keystore <path> --release-alias <alias> --release-store-pass <password> [--release-key-pass <password>]');
  }

  printSection('GOOGLE CONSOLE VALUES');
  console.log('Android package name: com.autoloop.vahi');
  console.log('Use debug_sha1 and release_sha1 in Google Cloud OAuth Android client(s).');
  console.log('Use release_sha256 for Play Integrity / advanced checks if needed.');

  printSection('RECOMMENDED GITHUB SECRETS');
  console.log('ANDROID_KEYSTORE_BASE64=<base64_of_release_keystore>');
  console.log('ANDROID_KEYSTORE_PASSWORD=<keystore_store_password>');
  console.log('ANDROID_KEY_ALIAS=<release_alias>');
  console.log('ANDROID_KEY_PASSWORD=<key_password>');
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
}
