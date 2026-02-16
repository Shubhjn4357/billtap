import { apiClient } from './httpClient';

export interface PayrollSnapshot {
    attendanceCount: number;
    salaryRuns: {
        total: number;
        draft: number;
        finalized: number;
    };
}

export interface GstComplianceSnapshot {
    salesTaxableValue: number;
    outputTax: number;
    inputTax: number;
    netGstPayable: number;
    eligibleItc: number;
    ineligibleItc: number;
}

export interface TreasurySnapshot {
    bankAccountCount: number;
    receivables: number;
    payables: number;
    netCashFlow: number;
}

export interface EnterpriseSnapshot {
    branchCount: number;
    consolidatedSales: number;
    consolidatedPurchases: number;
    consolidatedStockValue: number;
}

export type StaffRole = 'owner' | 'manager' | 'salesman';

export type StaffPermissionKey =
    | 'can_create_bill'
    | 'can_back_date'
    | 'can_delete_bill'
    | 'can_view_cost_price'
    | 'can_access_settings'
    | 'can_manage_staff'
    | 'can_manage_subscription'
    | 'can_manage_templates'
    | 'can_manage_inventory'
    | 'can_manage_expenses'
    | 'can_manage_payments'
    | 'can_send_messages';

export type StaffPermissions = Partial<Record<StaffPermissionKey, boolean>>;

export interface OrganizationSummary {
    id: string;
    userId: string;
    name: string;
    code: string;
    currency?: string | null;
}

export interface OrganizationMembership {
    id: string;
    name: string;
    code: string;
    currency?: string | null;
    role: StaffRole;
    permissions: StaffPermissions;
}

export interface OrganizationContextPayload {
    role: StaffRole;
    permissions: StaffPermissions;
    ownerUserId: string;
    settings: Record<string, unknown>;
}

export interface OrganizationMemberUser {
    uid: string;
    displayName?: string | null;
    phoneNumber?: string | null;
    email?: string | null;
}

export interface OrganizationMember {
    id: string;
    userId: string;
    organizationId: string;
    role: StaffRole;
    permissions: StaffPermissions;
    isActive: boolean;
    phoneNumberSnapshot?: string | null;
    joinedAt?: string;
    user?: OrganizationMemberUser | null;
}

export interface BillTemplateEntry {
    id: string;
    templateKey: string;
    name: string;
    isPremium: boolean;
    isActive: boolean;
    layoutConfig?: Record<string, unknown>;
}

export interface SignatureEntry {
    id: string;
    name?: string | null;
    signatureData?: string | null;
    signatureUrl?: string | null;
    isDefault: boolean;
    createdAt?: string;
    updatedAt?: string;
}

export interface InstitutionStudent {
    id: string;
    name: string;
    className?: string | null;
    admissionNumber?: string | null;
    guardianName?: string | null;
    phoneNumber?: string | null;
    isActive: boolean;
}

export interface FeeReminderInvoice {
    id: string;
    studentId: string;
    invoiceNumber?: string | null;
    amount: number;
    dueAmount: number;
    dueDate?: string | null;
    status: string;
    barcodeValue?: string | null;
}

const withOrgQuery = (path: string, organizationId?: string): string => {
    if (!organizationId) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}organizationId=${encodeURIComponent(organizationId)}`;
};

export const businessSuiteService = {
    async getPayrollSnapshot(): Promise<PayrollSnapshot> {
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

        const [attendanceResponse, runsResponse] = await Promise.all([
            apiClient.get<{ ok: boolean; records?: unknown[]; message?: string }>(
                `/payroll/attendance?start=${encodeURIComponent(startDate)}&limit=500`
            ),
            apiClient.get<{ ok: boolean; runs?: { status: string }[]; message?: string }>(
                '/payroll/salary-runs?limit=100'
            ),
        ]);

        if (!attendanceResponse.ok) throw new Error(attendanceResponse.message || 'Failed to load attendance snapshot.');
        if (!runsResponse.ok) throw new Error(runsResponse.message || 'Failed to load payroll runs snapshot.');

        const runs = runsResponse.runs ?? [];
        const draft = runs.filter((row) => row.status === 'draft').length;
        const finalized = runs.filter((row) => row.status === 'finalized').length;

        return {
            attendanceCount: attendanceResponse.records?.length ?? 0,
            salaryRuns: {
                total: runs.length,
                draft,
                finalized,
            },
        };
    },

    async getGstComplianceSnapshot(): Promise<GstComplianceSnapshot> {
        const response = await apiClient.get<{
            ok: boolean;
            sales?: { taxableValue: number; outputTax: number };
            purchases?: { inputTax: number };
            itc?: { eligible: number; ineligible: number };
            netGstPayable?: number;
            message?: string;
        }>('/gst-compliance/summary');

        if (!response.ok || !response.sales || !response.purchases || !response.itc) {
            throw new Error(response.message || 'Failed to load GST compliance snapshot.');
        }

        return {
            salesTaxableValue: response.sales.taxableValue,
            outputTax: response.sales.outputTax,
            inputTax: response.purchases.inputTax,
            netGstPayable: response.netGstPayable ?? 0,
            eligibleItc: response.itc.eligible,
            ineligibleItc: response.itc.ineligible,
        };
    },

    async getTreasurySnapshot(): Promise<TreasurySnapshot> {
        const [accountsResponse, agingResponse, cashFlowResponse] = await Promise.all([
            apiClient.get<{ ok: boolean; accounts?: unknown[]; message?: string }>('/treasury/bank-accounts'),
            apiClient.get<{
                ok: boolean;
                totals?: { receivables: number; payables: number };
                message?: string;
            }>('/treasury/aging'),
            apiClient.get<{
                ok: boolean;
                summary?: { netCashFlow: number };
                message?: string;
            }>('/treasury/cash-flow'),
        ]);

        if (!accountsResponse.ok) throw new Error(accountsResponse.message || 'Failed to load bank accounts snapshot.');
        if (!agingResponse.ok || !agingResponse.totals) throw new Error(agingResponse.message || 'Failed to load aging snapshot.');
        if (!cashFlowResponse.ok || !cashFlowResponse.summary) throw new Error(cashFlowResponse.message || 'Failed to load cash flow snapshot.');

        return {
            bankAccountCount: accountsResponse.accounts?.length ?? 0,
            receivables: agingResponse.totals.receivables,
            payables: agingResponse.totals.payables,
            netCashFlow: cashFlowResponse.summary.netCashFlow,
        };
    },

    async getEnterpriseSnapshot(): Promise<EnterpriseSnapshot> {
        const [branchesResponse, consolidatedResponse] = await Promise.all([
            apiClient.get<{ ok: boolean; branches?: unknown[]; message?: string }>('/enterprise/branches'),
            apiClient.get<{
                ok: boolean;
                totals?: {
                    sales: number;
                    purchases: number;
                    stockValue: number;
                };
                message?: string;
            }>('/enterprise/reports/consolidated'),
        ]);

        if (!branchesResponse.ok) throw new Error(branchesResponse.message || 'Failed to load branches snapshot.');
        if (!consolidatedResponse.ok || !consolidatedResponse.totals) {
            throw new Error(consolidatedResponse.message || 'Failed to load consolidated snapshot.');
        }

        return {
            branchCount: branchesResponse.branches?.length ?? 0,
            consolidatedSales: consolidatedResponse.totals.sales,
            consolidatedPurchases: consolidatedResponse.totals.purchases,
            consolidatedStockValue: consolidatedResponse.totals.stockValue,
        };
    },

    async getMyOrganizations(): Promise<OrganizationMembership[]> {
        const response = await apiClient.get<{
            ok: boolean;
            organizations?: OrganizationMembership[];
            message?: string;
        }>('/organizations/mine');

        if (!response.ok || !response.organizations) {
            throw new Error(response.message || 'Failed to load organizations.');
        }

        return response.organizations;
    },

    async createOrganization(payload: {
        name: string;
        code: string;
        currency?: string;
        phoneNumber?: string;
        email?: string;
        gstNumber?: string;
        address?: string;
    }): Promise<string> {
        const response = await apiClient.post<{
            ok: boolean;
            id?: string;
            message?: string;
        }>('/organizations', payload);

        if (!response.ok || !response.id) {
            throw new Error(response.message || 'Failed to create organization.');
        }

        return response.id;
    },

    async getCurrentOrganization(organizationId?: string): Promise<{
        organization: OrganizationSummary;
        context: OrganizationContextPayload;
    }> {
        const response = await apiClient.get<{
            ok: boolean;
            organization?: OrganizationSummary;
            context?: OrganizationContextPayload;
            message?: string;
        }>(withOrgQuery('/organizations/current', organizationId));

        if (!response.ok || !response.organization || !response.context) {
            throw new Error(response.message || 'Failed to load organization context.');
        }

        return {
            organization: response.organization,
            context: response.context,
        };
    },

    async getOrganizationMembers(organizationId?: string): Promise<OrganizationMember[]> {
        const response = await apiClient.get<{
            ok: boolean;
            members?: OrganizationMember[];
            message?: string;
        }>(withOrgQuery('/organizations/members/current', organizationId));

        if (!response.ok || !response.members) {
            throw new Error(response.message || 'Failed to load organization members.');
        }

        return response.members;
    },

    async addOrganizationMember(payload: {
        displayName: string;
        phoneNumber: string;
        role: 'manager' | 'salesman';
        permissions?: StaffPermissions;
    }, organizationId?: string): Promise<string> {
        const response = await apiClient.post<{
            ok: boolean;
            userId?: string;
            message?: string;
        }>(withOrgQuery('/organizations/members/current', organizationId), payload);

        if (!response.ok || !response.userId) {
            throw new Error(response.message || 'Failed to add staff member.');
        }

        return response.userId;
    },

    async updateOrganizationMember(
        memberId: string,
        payload: { role?: 'manager' | 'salesman'; permissions?: StaffPermissions; isActive?: boolean },
        organizationId?: string
    ): Promise<void> {
        const response = await apiClient.patch<{ ok: boolean; message?: string }>(
            withOrgQuery(`/organizations/members/current/${memberId}`, organizationId),
            payload
        );
        if (!response.ok) {
            throw new Error(response.message || 'Failed to update member.');
        }
    },

    async removeOrganizationMember(memberId: string, organizationId?: string): Promise<void> {
        const response = await apiClient.delete<{ ok: boolean; message?: string }>(
            withOrgQuery(`/organizations/members/current/${memberId}`, organizationId)
        );
        if (!response.ok) {
            throw new Error(response.message || 'Failed to remove member.');
        }
    },

    async getOrganizationSettings(organizationId?: string): Promise<Record<string, unknown>> {
        const response = await apiClient.get<{
            ok: boolean;
            settings?: Record<string, unknown>;
            message?: string;
        }>(withOrgQuery('/organizations/settings/current', organizationId));

        if (!response.ok || !response.settings) {
            throw new Error(response.message || 'Failed to load organization settings.');
        }

        return response.settings;
    },

    async updateOrganizationSettings(
        settings: Record<string, unknown>,
        organizationId?: string
    ): Promise<Record<string, unknown>> {
        const response = await apiClient.put<{
            ok: boolean;
            settings?: Record<string, unknown>;
            message?: string;
        }>(withOrgQuery('/organizations/settings/current', organizationId), { settings });

        if (!response.ok || !response.settings) {
            throw new Error(response.message || 'Failed to update organization settings.');
        }

        return response.settings;
    },

    async getTemplates(organizationId?: string): Promise<BillTemplateEntry[]> {
        const response = await apiClient.get<{ ok: boolean; templates?: BillTemplateEntry[]; message?: string }>(
            withOrgQuery('/organizations/templates/current', organizationId)
        );

        if (!response.ok || !response.templates) {
            throw new Error(response.message || 'Failed to load templates.');
        }

        return response.templates;
    },

    async getSignatures(organizationId?: string): Promise<SignatureEntry[]> {
        const response = await apiClient.get<{ ok: boolean; signatures?: SignatureEntry[]; message?: string }>(
            withOrgQuery('/organizations/signatures/current', organizationId)
        );
        if (!response.ok || !response.signatures) {
            throw new Error(response.message || 'Failed to load signatures.');
        }
        return response.signatures;
    },

    async createSignature(payload: {
        name?: string;
        signatureData?: string;
        signatureUrl?: string;
        isDefault?: boolean;
    }, organizationId?: string): Promise<string> {
        const response = await apiClient.post<{ ok: boolean; id?: string; message?: string }>(
            withOrgQuery('/organizations/signatures/current', organizationId),
            payload
        );
        if (!response.ok || !response.id) {
            throw new Error(response.message || 'Failed to save signature.');
        }
        return response.id;
    },

    async setDefaultSignature(signatureId: string, organizationId?: string): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>(
            withOrgQuery(`/organizations/signatures/current/${signatureId}/default`, organizationId)
        );
        if (!response.ok) {
            throw new Error(response.message || 'Failed to set default signature.');
        }
    },

    async getInstitutionStudents(organizationId?: string): Promise<InstitutionStudent[]> {
        const response = await apiClient.get<{ ok: boolean; students?: InstitutionStudent[]; message?: string }>(
            withOrgQuery('/institution/students', organizationId)
        );

        if (!response.ok || !response.students) {
            throw new Error(response.message || 'Failed to load students.');
        }

        return response.students;
    },

    async getDueFeeReminders(dueBefore?: string, organizationId?: string): Promise<FeeReminderInvoice[]> {
        const query = dueBefore ? `?dueBefore=${encodeURIComponent(dueBefore)}` : '';
        const response = await apiClient.get<{ ok: boolean; reminders?: FeeReminderInvoice[]; message?: string }>(
            withOrgQuery(`/institution/fee-reminders/due${query}`, organizationId)
        );

        if (!response.ok || !response.reminders) {
            throw new Error(response.message || 'Failed to load due reminders.');
        }

        return response.reminders;
    },

    async sendFeeReminderWhatsApp(payload: {
        invoiceId: string;
        recipient: string;
        customMessage?: string;
        mediaUrl?: string;
    }, organizationId?: string): Promise<void> {
        const response = await apiClient.post<{ ok: boolean; message?: string }>(
            withOrgQuery(`/institution/fee-reminders/${payload.invoiceId}/send-whatsapp`, organizationId),
            {
                recipient: payload.recipient,
                customMessage: payload.customMessage,
                mediaUrl: payload.mediaUrl,
            }
        );

        if (!response.ok) {
            throw new Error(response.message || 'Failed to send WhatsApp reminder.');
        }
    },
};
