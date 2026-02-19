import journal from './meta/_journal.json';

const migrationsMap: Record<string, string> = {};

const requireContext = require.context;

if (requireContext) {
    const context = requireContext('.', false, /\.sql$/);
    context.keys().forEach((key: string) => {
        const fileName = key.replace('./', '').replace('.sql', '');
        const module = context(key);
        // Handle both ES modules (default export) and CommonJS/Raw (module itself)
        migrationsMap[fileName] = typeof module === 'string' ? module : module.default;
    });
} else {
    console.warn('require.context not available. Migrations cannot be loaded dynamically.');
}

export const migrationData = {
    journal,
    migrations: migrationsMap,
};

