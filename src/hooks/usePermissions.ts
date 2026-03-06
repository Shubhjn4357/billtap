/**
 * usePermissions — centralized role + subscription access control hook.
 *
 * Returns helpers for checking module access and action permissions so
 * screens don't need to import authStore + accessControl separately.
 */

import { useAuthStore } from '../store/authStore';
import {
    canAccessModule,
    canPerformAction,
    canUsePos,
    type AppModule,
    type AppAction,
    type OrganizationRole,
} from '../utils/accessControl';
import type { Subscription } from '../types/domain';

export interface Permissions {
    role: OrganizationRole;
    subscription: Subscription | null;
    /** Check if the current role can access a module (with subscription check) */
    canModule: (module: AppModule) => boolean;
    /** Check if the current role can perform an action (with subscription check) */
    can: (action: AppAction) => boolean;
    /** Whether the user can use POS mode */
    canPos: boolean;
    /** True if role is owner */
    isOwner: boolean;
    /** True if role is owner or manager */
    isManager: boolean;
}

export function usePermissions(): Permissions {
    const role = useAuthStore((s) => s.organizationRole);
    const subscription = useAuthStore((s) => s.subscription);

    return {
        role,
        subscription,
        canModule: (module: AppModule) => canAccessModule(role, module, subscription),
        can: (action: AppAction) => canPerformAction(role, action, subscription),
        canPos: canUsePos(subscription),
        isOwner: role === 'owner',
        isManager: role === 'owner' || role === 'manager',
    };
}
