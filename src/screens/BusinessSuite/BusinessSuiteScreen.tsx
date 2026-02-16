import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Chip, Divider, SegmentedButtons, Switch, Text, useTheme } from 'react-native-paper';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SignatureCaptureModal } from '../../components/signature/SignatureCaptureModal';
import { useAppDialog } from '../../components/providers/DialogProvider';
import {
    businessSuiteService,
    type BillTemplateEntry,
    type EnterpriseSnapshot,
    type FeeReminderInvoice,
    type GstComplianceSnapshot,
    type InstitutionStudent,
    type OrganizationMembership,
    type OrganizationSummary,
    type OrganizationMember,
    type PayrollSnapshot,
    type SignatureEntry,
    type StaffPermissionKey,
    type StaffPermissions,
    type StaffRole,
    type TreasurySnapshot,
} from '../../api/businessSuiteService';
import { mediaService } from '../../api/mediaService';
import { offlineSyncService } from '../../api/offlineSyncService';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationStore, useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import { openWhatsApp } from '../../utils/linking';
import { isOnline } from '../../utils/network';
import { BUSINESS_CARD_TEMPLATES, shareBusinessCardPdf } from '../../utils/businessCard';
import {
    DEFAULT_STAFF_FEATURE_ACCESS,
    normalizeStaffFeatureAccess,
    type StaffFeatureAccessMap,
    type StaffFeatureKey,
} from '../../hooks/useOrganizationAccess';

const EmptyPayroll: PayrollSnapshot = {
    attendanceCount: 0,
    salaryRuns: { total: 0, draft: 0, finalized: 0 },
};

const EmptyGst: GstComplianceSnapshot = {
    salesTaxableValue: 0,
    outputTax: 0,
    inputTax: 0,
    netGstPayable: 0,
    eligibleItc: 0,
    ineligibleItc: 0,
};

const EmptyTreasury: TreasurySnapshot = {
    bankAccountCount: 0,
    receivables: 0,
    payables: 0,
    netCashFlow: 0,
};

const EmptyEnterprise: EnterpriseSnapshot = {
    branchCount: 0,
    consolidatedSales: 0,
    consolidatedPurchases: 0,
    consolidatedStockValue: 0,
};

type NewStaffRole = 'manager' | 'salesman';
type PrinterType = 'STANDARD' | 'THERMAL';
type PaperSize = 'A4' | 'A5' | '2INCH' | '3INCH';
type ReminderDeliveryMode = 'DEVICE' | 'CLOUD';

const TEMPLATE_LIBRARY: { key: string; name: string; premium: boolean }[] = [
    { key: 'modern_minimal', name: 'Modern Minimal', premium: false },
    { key: 'traditional_red', name: 'Traditional Red', premium: false },
    { key: 'gst_official', name: 'GST Official', premium: false },
    { key: 'thermal_receipt', name: 'Thermal Receipt', premium: false },
    { key: 'royal_blue', name: 'Royal Blue', premium: true },
    { key: 'elegant_gold', name: 'Elegant Gold', premium: true },
    { key: 'mono_compact', name: 'Mono Compact', premium: true },
    { key: 'clean_a4_grid', name: 'Clean A4 Grid', premium: true },
    { key: 'retail_fast_print', name: 'Retail Fast Print', premium: false },
    { key: 'pro_table_plus', name: 'Pro Table Plus', premium: true },
    { key: 'signature_focus', name: 'Signature Focus', premium: true },
    { key: 'classic_statement', name: 'Classic Statement', premium: false },
];

const PERMISSION_FIELDS: {
    key: StaffPermissionKey;
    label: string;
    description: string;
}[] = [
    { key: 'can_create_bill', label: 'Create Bill', description: 'Can open bill terminal.' },
    { key: 'can_create_sale', label: 'Create Sale', description: 'Can create sales invoices.' },
    { key: 'can_create_purchase', label: 'Create Purchase', description: 'Can create purchase entries.' },
    { key: 'can_back_date', label: 'Back-Date Entry', description: 'Can create bills for past dates.' },
    { key: 'can_delete_bill', label: 'Delete Bill', description: 'Can delete bill records.' },
    { key: 'can_view_cost_price', label: 'View Cost Price', description: 'Can see item purchase prices.' },
    { key: 'can_view_dashboard', label: 'View Dashboard', description: 'Can view home dashboard tab.' },
    { key: 'can_view_reports', label: 'View Reports', description: 'Can view reports and exports.' },
    { key: 'can_manage_parties', label: 'Manage Parties', description: 'Can create/edit customers and suppliers.' },
    { key: 'can_manage_inventory', label: 'Manage Inventory', description: 'Can update stock and items.' },
    { key: 'can_manage_payments', label: 'Manage Payments', description: 'Can record payment in/out and reminders.' },
    { key: 'can_manage_expenses', label: 'Manage Expenses', description: 'Can create and edit expenses.' },
    { key: 'can_manage_templates', label: 'Manage Templates', description: 'Can change template and print settings.' },
    { key: 'can_send_messages', label: 'Send Messages', description: 'Can send WhatsApp/SMS reminders.' },
    { key: 'can_access_settings', label: 'Access Settings', description: 'Can open business settings.' },
    { key: 'can_manage_staff', label: 'Manage Staff', description: 'Can add/remove staff and roles.' },
    { key: 'can_manage_subscription', label: 'Manage Subscription', description: 'Can buy/renew plans.' },
];

const STAFF_FEATURE_FIELDS: {
    key: StaffFeatureKey;
    label: string;
    description: string;
}[] = [
    { key: 'dashboard', label: 'Dashboard Tab', description: 'Show home dashboard for staff.' },
    { key: 'billing', label: 'Billing Module', description: 'Show billing tab and bill terminal.' },
    { key: 'billingSale', label: 'Sale Bills', description: 'Allow sale invoice mode.' },
    { key: 'billingPurchase', label: 'Purchase Entry', description: 'Allow purchase entry mode.' },
    { key: 'stock', label: 'Inventory', description: 'Show stock tab and item management.' },
    { key: 'reports', label: 'Reports', description: 'Show reports tab and exports.' },
    { key: 'parties', label: 'Parties/Ledger', description: 'Allow customer/supplier management.' },
    { key: 'payments', label: 'Payments', description: 'Allow reminders and payment workflows.' },
    { key: 'expenses', label: 'Expenses', description: 'Allow expense management flows.' },
    { key: 'templates', label: 'Templates', description: 'Allow templates, print and signature.' },
    { key: 'businessCards', label: 'Business Cards', description: 'Allow visiting card suite access.' },
    { key: 'staff', label: 'Staff Controls', description: 'Allow manage staff screens.' },
    { key: 'subscription', label: 'Subscription', description: 'Allow subscription actions.' },
    { key: 'settings', label: 'Settings Tab', description: 'Show settings tab for staff.' },
    { key: 'messages', label: 'Messages', description: 'Allow WhatsApp and message actions.' },
];

const formatDate = (value?: string | null): string => {
    if (!value) return '-';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleDateString();
};

const normalizePhone = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (!digits) return '';
    return `+${digits}`;
};

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
};

const asPermissions = (value: unknown): StaffPermissions => {
    const output: StaffPermissions = {};
    const record = asRecord(value);
    for (const field of PERMISSION_FIELDS) {
        output[field.key] = Boolean(record[field.key]);
    }
    return output;
};

const getDefaultPermissions = (role: NewStaffRole): StaffPermissions => {
    if (role === 'manager') {
        return {
            can_create_bill: true,
            can_create_sale: true,
            can_create_purchase: true,
            can_back_date: true,
            can_delete_bill: false,
            can_view_cost_price: true,
            can_view_dashboard: true,
            can_view_reports: true,
            can_manage_parties: true,
            can_access_settings: false,
            can_manage_staff: false,
            can_manage_subscription: false,
            can_manage_templates: true,
            can_manage_inventory: true,
            can_manage_expenses: true,
            can_manage_payments: true,
            can_send_messages: true,
        };
    }

    return {
        can_create_bill: true,
        can_create_sale: true,
        can_create_purchase: false,
        can_back_date: false,
        can_delete_bill: false,
        can_view_cost_price: false,
        can_view_dashboard: true,
        can_view_reports: false,
        can_manage_parties: false,
        can_access_settings: false,
        can_manage_staff: false,
        can_manage_subscription: false,
        can_manage_templates: false,
        can_manage_inventory: true,
        can_manage_expenses: false,
        can_manage_payments: true,
        can_send_messages: true,
    };
};

const isPremiumTemplate = (templateKey: string): boolean => {
    return TEMPLATE_LIBRARY.find((entry) => entry.key === templateKey)?.premium ?? false;
};

const getDefaultReminderMode = (): ReminderDeliveryMode => {
    const configured = String(process.env.EXPO_PUBLIC_WHATSAPP_DELIVERY_MODE ?? '').trim().toLowerCase();
    return configured === 'cloud' ? 'CLOUD' : 'DEVICE';
};

export const BusinessSuiteScreen = () => {
    const theme = useTheme();
    const dialog = useAppDialog();
    const { user } = useAuth();
    const {
        selectedOrganizationId,
        setSelectedOrganizationId,
        setOrganizationContext,
        setOrganizationSettings,
    } = useOrganizationStore();
    const { currencySymbol } = useSettingsStore();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? Config.defaultCurrency);
    const isPro = user?.subscriptionStatus === 'active';

    const [loading, setLoading] = useState(false);
    const [savingTemplateSettings, setSavingTemplateSettings] = useState(false);
    const [staffActionLoading, setStaffActionLoading] = useState(false);
    const [sendingReminderForInvoiceId, setSendingReminderForInvoiceId] = useState<string | null>(null);

    const [organizationName, setOrganizationName] = useState('Current Store');
    const [organizationCode, setOrganizationCode] = useState('');
    const [organizationRole, setOrganizationRole] = useState<StaffRole>('owner');
    const [organizationPermissions, setOrganizationPermissions] = useState<StaffPermissions>({});
    const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);

    const [payroll, setPayroll] = useState<PayrollSnapshot>(EmptyPayroll);
    const [gst, setGst] = useState<GstComplianceSnapshot>(EmptyGst);
    const [treasury, setTreasury] = useState<TreasurySnapshot>(EmptyTreasury);
    const [enterprise, setEnterprise] = useState<EnterpriseSnapshot>(EmptyEnterprise);

    const [members, setMembers] = useState<OrganizationMember[]>([]);
    const [templates, setTemplates] = useState<BillTemplateEntry[]>([]);
    const [signatures, setSignatures] = useState<SignatureEntry[]>([]);
    const [students, setStudents] = useState<InstitutionStudent[]>([]);
    const [dueReminders, setDueReminders] = useState<FeeReminderInvoice[]>([]);

    const [newStaffName, setNewStaffName] = useState('');
    const [newStaffPhone, setNewStaffPhone] = useState('');
    const [newStaffRole, setNewStaffRole] = useState<NewStaffRole>('salesman');
    const [newStaffPermissions, setNewStaffPermissions] = useState<StaffPermissions>(getDefaultPermissions('salesman'));

    const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
    const [editingRole, setEditingRole] = useState<NewStaffRole>('salesman');
    const [editingPermissions, setEditingPermissions] = useState<StaffPermissions>(getDefaultPermissions('salesman'));

    const [selectedTemplateKey, setSelectedTemplateKey] = useState('modern_minimal');
    const [godHeaderText, setGodHeaderText] = useState('');
    const [footerText, setFooterText] = useState('');
    const [ackText, setAckText] = useState('');
    const [printerType, setPrinterType] = useState<PrinterType>('STANDARD');
    const [paperSize, setPaperSize] = useState<PaperSize>('A4');
    const [selectedSignatureId, setSelectedSignatureId] = useState<string | null>(null);
    const [signatureName, setSignatureName] = useState('');
    const [signaturePayload, setSignaturePayload] = useState('');
    const [savingSignature, setSavingSignature] = useState(false);
    const [signatureCaptureVisible, setSignatureCaptureVisible] = useState(false);
    const [uploadingSignatureMedia, setUploadingSignatureMedia] = useState(false);

    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreCode, setNewStoreCode] = useState('');
    const [creatingStore, setCreatingStore] = useState(false);

    const [customReminderMessage, setCustomReminderMessage] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');
    const [uploadingReminderMedia, setUploadingReminderMedia] = useState(false);
    const [reminderMode, setReminderMode] = useState<ReminderDeliveryMode>(getDefaultReminderMode());
    const [staffFeatureAccess, setStaffFeatureAccess] = useState<StaffFeatureAccessMap>(DEFAULT_STAFF_FEATURE_ACCESS);
    const [savingStaffFeatures, setSavingStaffFeatures] = useState(false);
    const [businessCardTemplateKey, setBusinessCardTemplateKey] = useState(BUSINESS_CARD_TEMPLATES[0]?.key ?? 'sunrise_orange');
    const [businessCardOwnerName, setBusinessCardOwnerName] = useState('');
    const [businessCardPhone, setBusinessCardPhone] = useState('');
    const [businessCardEmail, setBusinessCardEmail] = useState('');
    const [businessCardWebsite, setBusinessCardWebsite] = useState('');
    const [businessCardTagline, setBusinessCardTagline] = useState('');
    const [businessCardAddress, setBusinessCardAddress] = useState('');
    const [businessCardGst, setBusinessCardGst] = useState('');
    const [businessCardCustomImageUrl, setBusinessCardCustomImageUrl] = useState('');
    const [savingBusinessCardSettings, setSavingBusinessCardSettings] = useState(false);
    const [uploadingBusinessCardImage, setUploadingBusinessCardImage] = useState(false);

    const netBusinessContribution = useMemo(() => {
        return enterprise.consolidatedSales - enterprise.consolidatedPurchases;
    }, [enterprise.consolidatedPurchases, enterprise.consolidatedSales]);

    const isOwnerOrAdmin = organizationRole === 'owner' || user?.role === 'admin';
    const canManageStaff = isOwnerOrAdmin || Boolean(organizationPermissions.can_manage_staff);
    const canManageTemplates = isOwnerOrAdmin || Boolean(organizationPermissions.can_manage_templates);
    const canManagePayments = isOwnerOrAdmin || Boolean(organizationPermissions.can_manage_payments);
    const canSendMessages = isOwnerOrAdmin || Boolean(organizationPermissions.can_send_messages);
    const canManageBusinessCards = canManageTemplates;
    const currentOrganizationId = selectedOrganizationId ?? undefined;

    const studentById = useMemo(() => {
        return new Map(students.map((student) => [student.id, student]));
    }, [students]);

    const mergedTemplateLibrary = useMemo(() => {
        const output = [...TEMPLATE_LIBRARY];
        for (const template of templates) {
            if (output.some((entry) => entry.key === template.templateKey)) continue;
            output.push({
                key: template.templateKey,
                name: template.name,
                premium: template.isPremium,
            });
        }
        return output;
    }, [templates]);
    const applySettingsToUi = useCallback((
        settings: Record<string, unknown>,
        organization?: OrganizationSummary | null
    ) => {
        const customization = asRecord(settings.customization);
        const print = asRecord(settings.print);
        const nextStaffFeatureAccess = normalizeStaffFeatureAccess(settings);
        const businessCard = asRecord(settings.businessCard);

        const nextTemplate = typeof customization.templateKey === 'string'
            ? customization.templateKey
            : 'modern_minimal';
        const nextGodHeader = typeof customization.godHeaderText === 'string' ? customization.godHeaderText : '';
        const nextFooter = typeof customization.footerText === 'string' ? customization.footerText : '';
        const nextAck = typeof customization.acknowledgmentText === 'string'
            ? customization.acknowledgmentText
            : '';
        const nextSignatureId = typeof customization.signatureId === 'string'
            ? customization.signatureId
            : null;

        const nextPrinterType: PrinterType = print.printerType === 'THERMAL' ? 'THERMAL' : 'STANDARD';
        const nextPaperSizeRaw = typeof print.paperSize === 'string' ? print.paperSize : 'A4';
        const nextPaperSize: PaperSize = (['A4', 'A5', '2INCH', '3INCH'] as const).includes(nextPaperSizeRaw as PaperSize)
            ? (nextPaperSizeRaw as PaperSize)
            : 'A4';

        setSelectedTemplateKey(nextTemplate);
        setGodHeaderText(nextGodHeader);
        setFooterText(nextFooter);
        setAckText(nextAck);
        setPrinterType(nextPrinterType);
        setPaperSize(nextPaperSize);
        setSelectedSignatureId(nextSignatureId);
        setStaffFeatureAccess(nextStaffFeatureAccess);
        setBusinessCardTemplateKey(
            typeof businessCard.templateKey === 'string'
                ? businessCard.templateKey
                : (BUSINESS_CARD_TEMPLATES[0]?.key || 'sunrise_orange')
        );
        setBusinessCardOwnerName(
            typeof businessCard.ownerName === 'string'
                ? businessCard.ownerName
                : (user?.displayName || user?.phoneNumber || 'Owner')
        );
        setBusinessCardPhone(
            typeof businessCard.phoneNumber === 'string'
                ? businessCard.phoneNumber
                : (
                    String(organization?.phoneNumber ?? '')
                    || user?.phoneNumber
                    || ''
                )
        );
        setBusinessCardEmail(
            typeof businessCard.email === 'string'
                ? businessCard.email
                : (
                    String(organization?.email ?? '')
                    || user?.email
                    || ''
                )
        );
        setBusinessCardWebsite(
            typeof businessCard.website === 'string'
                ? businessCard.website
                : ''
        );
        setBusinessCardTagline(
            typeof businessCard.tagline === 'string'
                ? businessCard.tagline
                : ''
        );
        setBusinessCardAddress(
            typeof businessCard.address === 'string'
                ? businessCard.address
                : (
                    String(organization?.address ?? '')
                    || ''
                )
        );
        setBusinessCardGst(
            typeof businessCard.gstNumber === 'string'
                ? businessCard.gstNumber
                : (
                    String(organization?.gstNumber ?? '')
                    || user?.gstNumber
                    || ''
                )
        );
        setBusinessCardCustomImageUrl(
            typeof businessCard.customImageUrl === 'string'
                ? businessCard.customImageUrl
                : ''
        );
    }, [user?.displayName, user?.email, user?.gstNumber, user?.phoneNumber]);

    const loadData = useCallback(async (forcedOrganizationId?: string) => {
        setLoading(true);
        try {
            const myOrganizations = await businessSuiteService.getMyOrganizations();
            setOrganizations(myOrganizations);
            const requestedOrganizationId = forcedOrganizationId && myOrganizations.some((entry) => entry.id === forcedOrganizationId)
                ? forcedOrganizationId
                : myOrganizations.some((entry) => entry.id === selectedOrganizationId)
                    ? selectedOrganizationId
                : (myOrganizations[0]?.id ?? null);

            if (!requestedOrganizationId) {
                setOrganizationName('Current Store');
                setOrganizationCode('');
                setOrganizationRole('owner');
                setOrganizationPermissions({});
                setOrganizationContext(null);
                setMembers([]);
                setTemplates([]);
                setSignatures([]);
                setStudents([]);
                setDueReminders([]);
                return;
            }

            if (requestedOrganizationId !== selectedOrganizationId) {
                setSelectedOrganizationId(requestedOrganizationId);
            }

            const [payrollSnapshot, gstSnapshot, treasurySnapshot, enterpriseSnapshot, orgPayload] = await Promise.all([
                businessSuiteService.getPayrollSnapshot(),
                businessSuiteService.getGstComplianceSnapshot(),
                businessSuiteService.getTreasurySnapshot(),
                businessSuiteService.getEnterpriseSnapshot(),
                businessSuiteService.getCurrentOrganization(requestedOrganizationId),
            ]);

            setPayroll(payrollSnapshot);
            setGst(gstSnapshot);
            setTreasury(treasurySnapshot);
            setEnterprise(enterpriseSnapshot);

            setOrganizationName(orgPayload.organization.name);
            setOrganizationCode(orgPayload.organization.code);
            setOrganizationRole(orgPayload.context.role);
            setOrganizationPermissions(asPermissions(orgPayload.context.permissions));
            setOrganizationContext({
                role: orgPayload.context.role,
                ownerUserId: orgPayload.context.ownerUserId,
                permissions: orgPayload.context.permissions as Record<string, boolean>,
                settings: orgPayload.context.settings,
            });
            applySettingsToUi(asRecord(orgPayload.context.settings), orgPayload.organization);

            const ownerView = orgPayload.context.role === 'owner' || user?.role === 'admin';
            const permissionMap = asPermissions(orgPayload.context.permissions);

            const nextCanManageStaff = ownerView || Boolean(permissionMap.can_manage_staff);
            const nextCanManageTemplates = ownerView || Boolean(permissionMap.can_manage_templates);
            const nextCanManagePayments = ownerView || Boolean(permissionMap.can_manage_payments);

            const tasks: Promise<void>[] = [];

            if (nextCanManageStaff) {
                tasks.push(
                    businessSuiteService.getOrganizationMembers(requestedOrganizationId).then(setMembers).catch(() => setMembers([]))
                );
            } else {
                setMembers([]);
            }

            if (nextCanManageTemplates) {
                tasks.push(
                    Promise.all([
                        businessSuiteService.getTemplates(requestedOrganizationId),
                        businessSuiteService.getSignatures(requestedOrganizationId),
                    ])
                        .then(([templateRows, signatureRows]) => {
                            setTemplates(templateRows);
                            setSignatures(signatureRows);
                        })
                        .catch(() => {
                            setTemplates([]);
                            setSignatures([]);
                        })
                );
            } else {
                setTemplates([]);
                setSignatures([]);
            }

            if (nextCanManagePayments) {
                tasks.push(
                    Promise.all([
                        businessSuiteService.getInstitutionStudents(requestedOrganizationId),
                        businessSuiteService.getDueFeeReminders(new Date().toISOString(), requestedOrganizationId),
                    ])
                        .then(([studentRows, reminderRows]) => {
                            setStudents(studentRows);
                            setDueReminders(reminderRows);
                        })
                        .catch(() => {
                            setStudents([]);
                            setDueReminders([]);
                        })
                );
            } else {
                setStudents([]);
                setDueReminders([]);
            }

            await Promise.all(tasks);
        } catch (error: unknown) {
            dialog.alert('Business Suite', error instanceof Error ? error.message : 'Failed to load business suite data.');
        } finally {
            setLoading(false);
        }
    }, [applySettingsToUi, dialog, selectedOrganizationId, setOrganizationContext, setSelectedOrganizationId, user?.role]);

    useFocusEffect(
        useCallback(() => {
            void loadData();
        }, [loadData])
    );

    const resetNewStaffForm = () => {
        setNewStaffName('');
        setNewStaffPhone('');
        setNewStaffRole('salesman');
        setNewStaffPermissions(getDefaultPermissions('salesman'));
    };

    const onChangeNewStaffRole = (value: string) => {
        const role: NewStaffRole = value === 'manager' ? 'manager' : 'salesman';
        setNewStaffRole(role);
        setNewStaffPermissions(getDefaultPermissions(role));
    };

    const onToggleNewPermission = (key: StaffPermissionKey, value: boolean) => {
        setNewStaffPermissions((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const handleAddStaff = async () => {
        if (!canManageStaff) {
            dialog.alert('Access Denied', 'You do not have permission to manage staff.');
            return;
        }

        const displayName = newStaffName.trim();
        const phone = normalizePhone(newStaffPhone);
        if (!displayName) {
            dialog.alert('Validation', 'Enter staff name.');
            return;
        }
        if (!phone || phone.length < 8) {
            dialog.alert('Validation', 'Enter a valid phone number with country code.');
            return;
        }

        setStaffActionLoading(true);
        try {
            await businessSuiteService.addOrganizationMember({
                displayName,
                phoneNumber: phone,
                role: newStaffRole,
                permissions: newStaffPermissions,
            }, currentOrganizationId);
            resetNewStaffForm();
            const rows = await businessSuiteService.getOrganizationMembers(currentOrganizationId);
            setMembers(rows);
            dialog.alert('Staff', 'Staff member added successfully.');
        } catch (error: unknown) {
            dialog.alert('Staff', error instanceof Error ? error.message : 'Failed to add staff member.');
        } finally {
            setStaffActionLoading(false);
        }
    };

    const beginEditMember = (member: OrganizationMember) => {
        if (member.role === 'owner') return;
        setEditingMemberId(member.id);
        setEditingRole(member.role === 'manager' ? 'manager' : 'salesman');
        setEditingPermissions({
            ...getDefaultPermissions(member.role === 'manager' ? 'manager' : 'salesman'),
            ...asPermissions(member.permissions),
        });
    };

    const onChangeEditingRole = (value: string) => {
        const role: NewStaffRole = value === 'manager' ? 'manager' : 'salesman';
        setEditingRole(role);
        setEditingPermissions((current) => ({
            ...getDefaultPermissions(role),
            ...current,
        }));
    };

    const onToggleEditingPermission = (key: StaffPermissionKey, value: boolean) => {
        setEditingPermissions((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const onToggleStaffFeature = (key: StaffFeatureKey, value: boolean) => {
        setStaffFeatureAccess((current) => ({
            ...current,
            [key]: value,
        }));
    };

    const handleSaveStaffFeatureAccess = async () => {
        if (!isOwnerOrAdmin) {
            dialog.alert('Access Denied', 'Only owner/admin can update staff feature controls.');
            return;
        }

        setSavingStaffFeatures(true);
        try {
            const settings = await businessSuiteService.updateOrganizationSettings({
                staffFeatureAccess,
            }, currentOrganizationId);
            applySettingsToUi(asRecord(settings));
            setOrganizationSettings(settings);
            dialog.alert('Staff Controls', 'Staff feature controls saved.');
        } catch (error: unknown) {
            dialog.alert('Staff Controls', error instanceof Error ? error.message : 'Failed to save staff controls.');
        } finally {
            setSavingStaffFeatures(false);
        }
    };

    const handleSaveMember = async () => {
        if (!editingMemberId) return;
        setStaffActionLoading(true);
        try {
            await businessSuiteService.updateOrganizationMember(editingMemberId, {
                role: editingRole,
                permissions: editingPermissions,
                isActive: true,
            }, currentOrganizationId);
            setEditingMemberId(null);
            const rows = await businessSuiteService.getOrganizationMembers(currentOrganizationId);
            setMembers(rows);
            dialog.alert('Staff', 'Permissions updated.');
        } catch (error: unknown) {
            dialog.alert('Staff', error instanceof Error ? error.message : 'Failed to update member.');
        } finally {
            setStaffActionLoading(false);
        }
    };

    const handleRemoveMember = (member: OrganizationMember) => {
        dialog.confirm(
            'Remove Staff',
            `Remove ${member.user?.displayName || member.user?.phoneNumber || member.userId} from this store?`,
            async () => {
                setStaffActionLoading(true);
                try {
                    await businessSuiteService.removeOrganizationMember(member.id, currentOrganizationId);
                    const rows = await businessSuiteService.getOrganizationMembers(currentOrganizationId);
                    setMembers(rows);
                } finally {
                    setStaffActionLoading(false);
                }
            }
        );
    };

    const ensureMediaUrlValid = (value: string): boolean => {
        const trimmed = value.trim();
        if (!trimmed) return true;
        try {
            const parsed = new URL(trimmed);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
        } catch {
            return false;
        }
    };

    const pickOptimizedImage = async (): Promise<{ uri: string; fileType: string; fileName: string } | null> => {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
            dialog.alert('Permission Required', 'Media library permission is required to upload images.');
            return null;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            quality: 1,
        });
        if (result.canceled || result.assets.length === 0) {
            return null;
        }

        const source = result.assets[0];
        const optimized = await ImageManipulator.manipulateAsync(
            source.uri,
            [{ resize: { width: 800 } }],
            {
                compress: 0.7,
                format: ImageManipulator.SaveFormat.JPEG,
            }
        );

        return {
            uri: optimized.uri,
            fileType: 'image/jpeg',
            fileName: source.fileName || `media-${Date.now()}.jpg`,
        };
    };

    const handlePickSignatureImage = async () => {
        if (!canManageTemplates) {
            dialog.alert('Access Denied', 'You do not have permission to manage signatures.');
            return;
        }

        try {
            const picked = await pickOptimizedImage();
            if (!picked) return;
            setUploadingSignatureMedia(true);
            const uploaded = await mediaService.uploadFromUri({
                uri: picked.uri,
                fileName: picked.fileName,
                fileType: picked.fileType,
                assetType: 'SIGNATURE',
                entityType: 'signature',
                organizationId: currentOrganizationId,
            });
            setSignaturePayload(uploaded.fileUrl);
            if (!signatureName.trim()) {
                setSignatureName('Authorized Signatory');
            }
        } catch (error: unknown) {
            dialog.alert('Signature', error instanceof Error ? error.message : 'Failed to upload signature image.');
        } finally {
            setUploadingSignatureMedia(false);
        }
    };

    const handleCaptureSignatureSave = async (dataUrl: string) => {
        if (!canManageTemplates) {
            setSignatureCaptureVisible(false);
            return;
        }

        setSignatureCaptureVisible(false);
        try {
            setUploadingSignatureMedia(true);
            const uploaded = await mediaService.uploadFromDataUrl({
                dataUrl,
                fileName: `signature-${Date.now()}.png`,
                fileType: 'image/png',
                assetType: 'SIGNATURE',
                entityType: 'signature',
                organizationId: currentOrganizationId,
            });
            setSignaturePayload(uploaded.fileUrl);
            if (!signatureName.trim()) {
                setSignatureName('Authorized Signatory');
            }
        } catch (error: unknown) {
            dialog.alert('Signature', error instanceof Error ? error.message : 'Failed to upload drawn signature.');
        } finally {
            setUploadingSignatureMedia(false);
        }
    };

    const handlePickReminderMedia = async () => {
        if (!canManagePayments) {
            dialog.alert('Access Denied', 'You do not have permission to attach reminder media.');
            return;
        }

        try {
            const picked = await pickOptimizedImage();
            if (!picked) return;
            setUploadingReminderMedia(true);
            const uploaded = await mediaService.uploadFromUri({
                uri: picked.uri,
                fileName: picked.fileName,
                fileType: picked.fileType,
                assetType: 'BILL_ATTACHMENT',
                entityType: 'fee_reminder',
                organizationId: currentOrganizationId,
            });
            setMediaUrl(uploaded.fileUrl);
        } catch (error: unknown) {
            dialog.alert('Reminder', error instanceof Error ? error.message : 'Failed to upload reminder media.');
        } finally {
            setUploadingReminderMedia(false);
        }
    };

    const buildReminderMessage = (invoice: FeeReminderInvoice, student?: InstitutionStudent): string => {
        const dueAmount = formatCurrency(invoice.dueAmount, activeCurrency);
        const baseMessage = customReminderMessage.trim();
        if (baseMessage) {
            return baseMessage;
        }

        return [
            `Namaste! Fee reminder for ${student?.name || 'student'}.`,
            `Invoice: ${invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase()}`,
            `Due Amount: ${dueAmount}`,
            `Barcode: ${invoice.barcodeValue || '-'}`,
            'Please clear dues at the earliest. Thank you.',
        ].join('\n');
    };

    const handleSwitchOrganization = async (organizationId: string) => {
        if (!organizationId || organizationId === selectedOrganizationId) return;
        setSelectedOrganizationId(organizationId);
        await loadData(organizationId);
    };

    const handleCreateStore = async () => {
        if (!isOwnerOrAdmin && !organizationPermissions.can_access_settings) {
            dialog.alert('Access Denied', 'You do not have permission to create stores.');
            return;
        }

        const name = newStoreName.trim();
        const code = newStoreCode.trim().toUpperCase();
        if (!name) {
            dialog.alert('Validation', 'Enter store name.');
            return;
        }
        if (!code) {
            dialog.alert('Validation', 'Enter store code.');
            return;
        }

        setCreatingStore(true);
        try {
            const createdId = await businessSuiteService.createOrganization({
                name,
                code,
                currency: activeCurrency,
            });
            setNewStoreName('');
            setNewStoreCode('');
            setSelectedOrganizationId(createdId);
            await loadData(createdId);
            dialog.alert('Store', 'Store created successfully.');
        } catch (error: unknown) {
            dialog.alert('Store', error instanceof Error ? error.message : 'Failed to create store.');
        } finally {
            setCreatingStore(false);
        }
    };

    const handleSaveSignature = async () => {
        if (!canManageTemplates) {
            dialog.alert('Access Denied', 'You do not have permission to manage signatures.');
            return;
        }

        const payload = signaturePayload.trim();
        if (!payload) {
            dialog.alert('Signature', 'Draw/upload a signature or paste signature URL/base64 data.');
            return;
        }

        const looksLikeUrl = /^https?:\/\//i.test(payload);
        setSavingSignature(true);
        try {
            const id = await businessSuiteService.createSignature({
                name: signatureName.trim() || undefined,
                signatureUrl: looksLikeUrl ? payload : undefined,
                signatureData: looksLikeUrl ? undefined : payload,
                isDefault: signatures.length === 0,
            }, currentOrganizationId);
            const rows = await businessSuiteService.getSignatures(currentOrganizationId);
            setSignatures(rows);
            setSelectedSignatureId(id);
            setSignatureName('');
            setSignaturePayload('');
            dialog.alert('Signature', 'Signature saved.');
        } catch (error: unknown) {
            dialog.alert('Signature', error instanceof Error ? error.message : 'Failed to save signature.');
        } finally {
            setSavingSignature(false);
        }
    };

    const handleSetDefaultSignature = async (signatureId: string) => {
        setSavingSignature(true);
        try {
            await businessSuiteService.setDefaultSignature(signatureId, currentOrganizationId);
            setSelectedSignatureId(signatureId);
            const rows = await businessSuiteService.getSignatures(currentOrganizationId);
            setSignatures(rows);
        } catch (error: unknown) {
            dialog.alert('Signature', error instanceof Error ? error.message : 'Failed to set default signature.');
        } finally {
            setSavingSignature(false);
        }
    };
    const handleSaveTemplateSettings = async () => {
        if (!canManageTemplates) {
            dialog.alert('Access Denied', 'You do not have permission to manage templates.');
            return;
        }

        if (isPremiumTemplate(selectedTemplateKey) && !isPro) {
            dialog.alert(
                'Upgrade to Pro',
                'Premium templates are locked. Upgrade to BillTap Pro to use this design.'
            );
            return;
        }

        const normalizedPaperSize: PaperSize = printerType === 'THERMAL'
            ? (paperSize === '2INCH' || paperSize === '3INCH' ? paperSize : '3INCH')
            : (paperSize === 'A4' || paperSize === 'A5' ? paperSize : 'A4');

        setSavingTemplateSettings(true);
        try {
            const settings = await businessSuiteService.updateOrganizationSettings({
                customization: {
                    templateKey: selectedTemplateKey,
                    godHeaderText: godHeaderText.trim(),
                    footerText: footerText.trim(),
                    acknowledgmentText: ackText.trim(),
                    signatureId: selectedSignatureId,
                },
                print: {
                    printerType,
                    paperSize: normalizedPaperSize,
                },
            }, currentOrganizationId);
            applySettingsToUi(asRecord(settings));
            setOrganizationSettings(settings);
            dialog.alert('Template', 'Template and print settings saved.');
        } catch (error: unknown) {
            dialog.alert('Template', error instanceof Error ? error.message : 'Failed to save template settings.');
        } finally {
            setSavingTemplateSettings(false);
        }
    };

    const handlePickBusinessCardImage = async () => {
        if (!canManageBusinessCards) {
            dialog.alert('Access Denied', 'You do not have permission to manage business cards.');
            return;
        }

        try {
            const picked = await pickOptimizedImage();
            if (!picked) return;
            setUploadingBusinessCardImage(true);
            const uploaded = await mediaService.uploadFromUri({
                uri: picked.uri,
                fileName: picked.fileName,
                fileType: picked.fileType,
                assetType: 'OTHER',
                entityType: 'business_card',
                organizationId: currentOrganizationId,
            });
            setBusinessCardCustomImageUrl(uploaded.fileUrl);
        } catch (error: unknown) {
            dialog.alert('Business Card', error instanceof Error ? error.message : 'Failed to upload custom business card.');
        } finally {
            setUploadingBusinessCardImage(false);
        }
    };

    const handleSaveBusinessCardSettings = async () => {
        if (!canManageBusinessCards) {
            dialog.alert('Access Denied', 'You do not have permission to manage business cards.');
            return;
        }

        const businessName = organizationName.trim() || user?.businessName?.trim() || 'Business Name';
        const payload = {
            templateKey: businessCardTemplateKey,
            businessName,
            ownerName: businessCardOwnerName.trim(),
            phoneNumber: businessCardPhone.trim(),
            email: businessCardEmail.trim(),
            website: businessCardWebsite.trim(),
            tagline: businessCardTagline.trim(),
            address: businessCardAddress.trim(),
            gstNumber: businessCardGst.trim(),
            customImageUrl: businessCardCustomImageUrl.trim(),
        };

        setSavingBusinessCardSettings(true);
        try {
            const settings = await businessSuiteService.updateOrganizationSettings({
                businessCard: payload,
            }, currentOrganizationId);
            applySettingsToUi(asRecord(settings));
            setOrganizationSettings(settings);
            dialog.alert('Business Card', 'Business card settings saved.');
        } catch (error: unknown) {
            dialog.alert('Business Card', error instanceof Error ? error.message : 'Failed to save business card settings.');
        } finally {
            setSavingBusinessCardSettings(false);
        }
    };

    const handleShareBusinessCard = async () => {
        if (!canManageBusinessCards) {
            dialog.alert('Access Denied', 'You do not have permission to share business cards.');
            return;
        }

        const businessName = organizationName.trim() || user?.businessName?.trim() || 'Business Name';
        const payload = {
            templateKey: businessCardTemplateKey,
            businessName,
            ownerName: businessCardOwnerName.trim() || user?.displayName?.trim() || 'Owner',
            phoneNumber: businessCardPhone.trim(),
            email: businessCardEmail.trim(),
            website: businessCardWebsite.trim(),
            tagline: businessCardTagline.trim(),
            address: businessCardAddress.trim(),
            gstNumber: businessCardGst.trim(),
        };

        try {
            if (businessCardCustomImageUrl.trim()) {
                await Share.share({
                    title: `${businessName} Business Card`,
                    message: `${businessName}\n${businessCardCustomImageUrl.trim()}`,
                });
                return;
            }
            await shareBusinessCardPdf(payload);
        } catch (error: unknown) {
            dialog.alert('Business Card', error instanceof Error ? error.message : 'Failed to share business card.');
        }
    };

    const handleSendReminder = async (invoice: FeeReminderInvoice) => {
        if (!canSendMessages) {
            dialog.alert('Access Denied', 'You do not have permission to send WhatsApp reminders.');
            return;
        }

        const student = studentById.get(invoice.studentId);
        const recipient = student?.phoneNumber?.trim();
        if (!recipient) {
            dialog.alert('Reminder', 'No phone number is available for this student.');
            return;
        }

        if (!ensureMediaUrlValid(mediaUrl)) {
            dialog.alert('Reminder', 'Media URL must be a valid http/https link.');
            return;
        }

        const message = buildReminderMessage(invoice, student);
        const messageWithMedia = mediaUrl.trim()
            ? `${message}\nMedia: ${mediaUrl.trim()}`
            : message;

        setSendingReminderForInvoiceId(invoice.id);
        try {
            if (reminderMode === 'DEVICE') {
                await openWhatsApp(recipient, messageWithMedia);
                dialog.alert('Reminder', 'WhatsApp opened with pre-filled message. Tap send to deliver.');
            } else {
                const online = await isOnline();
                if (!online) {
                    await offlineSyncService.enqueueMessage({
                        channel: 'WHATSAPP',
                        recipient,
                        message,
                        mediaUrl: mediaUrl.trim() || undefined,
                    });
                    dialog.alert('Reminder', 'You are offline. Reminder has been queued and will sync when online.');
                    return;
                }
                await businessSuiteService.sendFeeReminderWhatsApp({
                    invoiceId: invoice.id,
                    recipient,
                    customMessage: message,
                    mediaUrl: mediaUrl.trim() || undefined,
                }, currentOrganizationId);
                dialog.alert('Reminder', 'WhatsApp reminder sent successfully.');
            }
        } catch (error: unknown) {
            if (reminderMode === 'CLOUD') {
                try {
                    await offlineSyncService.enqueueMessage({
                        channel: 'WHATSAPP',
                        recipient,
                        message,
                        mediaUrl: mediaUrl.trim() || undefined,
                    });
                    dialog.alert('Reminder', 'Failed to send now. Reminder has been queued for offline sync.');
                    return;
                } catch {
                    // Ignore queue fallback errors and show original error below.
                }
            }
            dialog.alert('Reminder', error instanceof Error ? error.message : 'Failed to send reminder.');
        } finally {
            setSendingReminderForInvoiceId(null);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content}>
                <PageHeaderCard
                    title="Business Suite"
                    subtitle={`${organizationName}${organizationCode ? ` (${organizationCode})` : ''}`}
                />

                <View style={styles.refreshRow}>
                    <Chip icon="account-tie" compact>
                        Role: {organizationRole.toUpperCase()}
                    </Chip>
                    <AppButton mode="contained-tonal" compact onPress={() => { void loadData(); }} loading={loading}>
                        Refresh
                    </AppButton>
                </View>

                <AppCard>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Company Switch
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 10 }}>
                        Active organization: {organizationName}
                    </Text>
                    <View style={styles.templateGrid}>
                        {organizations.map((organization) => (
                            <Chip
                                key={organization.id}
                                selected={organization.id === selectedOrganizationId}
                                mode={organization.id === selectedOrganizationId ? 'flat' : 'outlined'}
                                onPress={() => { void handleSwitchOrganization(organization.id); }}
                                style={styles.templateChip}
                            >
                                {organization.name}
                            </Chip>
                        ))}
                    </View>
                    {(isOwnerOrAdmin || Boolean(organizationPermissions.can_access_settings)) && (
                        <>
                            <Divider style={{ marginVertical: 10 }} />
                            <Text variant="labelLarge" style={styles.subHeading}>
                                Add Store
                            </Text>
                            <AppInput
                                label="Store Name"
                                value={newStoreName}
                                onChangeText={setNewStoreName}
                                placeholder="Sandesh Collection"
                            />
                            <AppInput
                                label="Store Code"
                                value={newStoreCode}
                                onChangeText={setNewStoreCode}
                                placeholder="SANDESH-01"
                            />
                            <AppButton
                                mode="contained"
                                onPress={() => { void handleCreateStore(); }}
                                loading={creatingStore}
                            >
                                Create Store
                            </AppButton>
                        </>
                    )}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Snapshot
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Attendance (30d): {payroll.attendanceCount}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Salary Runs: {payroll.salaryRuns.total} | Draft {payroll.salaryRuns.draft} | Finalized {payroll.salaryRuns.finalized}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Output Tax {formatCurrency(gst.outputTax, activeCurrency)} | Input Tax {formatCurrency(gst.inputTax, activeCurrency)}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Net GST Payable: {formatCurrency(gst.netGstPayable, activeCurrency)}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Receivables {formatCurrency(treasury.receivables, activeCurrency)} | Payables {formatCurrency(treasury.payables, activeCurrency)}
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                        Net Contribution: {formatCurrency(netBusinessContribution, activeCurrency)}
                    </Text>
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Staff App Feature Controls
                    </Text>
                    {!isOwnerOrAdmin && (
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Only owner/admin can update global staff feature controls.
                        </Text>
                    )}
                    {isOwnerOrAdmin && (
                        <>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 10 }}>
                                Toggle which modules are visible for all staff users in this store.
                            </Text>
                            <View style={styles.permissionContainer}>
                                {STAFF_FEATURE_FIELDS.map((field) => (
                                    <View key={`feature-${field.key}`} style={styles.permissionRow}>
                                        <View style={styles.permissionText}>
                                            <Text variant="bodyMedium">{field.label}</Text>
                                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                                {field.description}
                                            </Text>
                                        </View>
                                        <Switch
                                            value={Boolean(staffFeatureAccess[field.key])}
                                            onValueChange={(value) => onToggleStaffFeature(field.key, value)}
                                        />
                                    </View>
                                ))}
                            </View>
                            <AppButton
                                mode="contained"
                                onPress={() => { void handleSaveStaffFeatureAccess(); }}
                                loading={savingStaffFeatures}
                            >
                                Save Staff Feature Controls
                            </AppButton>
                        </>
                    )}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Staff Permission Matrix
                    </Text>
                    {!canManageStaff && (
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Access denied. Ask owner/admin to manage staff permissions.
                        </Text>
                    )}
                    {canManageStaff && (
                        <>
                            <Text variant="labelLarge" style={styles.subHeading}>
                                Add Staff
                            </Text>
                            <AppInput
                                label="Staff Name"
                                value={newStaffName}
                                onChangeText={setNewStaffName}
                            />
                            <AppInput
                                label="Phone Number"
                                value={newStaffPhone}
                                onChangeText={setNewStaffPhone}
                                keyboardType="phone-pad"
                                placeholder="+91 9876543210"
                            />
                            <SegmentedButtons
                                value={newStaffRole}
                                onValueChange={onChangeNewStaffRole}
                                buttons={[
                                    { value: 'salesman', label: 'Salesman' },
                                    { value: 'manager', label: 'Manager' },
                                ]}
                                style={{ marginBottom: 12 }}
                            />
                            <View style={styles.permissionContainer}>
                                {PERMISSION_FIELDS.map((field) => (
                                    <View key={`new-${field.key}`} style={styles.permissionRow}>
                                        <View style={styles.permissionText}>
                                            <Text variant="bodyMedium">{field.label}</Text>
                                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                                {field.description}
                                            </Text>
                                        </View>
                                        <Switch
                                            value={Boolean(newStaffPermissions[field.key])}
                                            onValueChange={(value) => onToggleNewPermission(field.key, value)}
                                        />
                                    </View>
                                ))}
                            </View>
                            <AppButton
                                mode="contained"
                                onPress={() => { void handleAddStaff(); }}
                                loading={staffActionLoading}
                            >
                                Add Staff Member
                            </AppButton>
                            <Divider style={{ marginVertical: 14 }} />
                            <Text variant="labelLarge" style={styles.subHeading}>
                                Existing Members
                            </Text>
                            {members.length === 0 && (
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    No members found.
                                </Text>
                            )}
                            {members.map((member) => {
                                const editing = editingMemberId === member.id;
                                const displayName = member.user?.displayName || member.user?.phoneNumber || member.userId;
                                const isOwner = member.role === 'owner';

                                return (
                                    <View key={member.id} style={styles.memberCard}>
                                        <Text variant="titleSmall" style={styles.memberName}>
                                            {displayName}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                            {member.user?.phoneNumber || member.phoneNumberSnapshot || '-'} | {member.role.toUpperCase()}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                                            Joined: {formatDate(member.joinedAt)}
                                        </Text>
                                        {!isOwner && !editing && (
                                            <View style={styles.memberActionRow}>
                                                <AppButton compact mode="contained-tonal" onPress={() => beginEditMember(member)}>
                                                    Edit Permissions
                                                </AppButton>
                                                <AppButton compact mode="outlined" onPress={() => handleRemoveMember(member)}>
                                                    Remove
                                                </AppButton>
                                            </View>
                                        )}
                                        {isOwner && (
                                            <Chip compact icon="shield-crown">
                                                Owner
                                            </Chip>
                                        )}
                                        {editing && (
                                            <View style={{ marginTop: 8 }}>
                                                <SegmentedButtons
                                                    value={editingRole}
                                                    onValueChange={onChangeEditingRole}
                                                    buttons={[
                                                        { value: 'salesman', label: 'Salesman' },
                                                        { value: 'manager', label: 'Manager' },
                                                    ]}
                                                    style={{ marginBottom: 12 }}
                                                />
                                                {PERMISSION_FIELDS.map((field) => (
                                                    <View key={`edit-${member.id}-${field.key}`} style={styles.permissionRow}>
                                                        <View style={styles.permissionText}>
                                                            <Text variant="bodyMedium">{field.label}</Text>
                                                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                                                {field.description}
                                                            </Text>
                                                        </View>
                                                        <Switch
                                                            value={Boolean(editingPermissions[field.key])}
                                                            onValueChange={(value) => onToggleEditingPermission(field.key, value)}
                                                        />
                                                    </View>
                                                ))}
                                                <View style={styles.memberActionRow}>
                                                    <AppButton
                                                        compact
                                                        mode="contained"
                                                        onPress={() => { void handleSaveMember(); }}
                                                        loading={staffActionLoading}
                                                    >
                                                        Save
                                                    </AppButton>
                                                    <AppButton compact mode="text" onPress={() => setEditingMemberId(null)}>
                                                        Cancel
                                                    </AppButton>
                                                </View>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </>
                    )}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Template Picker And Print Setup
                    </Text>
                    {!canManageTemplates && (
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Access denied. Ask owner/admin to manage templates.
                        </Text>
                    )}
                    {canManageTemplates && (
                        <>
                            <View style={styles.templateGrid}>
                                {mergedTemplateLibrary.map((template) => {
                                    const selected = selectedTemplateKey === template.key;
                                    const premiumLocked = template.premium && !isPro;
                                    return (
                                        <Chip
                                            key={template.key}
                                            selected={selected}
                                            onPress={() => setSelectedTemplateKey(template.key)}
                                            disabled={premiumLocked}
                                            mode={selected ? 'flat' : 'outlined'}
                                            style={styles.templateChip}
                                        >
                                            {template.name}{template.premium ? ' (Pro)' : ''}
                                        </Chip>
                                    );
                                })}
                            </View>
                            {!isPro && isPremiumTemplate(selectedTemplateKey) && (
                                <Text variant="bodySmall" style={{ color: theme.colors.error, marginBottom: 8 }}>
                                    Premium template selected. Upgrade to Pro to apply.
                                </Text>
                            )}

                            <AppInput
                                label="God Name Header"
                                value={godHeaderText}
                                onChangeText={setGodHeaderText}
                                placeholder="|| Shree Ganeshay Namah ||"
                            />
                            <AppInput
                                label="Footer Text"
                                value={footerText}
                                onChangeText={setFooterText}
                                placeholder="Thank you. Visit again."
                            />
                            <AppInput
                                label="Acknowledgment / Notes"
                                value={ackText}
                                onChangeText={setAckText}
                                multiline
                                numberOfLines={3}
                                placeholder="Subject to local jurisdiction."
                            />

                            <SegmentedButtons
                                value={printerType}
                                onValueChange={(value) => {
                                    const next = value === 'THERMAL' ? 'THERMAL' : 'STANDARD';
                                    setPrinterType(next);
                                    if (next === 'THERMAL' && (paperSize === 'A4' || paperSize === 'A5')) {
                                        setPaperSize('3INCH');
                                    }
                                    if (next === 'STANDARD' && (paperSize === '2INCH' || paperSize === '3INCH')) {
                                        setPaperSize('A4');
                                    }
                                }}
                                buttons={[
                                    { value: 'STANDARD', label: 'Standard' },
                                    { value: 'THERMAL', label: 'Thermal' },
                                ]}
                                style={{ marginBottom: 12 }}
                            />

                            <SegmentedButtons
                                value={paperSize}
                                onValueChange={(value) => {
                                    const next = value as PaperSize;
                                    setPaperSize(next);
                                }}
                                buttons={
                                    printerType === 'THERMAL'
                                        ? [
                                            { value: '2INCH', label: '2 inch' },
                                            { value: '3INCH', label: '3 inch' },
                                        ]
                                        : [
                                            { value: 'A4', label: 'A4' },
                                            { value: 'A5', label: 'A5' },
                                        ]
                                }
                                style={{ marginBottom: 12 }}
                            />

                            <Divider style={{ marginBottom: 12 }} />
                            <Text variant="labelLarge" style={styles.subHeading}>
                                Bill Signature
                            </Text>
                            <View style={styles.templateGrid}>
                                {signatures.map((signature) => (
                                    <Chip
                                        key={signature.id}
                                        selected={selectedSignatureId === signature.id}
                                        mode={selectedSignatureId === signature.id ? 'flat' : 'outlined'}
                                        onPress={() => setSelectedSignatureId(signature.id)}
                                        onLongPress={() => { void handleSetDefaultSignature(signature.id); }}
                                        style={styles.templateChip}
                                    >
                                        {signature.name || signature.id.slice(0, 8).toUpperCase()}
                                        {signature.isDefault ? ' (Default)' : ''}
                                    </Chip>
                                ))}
                            </View>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 6 }}>
                                Long-press a signature chip to make it default.
                            </Text>
                            <AppInput
                                label="Signature Name"
                                value={signatureName}
                                onChangeText={setSignatureName}
                                placeholder="Authorized Signatory"
                            />
                            <View style={styles.memberActionRow}>
                                <AppButton
                                    mode="contained-tonal"
                                    onPress={() => setSignatureCaptureVisible(true)}
                                >
                                    Draw Signature
                                </AppButton>
                                <AppButton
                                    mode="outlined"
                                    onPress={() => { void handlePickSignatureImage(); }}
                                    loading={uploadingSignatureMedia}
                                >
                                    Upload Image
                                </AppButton>
                            </View>
                            <AppInput
                                label="Signature URL (or base64 fallback)"
                                value={signaturePayload}
                                onChangeText={setSignaturePayload}
                                multiline
                                numberOfLines={3}
                                placeholder="https://... or data:image/png;base64,..."
                            />
                            {uploadingSignatureMedia && (
                                <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                                    Uploading signature media...
                                </Text>
                            )}
                            <AppButton
                                mode="contained-tonal"
                                onPress={() => { void handleSaveSignature(); }}
                                loading={savingSignature}
                                style={{ marginBottom: 10 }}
                            >
                                Save Signature
                            </AppButton>

                            <AppButton
                                mode="contained"
                                onPress={() => { void handleSaveTemplateSettings(); }}
                                loading={savingTemplateSettings}
                            >
                                Save Template Settings
                            </AppButton>
                        </>
                    )}
                </AppCard>

                <AppCard>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Business Card Studio
                    </Text>
                    {!canManageBusinessCards && (
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Access denied. Ask owner/admin to manage business cards.
                        </Text>
                    )}
                    {canManageBusinessCards && (
                        <>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                                Choose a template, auto-fill details, then share. You can also upload your own card image.
                            </Text>
                            <View style={styles.templateGrid}>
                                {BUSINESS_CARD_TEMPLATES.map((template) => (
                                    <Chip
                                        key={template.key}
                                        selected={businessCardTemplateKey === template.key}
                                        onPress={() => setBusinessCardTemplateKey(template.key)}
                                        mode={businessCardTemplateKey === template.key ? 'flat' : 'outlined'}
                                        style={styles.templateChip}
                                    >
                                        {template.name}
                                    </Chip>
                                ))}
                            </View>

                            <View
                                style={{
                                    borderRadius: 12,
                                    borderWidth: 1,
                                    borderColor: 'rgba(148,163,184,0.35)',
                                    padding: 12,
                                    marginBottom: 10,
                                }}
                            >
                                <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                                    {organizationName || user?.businessName || 'Business Name'}
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    {businessCardOwnerName || user?.displayName || 'Owner'}
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    {businessCardPhone || '-'}
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    {businessCardEmail || '-'}
                                </Text>
                                <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                    {businessCardWebsite || '-'}
                                </Text>
                                {!!businessCardTagline && (
                                    <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                        {businessCardTagline}
                                    </Text>
                                )}
                            </View>

                            <AppInput
                                label="Owner Name"
                                value={businessCardOwnerName}
                                onChangeText={setBusinessCardOwnerName}
                                placeholder={user?.displayName || 'Owner Name'}
                            />
                            <AppInput
                                label="Phone Number"
                                value={businessCardPhone}
                                onChangeText={setBusinessCardPhone}
                                keyboardType="phone-pad"
                                placeholder={user?.phoneNumber || '+91 9876543210'}
                            />
                            <AppInput
                                label="Email"
                                value={businessCardEmail}
                                onChangeText={setBusinessCardEmail}
                                keyboardType="email-address"
                                autoCapitalize="none"
                                placeholder={user?.email || 'email@example.com'}
                            />
                            <AppInput
                                label="Website"
                                value={businessCardWebsite}
                                onChangeText={setBusinessCardWebsite}
                                autoCapitalize="none"
                                placeholder="https://yourbusiness.com"
                            />
                            <AppInput
                                label="Tagline"
                                value={businessCardTagline}
                                onChangeText={setBusinessCardTagline}
                                placeholder="Trusted service since 2010"
                            />
                            <AppInput
                                label="Address"
                                value={businessCardAddress}
                                onChangeText={setBusinessCardAddress}
                                multiline
                                numberOfLines={2}
                                placeholder="Business address"
                            />
                            <AppInput
                                label="GST Number"
                                value={businessCardGst}
                                onChangeText={setBusinessCardGst}
                                autoCapitalize="characters"
                                placeholder={user?.gstNumber || 'GSTIN'}
                            />
                            <AppInput
                                label="Custom Card Image URL"
                                value={businessCardCustomImageUrl}
                                onChangeText={setBusinessCardCustomImageUrl}
                                placeholder="https://..."
                            />
                            <View style={styles.memberActionRow}>
                                <AppButton
                                    mode="contained-tonal"
                                    onPress={() => { void handlePickBusinessCardImage(); }}
                                    loading={uploadingBusinessCardImage}
                                >
                                    Upload Own Card
                                </AppButton>
                                {Boolean(businessCardCustomImageUrl.trim()) && (
                                    <AppButton
                                        mode="text"
                                        onPress={() => setBusinessCardCustomImageUrl('')}
                                    >
                                        Clear Image
                                    </AppButton>
                                )}
                            </View>
                            <View style={styles.memberActionRow}>
                                <AppButton
                                    mode="contained"
                                    onPress={() => { void handleSaveBusinessCardSettings(); }}
                                    loading={savingBusinessCardSettings}
                                >
                                    Save Card Setup
                                </AppButton>
                                <AppButton
                                    mode="outlined"
                                    onPress={() => { void handleShareBusinessCard(); }}
                                >
                                    Share Card
                                </AppButton>
                            </View>
                        </>
                    )}
                </AppCard>
                <AppCard>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Institution Fee Reminders
                    </Text>
                    {!canManagePayments && (
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Access denied. Ask owner/admin for payments permission.
                        </Text>
                    )}
                    {canManagePayments && (
                        <>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                {dueReminders.length} due reminder(s) found.
                            </Text>
                            <SegmentedButtons
                                value={reminderMode}
                                onValueChange={(value) => setReminderMode(value === 'CLOUD' ? 'CLOUD' : 'DEVICE')}
                                buttons={[
                                    { value: 'DEVICE', label: 'Device WhatsApp' },
                                    { value: 'CLOUD', label: 'Cloud API' },
                                ]}
                                style={{ marginBottom: 12 }}
                            />
                            <AppInput
                                label="Custom Message (optional)"
                                value={customReminderMessage}
                                onChangeText={setCustomReminderMessage}
                                multiline
                                numberOfLines={3}
                                placeholder="Dear parent, please clear pending fees."
                            />
                            <AppInput
                                label="Media URL (optional)"
                                value={mediaUrl}
                                onChangeText={setMediaUrl}
                                placeholder="https://..."
                            />
                            <View style={styles.memberActionRow}>
                                <AppButton
                                    mode="contained-tonal"
                                    onPress={() => { void handlePickReminderMedia(); }}
                                    loading={uploadingReminderMedia}
                                >
                                    Attach Image
                                </AppButton>
                                {Boolean(mediaUrl.trim()) && (
                                    <AppButton
                                        mode="text"
                                        onPress={() => setMediaUrl('')}
                                    >
                                        Clear Media
                                    </AppButton>
                                )}
                            </View>
                            <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                Device mode is zero-cost and opens WhatsApp with prefilled text. Cloud mode uses server provider flow.
                            </Text>
                            {dueReminders.length === 0 && (
                                <Text variant="bodySmall" style={{ color: theme.colors.outline, marginTop: 6 }}>
                                    No dues found up to today.
                                </Text>
                            )}
                            {dueReminders.map((invoice) => {
                                const student = studentById.get(invoice.studentId);
                                const recipient = student?.phoneNumber?.trim();
                                const canSend = canSendMessages && Boolean(recipient);
                                const sending = sendingReminderForInvoiceId === invoice.id;

                                return (
                                    <View key={invoice.id} style={styles.reminderRow}>
                                        <Text variant="titleSmall" style={styles.memberName}>
                                            {student?.name || 'Unknown Student'}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                            Invoice: {invoice.invoiceNumber || invoice.id.slice(0, 8).toUpperCase()}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                            Due: {formatCurrency(invoice.dueAmount, activeCurrency)} | Due Date: {formatDate(invoice.dueDate)}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                                            Recipient: {recipient || 'No phone number'}
                                        </Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.outline, marginBottom: 8 }}>
                                            Barcode: {invoice.barcodeValue || '-'}
                                        </Text>
                                        <AppButton
                                            compact
                                            mode="contained-tonal"
                                            onPress={() => { void handleSendReminder(invoice); }}
                                            disabled={!canSend}
                                            loading={sending}
                                        >
                                            Send WhatsApp Reminder
                                        </AppButton>
                                    </View>
                                );
                            })}
                        </>
                    )}
                </AppCard>

                {loading && (
                    <View style={styles.loadingRow}>
                        <ActivityIndicator size="small" />
                        <Text variant="bodySmall" style={{ color: theme.colors.outline }}>
                            Refreshing business suite data...
                        </Text>
                    </View>
                )}
            </ScrollView>
            <SignatureCaptureModal
                visible={signatureCaptureVisible}
                onClose={() => setSignatureCaptureVisible(false)}
                onSave={(dataUrl) => { void handleCaptureSignatureSave(dataUrl); }}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingBottom: 24,
    },
    refreshRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: 8,
    },
    subHeading: {
        fontWeight: '700',
        marginBottom: 8,
    },
    permissionContainer: {
        marginBottom: 8,
    },
    permissionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        gap: 10,
    },
    permissionText: {
        flex: 1,
    },
    memberCard: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        borderColor: 'rgba(148,163,184,0.35)',
        marginBottom: 10,
    },
    memberName: {
        fontWeight: '700',
    },
    memberActionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    templateGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    templateChip: {
        marginBottom: 4,
    },
    reminderRow: {
        borderWidth: 1,
        borderRadius: 12,
        padding: 10,
        borderColor: 'rgba(148,163,184,0.35)',
        marginTop: 10,
    },
    loadingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
});
