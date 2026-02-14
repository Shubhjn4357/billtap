import type { Config } from 'drizzle-kit';
import dns from 'dns';

// Hack to fix DNS resolution issue with Neon on local machine
dns.setServers(['8.8.8.8']);

const originalLookup = dns.lookup;
// @ts-ignore
dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
        callback = options;
        options = {};
    }

    if (hostname.includes('neon.tech')) {
        dns.resolve4(hostname, (err, addresses) => {
            if (!err && addresses && addresses.length > 0) {
                if (options && (options as any).all) {
                    const result = addresses.map(addr => ({ address: addr, family: 4 }));
                    // @ts-ignore
                    callback(null, result as any);
                } else {
                    callback(null, addresses[0] as any, 4);
                }
            } else {
                // @ts-ignore
                originalLookup(hostname, options as any, callback);
            }
        });
    } else {
        // @ts-ignore
        originalLookup(hostname, options as any, callback);
    }
};


export default {
    schema: './src/db/schema.ts',
    out: './drizzle',
    dialect: 'postgresql',
    dbCredentials: {
        url: process.env.DATABASE_URL || '',
    },
    strict: true,
    verbose: true,
} satisfies Config;
