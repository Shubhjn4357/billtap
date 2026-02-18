import { offlineKeyValueStore } from '../offline/db/offlineKeyValueStore';

export const ORG_SETTINGS_CACHE_KEY = 'billtap_org_settings_cache_v1';
export const ORG_TEMPLATES_CACHE_KEY = 'billtap_org_templates_cache_v1';
export const ORG_SIGNATURES_CACHE_KEY = 'billtap_org_signatures_cache_v1';
export const ORG_SIGNATURE_ID_MAP_KEY = 'billtap_org_signature_id_map_v1';
export const ORG_STUDENTS_CACHE_KEY = 'billtap_org_students_cache_v1';
export const ORG_FEE_REMINDERS_CACHE_KEY = 'billtap_org_fee_reminders_cache_v1';
export const ORG_LIST_CACHE_KEY = 'billtap_org_list_cache_v1';
export const ORG_CONTEXT_CACHE_KEY = 'billtap_org_context_cache_v1';
export const ORG_MEMBERS_CACHE_KEY = 'billtap_org_members_cache_v1';

export const getOrgCacheSlot = (organizationId?: string) => {
    const value = organizationId?.trim();
    return value ? value : '__default__';
};

const readOrgCacheMap = async <T>(cacheKey: string): Promise<Record<string, T>> => {
    const raw = await offlineKeyValueStore.getItem(cacheKey);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed as Record<string, T>;
    } catch {
        return {};
    }
};

const writeOrgCacheMap = async <T>(cacheKey: string, value: Record<string, T>) => {
    await offlineKeyValueStore.setItem(cacheKey, JSON.stringify(value));
};

export const getOrgCachedValue = async <T>(cacheKey: string, organizationId?: string): Promise<T | null> => {
    const map = await readOrgCacheMap<T>(cacheKey);
    return map[getOrgCacheSlot(organizationId)] ?? null;
};

export const setOrgCachedValue = async <T>(cacheKey: string, organizationId: string | undefined, value: T): Promise<void> => {
    const map = await readOrgCacheMap<T>(cacheKey);
    map[getOrgCacheSlot(organizationId)] = value;
    await writeOrgCacheMap(cacheKey, map);
};

export const readSignatureIdMap = async (): Promise<Record<string, string>> => {
    const raw = await offlineKeyValueStore.getItem(ORG_SIGNATURE_ID_MAP_KEY);
    if (!raw) return {};
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== 'object') return {};
        return parsed as Record<string, string>;
    } catch {
        return {};
    }
};

export const writeSignatureIdMap = async (map: Record<string, string>) => {
    await offlineKeyValueStore.setItem(ORG_SIGNATURE_ID_MAP_KEY, JSON.stringify(map));
};

export const getSignatureMapKey = (organizationId: string | undefined, signatureId: string) =>
    `${getOrgCacheSlot(organizationId)}:${signatureId}`;
