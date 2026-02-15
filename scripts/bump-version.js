const fs = require('fs');
const path = require('path');

const bumpType = (process.env.BUMP_TYPE || 'patch').toLowerCase();
if (!['patch', 'minor', 'major'].includes(bumpType)) {
    throw new Error(`Invalid BUMP_TYPE: ${bumpType}`);
}

const packageJsonPath = path.resolve(__dirname, '..', 'package.json');
const appJsonPath = path.resolve(__dirname, '..', 'app.json');
const changelogPath = path.resolve(__dirname, '..', 'CHANGELOG.md');

const readJson = (filePath) => JSON.parse(fs.readFileSync(filePath, 'utf8'));
const writeJson = (filePath, data) => {
    fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`);
};

const bumpSemver = (version, type) => {
    const parts = version.split('.').map((part) => Number(part));
    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
        throw new Error(`Invalid semver version: ${version}`);
    }

    const [major, minor, patch] = parts;
    if (type === 'major') return `${major + 1}.0.0`;
    if (type === 'minor') return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
};

const bumpNumericString = (value) => {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed)) return '1';
    return String(parsed + 1);
};

const packageJson = readJson(packageJsonPath);
const appJson = readJson(appJsonPath);

const previousVersion = packageJson.version;
const nextVersion = bumpSemver(previousVersion, bumpType);

packageJson.version = nextVersion;
appJson.expo = appJson.expo || {};
appJson.expo.version = nextVersion;

if (!appJson.expo.android) appJson.expo.android = {};
appJson.expo.android.versionCode = Number(appJson.expo.android.versionCode || 0) + 1;

if (!appJson.expo.ios) appJson.expo.ios = {};
appJson.expo.ios.buildNumber = bumpNumericString(appJson.expo.ios.buildNumber);

writeJson(packageJsonPath, packageJson);
writeJson(appJsonPath, appJson);

const today = new Date().toISOString().slice(0, 10);
const newEntry = `## ${nextVersion} - ${today}\n- Automated ${bumpType} version bump.\n`;

let changelog = '';
if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, 'utf8');
}

if (!changelog.startsWith('# Changelog')) {
    changelog = `# Changelog\n\n${changelog.trim()}\n`;
}

const updatedChangelog = changelog.includes(newEntry)
    ? changelog
    : `${changelog.trim()}\n\n${newEntry}\n`;

fs.writeFileSync(changelogPath, updatedChangelog.trim() + '\n');

console.log(`Version bumped: ${previousVersion} -> ${nextVersion}`);
