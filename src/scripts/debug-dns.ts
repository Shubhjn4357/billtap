import dns from 'dns';

const host = 'ep-crimson-cell-aidth6dg-pooler.c-4.us-east-1.aws.neon.tech';

async function testLookup() {
    console.log('Testing default lookup...');
    try {
        await new Promise((resolve, reject) => {
            dns.lookup(host, (err, address) => {
                if (err) reject(err);
                else {
                    console.log('Default lookup success:', address);
                    resolve(address);
                }
            });
        });
    } catch (e: any) {
        console.error('Default lookup failed:', e.code);
    }
}

async function testResolve() {
    console.log('Testing resolve4 with 8.8.8.8...');
    dns.setServers(['8.8.8.8']);
    try {
        const addresses = await dns.promises.resolve4(host);
        console.log('Resolve4 success:', addresses);
        return addresses[0];
    } catch (e: any) {
        console.error('Resolve4 failed:', e.message);
        return null;
    }
}

async function testMonkeyPatch() {
    console.log('Testing monkey patch...');
    
    const originalLookup = dns.lookup;
    
    // @ts-ignore
    dns.lookup = (hostname: string, options: any, callback: any) => {
        if (typeof options === 'function') {
            callback = options;
            options = {};
        }
        
        console.log('Intercepted lookup for:', hostname);
        
        dns.resolve4(hostname, (err, addresses) => {
            if (err) {
                console.log('Resolve failed, falling back to original');
                originalLookup(hostname, options, callback);
            } else if (addresses && addresses.length > 0) {
                const address = addresses[0];
                console.log('Resolved via intercept:', address);
                callback(null, address, 4);
            } else {
                 originalLookup(hostname, options, callback);
            }
        });
    };

    try {
        await new Promise((resolve, reject) => {
            dns.lookup(host, {}, (err, address) => {
                if (err) reject(err);
                else {
                    console.log('Monkey patched lookup success:', address);
                    resolve(address);
                }
            });
        });
    } catch (e: any) {
        console.error('Monkey patched lookup failed:', e.message);
    }
}

async function run() {
    await testLookup();
    await testResolve();
    await testMonkeyPatch();
}

run();
