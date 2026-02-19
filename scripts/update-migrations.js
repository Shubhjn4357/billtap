const fs = require('fs');
const path = require('path');

const migrationsDir = path.join(__dirname, '../src/db/migrations');
const journalPath = path.join(migrationsDir, 'meta/_journal.json');
const indexPath = path.join(migrationsDir, 'index.ts');

if (!fs.existsSync(journalPath)) {
    console.error('Journal file not found:', journalPath);
    process.exit(1);
}

const journal = JSON.parse(fs.readFileSync(journalPath, 'utf8'));
const entries = journal.entries;

const imports = [];
const exports = [];

entries.forEach((entry) => {
    const name = `m${entry.idx.toString().padStart(4, '0')}`;
    const fileName = `${entry.tag}.sql`;
    imports.push(`import ${name} from './${fileName}';`);
    exports.push(`    ${name},`);
});

const content = `${imports.join('\n')}
import journal from './meta/_journal.json';

export default {
  journal,
  migrations: {
${exports.join('\n')}
  }
};
`;

fs.writeFileSync(indexPath, content);
console.log('Updated migrations/index.ts with', entries.length, 'migrations.');
