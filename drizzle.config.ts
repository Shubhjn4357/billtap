import { defineConfig } from 'drizzle-kit';

export default defineConfig({
    schema: './src/db/schema.ts',
    out: './src/db/migrations',
    dialect: 'sqlite',
    driver: 'expo',
    strict: true,
    verbose: true,
});