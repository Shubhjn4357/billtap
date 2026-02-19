import { BaseRepository } from './baseRepository';
import { db } from '../db/client';
import { settings } from '../db/schema';
import { eq } from 'drizzle-orm';

export class SettingsRepository extends BaseRepository {
    async get(key: string): Promise<string | null> {
        const result = await db.select().from(settings).where(eq(settings.key, key));
        return result[0]?.value ?? null;
    }

    async set(key: string, value: string) {

        await db.insert(settings)
            .values({ key, value })
            .onConflictDoUpdate({
                target: settings.key,
                set: { value },
            });

        // Settings might trigger sync actions if they are global
        // For now, let's assume they are local-first but maybe synced later
        await this.enqueueAction('UPDATE_SETTINGS', { key, value });
    }

    async getAll(): Promise<Record<string, string>> {
        const allSettings = await db.select().from(settings);
        return allSettings.reduce((acc, curr) => {
            acc[curr.key] = curr.value;
            return acc;
        }, {} as Record<string, string>);
    }
}

export const settingsRepository = new SettingsRepository();
