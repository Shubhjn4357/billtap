export default {
    addEventListener: () => ({ remove: () => {} }),
    fetch: async () => ({ isConnected: true, isInternetReachable: true, type: 'wifi' }),
};
