const store: Record<string, string> = {};
export default {
    getItem: async (k: string) => store[k] ?? null,
    setItem: async (k: string, v: string) => { store[k] = v; },
    removeItem: async (k: string) => { delete store[k]; },
    clear: async () => { for (const k in store) delete store[k]; },
    getAllKeys: async () => Object.keys(store),
    multiGet: async (keys: string[]) => keys.map((k) => [k, store[k] ?? null] as [string, string | null]),
    multiSet: async (pairs: [string, string][]) => { pairs.forEach(([k, v]) => { store[k] = v; }); },
    multiRemove: async (keys: string[]) => { keys.forEach((k) => { delete store[k]; }); },
};
