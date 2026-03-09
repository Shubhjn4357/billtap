import type { OrganizationRole } from '../mappers/authMappers';
import type { Business, Subscription, User } from '../types/domain';
import { resolveBusinessQueryScope } from '../state/businessScope';

export type RuntimeSessionSnapshot = {
    user: User | null;
    business: Business | null;
    subscription: Subscription | null;
    organizationRole: OrganizationRole;
};

const DEFAULT_RUNTIME_SESSION: RuntimeSessionSnapshot = {
    user: null,
    business: null,
    subscription: null,
    organizationRole: 'owner',
};

let runtimeSession = { ...DEFAULT_RUNTIME_SESSION };

export const replaceRuntimeSessionSnapshot = (snapshot: RuntimeSessionSnapshot) => {
    runtimeSession = { ...snapshot };
};

export const clearRuntimeSessionSnapshot = () => {
    runtimeSession = { ...DEFAULT_RUNTIME_SESSION };
};

export const getRuntimeSessionSnapshot = (): RuntimeSessionSnapshot => runtimeSession;

export const getRuntimeBusinessId = (): string | null => runtimeSession.business?.id ?? null;

export const getRuntimeBusinessScope = (): string =>
    resolveBusinessQueryScope(getRuntimeBusinessId());

export const getRuntimeUserId = (): string | null => runtimeSession.user?.id ?? null;

export const getRuntimeOrganizationRole = (): OrganizationRole =>
    runtimeSession.organizationRole;

export const getRuntimeSubscription = (): Subscription | null =>
    runtimeSession.subscription;
