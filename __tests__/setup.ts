// Global test setup
import { vi } from 'vitest';

// Silence console.error for expected RN warnings during tests
vi.spyOn(console, 'error').mockImplementation((msg: string) => {
    if (
        typeof msg === 'string' &&
        (msg.includes('Warning:') || msg.includes('act('))
    ) return;
     
    console.warn('[test error]', msg);
});
