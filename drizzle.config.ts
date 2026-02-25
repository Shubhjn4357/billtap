import type { Config } from 'drizzle-kit';
import * as dns from 'node:dns';

const NEON_DNS_SUFFIX = 'neon.tech';
const PUBLIC_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string, family: number) => void;
type LookupAllCallback = (err: NodeJS.ErrnoException | null, addresses: dns.LookupAddress[]) => void;

const patchDnsLookup = (dnsModule: typeof dns) => {
    try {
        dnsModule.setServers(PUBLIC_DNS_SERVERS);
    } catch {
        // Ignore restricted runtime DNS server mutations.
    }

    const originalLookup = dnsModule.lookup.bind(dnsModule);

    const patchedLookup: typeof dns.lookup = ((hostname: string, options?: any, callback?: any) => {
        const cb = (typeof options === 'function' ? options : callback) as LookupCallback | LookupAllCallback | undefined;
        const lookupOptions = (typeof options === 'function' || options == null ? {} : options) as dns.LookupOneOptions | dns.LookupAllOptions;

        if (!cb) {
            return originalLookup(hostname, lookupOptions as any, cb as any);
        }

        if (!hostname.includes(NEON_DNS_SUFFIX)) {
            return originalLookup(hostname, lookupOptions as any, cb as any);
        }

        dnsModule.resolve4(hostname, (resolveError, addresses) => {
            if (!resolveError && addresses && addresses.length > 0) {
                if ((lookupOptions as dns.LookupAllOptions).all) {
                    const mapped: dns.LookupAddress[] = addresses.map((address) => ({ address, family: 4 }));
                    (cb as LookupAllCallback)(null, mapped);
                    return;
                }
                (cb as LookupCallback)(null, addresses[0]!, 4);
                return;
            }
            originalLookup(hostname, lookupOptions as any, cb as any);
        });
    }) as typeof dns.lookup;

    dnsModule.lookup = patchedLookup;
};

patchDnsLookup(dns);


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
