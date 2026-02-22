// Minimal stub for expo-sqlite used during unit tests.
// The real module exports `openDatabaseSync` which returns a database
// object consumed by drizzle-orm.  We only need to return a harmless
// object since our tests never operate on the DB.

export function openDatabaseSync(_name: string) {
    // return a fake "database" with methods drizzle might call
    return {
        transaction: (fn: Function) => {
            try {
                fn({ executeSql: () => { } });
            } catch { }
        },
        exec: () => { },
        // drizzle may call `prepareStatement` etc; provision generic no-ops
        prepareStatement: () => ({ execute: () => { } }),
    } as any;
}

// Following exports exist in the real module but are unused here
export const SQLTransactionCallback = Function;
export const SQLResultSetCallback = Function;
