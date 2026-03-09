import { useAuthStore } from '../store/authStore';
import { resolveBusinessQueryScope } from '../state/businessScope';

export function useBusinessQueryScope(): string {
    return useAuthStore((state) => resolveBusinessQueryScope(state.business?.id ?? null));
}
