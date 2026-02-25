const dns = require('node:dns');

const PUBLIC_DNS_SERVERS = ['8.8.8.8', '1.1.1.1'];
const TARGET_SUFFIX = '.neon.tech';

const originalLookup = dns.lookup.bind(dns);

try {
    dns.setServers(PUBLIC_DNS_SERVERS);
} catch {
    // Ignore runtimes that don't allow custom DNS servers.
}

dns.lookup = function patchedLookup(hostname, options, callback) {
    const cb = typeof options === 'function' ? options : callback;
    const lookupOptions = typeof options === 'function' || options == null ? {} : options;

    if (typeof cb !== 'function') {
        return originalLookup(hostname, lookupOptions, cb);
    }

    const normalizedHost = typeof hostname === 'string' ? hostname.toLowerCase() : '';
    const shouldPatch = normalizedHost.endsWith(TARGET_SUFFIX) || normalizedHost.includes(`${TARGET_SUFFIX}/`);

    if (!shouldPatch) {
        return originalLookup(hostname, lookupOptions, cb);
    }

    dns.resolve4(hostname, (resolveError, addresses) => {
        if (!resolveError && Array.isArray(addresses) && addresses.length > 0) {
            if (lookupOptions && lookupOptions.all) {
                cb(null, addresses.map((address) => ({ address, family: 4 })));
                return;
            }
            cb(null, addresses[0], 4);
            return;
        }

        originalLookup(hostname, lookupOptions, cb);
    });
};
