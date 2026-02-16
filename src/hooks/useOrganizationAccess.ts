import { useCallback, useMemo, useState } from 'react';
import { businessSuiteService } from '../api/businessSuiteService';
import { useOrganizationStore } from '../store';
import { useAuth } from './useAuth';

export type StaffFeatureKey =
    | 'dashboard'
    | 'billing'
    | 'billingSale'
    | 'billingPurchase'
    | 'stock'
    | 'reports'
    | 'settings'
    | 'parties'
    | 'payments'
    | 'expenses'
    | 'templates'
    | 'staff'
    | 'subscription'
    | 'messages'
    | 'businessCards';

export type StaffFeatureAccessMap = Record<StaffFeatureKey, boolean>;

export const DEFAULT_STAFF_FEATURE_ACCESS: StaffFeatureAccessMap = {
    dashboard: true,
    billing: true,
    billingSale: true,
    billingPurchase: true,
    stock: true,
    reports: true,
    settings: true,
    parties: true,
    payments: true,
    expenses: true,
    templates: true,
    staff: true,
    subscription: true,
    messages: true,
    businessCards: true,
};

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
};

export const normalizeStaffFeatureAccess = (settings: Record<string, unknown>): StaffFeatureAccessMap => {
    const raw = asRecord(settings.staffFeatureAccess);
    const output = { ...DEFAULT_STAFF_FEATURE_ACCESS };
    for (const key of Object.keys(output) as StaffFeatureKey[]) {
        if (typeof raw[key] === 'boolean') {
            output[key] = raw[key] as boolean;
        }
    }
    return output;
};

export const useOrganizationAccess = () => {
    const { user } = useAuth();
    const {
        selectedOrganizationId,
        context,
        setSelectedOrganizationId,
        setOrganizationContext,
        setOrganizationSettings,
        clearOrganizationContext,
    } = useOrganizationStore();
    const [refreshingContext, setRefreshingContext] = useState(false);

    const isOwnerOrAdmin = context.role === 'owner' || user?.role === 'admin';
    const organizationPermissions = useMemo(
        () => context.permissions ?? {},
        [context.permissions]
    );
    const organizationSettings = useMemo(
        () => context.settings ?? {},
        [context.settings]
    );
    const staffFeatureAccess = useMemo(
        () => normalizeStaffFeatureAccess(organizationSettings),
        [organizationSettings]
    );

    const canByPermission = useCallback((permissionKey: string): boolean => {
        if (isOwnerOrAdmin) return true;
        return Boolean(organizationPermissions[permissionKey]);
    }, [isOwnerOrAdmin, organizationPermissions]);

    const canByFeature = useCallback((featureKey: StaffFeatureKey): boolean => {
        if (isOwnerOrAdmin) return true;
        return staffFeatureAccess[featureKey] !== false;
    }, [isOwnerOrAdmin, staffFeatureAccess]);

    const canViewDashboard = canByPermission('can_view_dashboard') && canByFeature('dashboard');
    const canManageInventory = canByPermission('can_manage_inventory') && canByFeature('stock');
    const canOpenBilling = canByPermission('can_create_bill') && canByFeature('billing');
    const canCreateSale = canByPermission('can_create_sale') && canByFeature('billingSale') && canOpenBilling;
    const canCreatePurchase = canByPermission('can_create_purchase') && canByFeature('billingPurchase') && canOpenBilling;
    const canViewReports = canByPermission('can_view_reports') && canByFeature('reports');
    const canAccessSettings = canByPermission('can_access_settings') && canByFeature('settings');
    const canManageParties = canByPermission('can_manage_parties') && canByFeature('parties');
    const canManagePayments = canByPermission('can_manage_payments') && canByFeature('payments');
    const canManageExpenses = canByPermission('can_manage_expenses') && canByFeature('expenses');
    const canManageTemplates = canByPermission('can_manage_templates') && canByFeature('templates');
    const canManageStaff = canByPermission('can_manage_staff') && canByFeature('staff');
    const canManageSubscription = canByPermission('can_manage_subscription') && canByFeature('subscription');
    const canSendMessages = canByPermission('can_send_messages') && canByFeature('messages');
    const canManageBusinessCards = canManageTemplates && canByFeature('businessCards');

    const refreshOrganizationContext = useCallback(async (forcedOrganizationId?: string) => {
        if (!user) {
            clearOrganizationContext();
            return null;
        }

        setRefreshingContext(true);
        try {
            const payload = await businessSuiteService.getCurrentOrganization(
                forcedOrganizationId ?? selectedOrganizationId ?? undefined
            );
            if (payload.organization.id !== selectedOrganizationId) {
                setSelectedOrganizationId(payload.organization.id);
            }
            setOrganizationContext({
                role: payload.context.role,
                ownerUserId: payload.context.ownerUserId,
                permissions: payload.context.permissions as Record<string, boolean>,
                settings: payload.context.settings,
            });
            return payload;
        } finally {
            setRefreshingContext(false);
        }
    }, [
        clearOrganizationContext,
        selectedOrganizationId,
        setOrganizationContext,
        setSelectedOrganizationId,
        user,
    ]);

    return {
        selectedOrganizationId,
        organizationRole: context.role,
        organizationPermissions,
        organizationSettings,
        staffFeatureAccess,
        refreshingContext,
        isOwnerOrAdmin,
        canViewDashboard,
        canManageInventory,
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canViewReports,
        canAccessSettings,
        canManageParties,
        canManagePayments,
        canManageExpenses,
        canManageTemplates,
        canManageStaff,
        canManageSubscription,
        canSendMessages,
        canManageBusinessCards,
        setOrganizationSettings,
        refreshOrganizationContext,
    };
};
