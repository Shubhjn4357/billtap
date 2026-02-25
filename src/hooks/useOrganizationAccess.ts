import { useCallback, useMemo, useState } from 'react';
import { businessSuiteService } from '../api/businessSuiteService';
import { ApiError } from '../api/httpClient';
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

export type AppModuleKey =
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
    | 'businessCards'
    | 'accounting'
    | 'operations'
    | 'businessSuite';

export type AppModuleAccessMap = Record<AppModuleKey, boolean>;

export const DEFAULT_APP_MODULE_ACCESS: AppModuleAccessMap = {
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
    accounting: true,
    operations: true,
    businessSuite: true,
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

export const normalizeAppModuleAccess = (settings: Record<string, unknown>): AppModuleAccessMap => {
    const raw = asRecord(settings.appModuleAccess);
    const fallback = asRecord(settings.moduleVisibility);
    const output = { ...DEFAULT_APP_MODULE_ACCESS };
    for (const key of Object.keys(output) as AppModuleKey[]) {
        if (typeof raw[key] === 'boolean') {
            output[key] = raw[key] as boolean;
        } else if (typeof fallback[key] === 'boolean') {
            output[key] = fallback[key] as boolean;
        }
    }
    return output;
};

export const useOrganizationAccess = () => {
    const { user } = useAuth();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const context = useOrganizationStore((state) => state.context);
    const setSelectedOrganizationId = useOrganizationStore((state) => state.setSelectedOrganizationId);
    const setOrganizationContext = useOrganizationStore((state) => state.setOrganizationContext);
    const setOrganizationSettings = useOrganizationStore((state) => state.setOrganizationSettings);
    const clearOrganizationContext = useOrganizationStore((state) => state.clearOrganizationContext);
    const [refreshingContext, setRefreshingContext] = useState(false);

    const isOwner = context.role === 'owner' || user?.role === 'owner';
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
    const appModuleAccess = useMemo(
        () => normalizeAppModuleAccess(organizationSettings),
        [organizationSettings]
    );
    const hasExplicitModuleSettings = useMemo(() => {
        const direct = asRecord(organizationSettings.appModuleAccess);
        const legacy = asRecord(organizationSettings.moduleVisibility);
        return Object.keys(direct).length > 0 || Object.keys(legacy).length > 0;
    }, [organizationSettings]);

    const hasExplicitPermissions = useMemo(
        () => Object.keys(organizationPermissions).length > 0,
        [organizationPermissions]
    );

    const canByPermission = useCallback((permissionKey: string): boolean => {
        if (isOwner) return true;
        // If no explicit permissions have been configured, allow access by default
        // (solo user / fresh setup scenario)
        if (!hasExplicitPermissions) return true;
        return Boolean(organizationPermissions[permissionKey]);
    }, [hasExplicitPermissions, isOwner, organizationPermissions]);

    const canByFeature = useCallback((featureKey: StaffFeatureKey): boolean => {
        if (isOwner) return true;
        return staffFeatureAccess[featureKey] !== false;
    }, [isOwner, staffFeatureAccess]);

    const canByModule = useCallback((moduleKey: AppModuleKey): boolean => {
        if (isOwner && !hasExplicitModuleSettings) {
            return true;
        }
        if (
            isOwner
            && (moduleKey === 'settings' || moduleKey === 'businessSuite')
        ) {
            return true;
        }
        return appModuleAccess[moduleKey] !== false;
    }, [appModuleAccess, hasExplicitModuleSettings, isOwner]);

    const canViewDashboard = canByModule('dashboard') && canByPermission('can_view_dashboard') && canByFeature('dashboard');
    const canManageInventory = canByModule('stock') && canByPermission('can_manage_inventory') && canByFeature('stock');
    const canOpenBilling = canByModule('billing') && canByPermission('can_create_bill') && canByFeature('billing');
    const canCreateSale = canByModule('billingSale') && canByPermission('can_create_sale') && canByFeature('billingSale') && canOpenBilling;
    const canCreatePurchase = canByModule('billingPurchase') && canByPermission('can_create_purchase') && canByFeature('billingPurchase') && canOpenBilling;
    const canViewReports = canByModule('reports') && canByPermission('can_view_reports') && canByFeature('reports');
    const canAccessSettings = canByModule('settings') && canByPermission('can_access_settings') && canByFeature('settings');
    const canManageParties = canByModule('parties') && canByPermission('can_manage_parties') && canByFeature('parties');
    const canManagePayments = canByModule('payments') && canByPermission('can_manage_payments') && canByFeature('payments');
    const canManageExpenses = canByModule('expenses') && canByPermission('can_manage_expenses') && canByFeature('expenses');
    const canManageTemplates = canByModule('templates') && canByPermission('can_manage_templates') && canByFeature('templates');
    const canManageStaff = canByModule('staff') && canByPermission('can_manage_staff') && canByFeature('staff');
    const canManageSubscription = canByModule('subscription') && canByPermission('can_manage_subscription') && canByFeature('subscription');
    const canSendMessages = canByModule('messages') && canByPermission('can_send_messages') && canByFeature('messages');
    const canManageBusinessCards = canByModule('businessCards') && canManageTemplates && canByFeature('businessCards');
    const canAccessAccounting = canByModule('accounting') && canManagePayments;
    const canAccessOperations = canByModule('operations') && canManageStaff;
    const canAccessBusinessSuite = canByModule('businessSuite')
        && (isOwner || canManageTemplates || canManagePayments || canManageStaff || canManageSubscription);

    const refreshOrganizationContext = useCallback(async (forcedOrganizationId?: string) => {
        if (!user) {
            clearOrganizationContext();
            return null;
        }

        setRefreshingContext(true);
        try {
            const requestedOrganizationId = forcedOrganizationId ?? selectedOrganizationId ?? undefined;
            try {
                const payload = await businessSuiteService.getCurrentOrganization(requestedOrganizationId);
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
            } catch (error: unknown) {
                const status = error instanceof ApiError ? error.status : null;
                const shouldRetryWithoutSelection = Boolean(requestedOrganizationId) && (status === 403 || status === 404);
                if (!shouldRetryWithoutSelection) {
                    throw error;
                }

                const fallbackPayload = await businessSuiteService.getCurrentOrganization(undefined);
                setSelectedOrganizationId(fallbackPayload.organization.id);
                setOrganizationContext({
                    role: fallbackPayload.context.role,
                    ownerUserId: fallbackPayload.context.ownerUserId,
                    permissions: fallbackPayload.context.permissions as Record<string, boolean>,
                    settings: fallbackPayload.context.settings,
                });
                return fallbackPayload;
            }
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
        appModuleAccess,
        refreshingContext,
        isOwner,
        canByModule,
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
        canAccessAccounting,
        canAccessOperations,
        canAccessBusinessSuite,
        setOrganizationSettings,
        refreshOrganizationContext,
    };
};
