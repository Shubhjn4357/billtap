import type { UserProfile, UserRole } from '../types';

export const normalizeUserRole = (role: unknown): UserRole | undefined => {
    if (role === 'owner' || role === 'staff') {
        return role;
    }
    return undefined;
};

export function normalizeUserProfile(user: UserProfile): UserProfile;
export function normalizeUserProfile(user: null): null;
export function normalizeUserProfile(user: UserProfile | null): UserProfile | null;
export function normalizeUserProfile(user: UserProfile | null): UserProfile | null {
    if (!user) return null;
    const normalizedRole = normalizeUserRole(user.role);
    if (user.role === normalizedRole) {
        return user;
    }
    return {
        ...user,
        role: normalizedRole,
    };
}

export const normalizeUserProfiles = (users: UserProfile[] | undefined): UserProfile[] => {
    if (!users || users.length === 0) return [];
    return users.map((entry) => normalizeUserProfile(entry) ?? entry);
};
