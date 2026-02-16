import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ActivityIndicator, Chip, Divider, SegmentedButtons, Switch, Text, useTheme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import {
    businessSuiteService,
    type BillTemplateEntry,
    type EnterpriseSnapshot,
    type FeeReminderInvoice,
    type GstComplianceSnapshot,
    type InstitutionStudent,
    type OrganizationMembership,
    type OrganizationMember,
    type PayrollSnapshot,
    type SignatureEntry,
    type StaffPermissionKey,
    type StaffPermissions,
    type StaffRole,
    type TreasurySnapshot,
} from '../../api/businessSuiteService';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationStore, useSettingsStore } from '../../store';
import { Config } from '../../constants/Config';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';

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
    { key: 'can_create_bill', label: 'Create Bill', description: 'Can create sale/purchase bills.' },
    { key: 'can_back_date', label: 'Back-Date Entry', description: 'Can create bills for past dates.' },
    { key: 'can_delete_bill', label: 'Delete Bill', description: 'Can delete bill records.' },
    { key: 'can_view_cost_price', label: 'View Cost Price', description: 'Can see item purchase prices.' },
    { key: 'can_manage_inventory', label: 'Manage Inventory', description: 'Can update stock and items.' },
    { key: 'can_manage_payments', label: 'Manage Payments', description: 'Can record payment in/out and reminders.' },
    { key: 'can_manage_expenses', label: 'Manage Expenses', description: 'Can create and edit expenses.' },
    { key: 'can_manage_templates', label: 'Manage Templates', description: 'Can change template and print settings.' },
    { key: 'can_send_messages', label: 'Send Messages', description: 'Can send WhatsApp/SMS reminders.' },
    { key: 'can_access_settings', label: 'Access Settings', description: 'Can open business settings.' },
    { key: 'can_manage_staff', label: 'Manage Staff', description: 'Can add/remove staff and roles.' },
    { key: 'can_manage_subscription', label: 'Manage Subscription', description: 'Can buy/renew plans.' },
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
            can_back_date: true,
            can_delete_bill: false,
            can_view_cost_price: true,
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
        can_back_date: false,
        can_delete_bill: false,
        can_view_cost_price: false,
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

export const BusinessSuiteScreen = () => {
    const theme = useTheme();
    const dialog = useAppDialog();
    const { user } = useAuth();
    const { selectedOrganizationId, setSelectedOrganizationId } = useOrganizationStore();
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

    const [newStoreName, setNewStoreName] = useState('');
    const [newStoreCode, setNewStoreCode] = useState('');
    const [creatingStore, setCreatingStore] = useState(false);

    const [customReminderMessage, setCustomReminderMessage] = useState('');
    const [mediaUrl, setMediaUrl] = useState('');

    const netBusinessContribution = useMemo(() => {
        return enterprise.consolidatedSales - enterprise.consolidatedPurchases;
    }, [enterprise.consolidatedPurchases, enterprise.consolidatedSales]);

    const isOwnerOrAdmin = organizationRole === 'owner' || user?.role === 'admin';
    const canManageStaff = isOwnerOrAdmin || Boolean(organizationPermissions.can_manage_staff);
    const canManageTemplates = isOwnerOrAdmin || Boolean(organizationPermissions.can_manage_templates);
    const canManagePayments = isOwnerOrAdmin || Boolean(organizationPermissions.can_manage_payments);
    const canSendMessages = isOwnerOrAdmin || Boolean(organizationPermissions.can_send_messages);
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
    const applySettingsToUi = (settings: Record<string, unknown>) => {
        const customization = asRecord(settings.customization);
        const print = asRecord(settings.print);

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
    };

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
            applySettingsToUi(asRecord(orgPayload.context.settings));

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
    }, [dialog, selectedOrganizationId, setSelectedOrganizationId, user?.role]);

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
            dialog.alert('Signature', 'Paste signature URL or base64 data.');
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
            dialog.alert('Template', 'Template and print settings saved.');
        } catch (error: unknown) {
            dialog.alert('Template', error instanceof Error ? error.message : 'Failed to save template settings.');
        } finally {
            setSavingTemplateSettings(false);
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

        setSendingReminderForInvoiceId(invoice.id);
        try {
            await businessSuiteService.sendFeeReminderWhatsApp({
                invoiceId: invoice.id,
                recipient,
                customMessage: customReminderMessage.trim() || undefined,
                mediaUrl: mediaUrl.trim() || undefined,
            }, currentOrganizationId);
            dialog.alert('Reminder', 'WhatsApp reminder sent successfully.');
        } catch (error: unknown) {
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
                            <AppInput
                                label="Signature URL or Base64 Data"
                                value={signaturePayload}
                                onChangeText={setSignaturePayload}
                                multiline
                                numberOfLines={3}
                                placeholder="https://... or data:image/png;base64,..."
                            />
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
