type ApiCallOptions = {
    token?: string;
    organizationId?: string;
    body?: unknown;
    allowFailure?: boolean;
};

type ApiErrorPayload = {
    ok?: boolean;
    message?: string;
    [key: string]: unknown;
};

const baseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://127.0.0.1:8787/api').replace(/\/$/, '');
const phoneNumber = process.env.SMOKE_PHONE_NUMBER;
const forcedOtp = process.env.SMOKE_OTP_CODE;
const createSecondStore = String(process.env.SMOKE_CREATE_SECOND_STORE ?? 'true').toLowerCase() !== 'false';
const reminderRecipientOverride = process.env.SMOKE_REMINDER_RECIPIENT;

if (!phoneNumber) {
    throw new Error('SMOKE_PHONE_NUMBER is required.');
}

const logStep = (label: string, message: string) => {
    console.log(`[SMOKE][${label}] ${message}`);
};

const parseResponseBody = async (response: Response): Promise<unknown> => {
    const text = await response.text();
    if (!text) return null;
    try {
        return JSON.parse(text) as unknown;
    } catch {
        return text;
    }
};

const apiCall = async <T>(
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    path: string,
    options: ApiCallOptions = {}
): Promise<T> => {
    const headers: Record<string, string> = {};
    if (options.token) headers.Authorization = `Bearer ${options.token}`;
    if (options.organizationId) headers['X-Organization-Id'] = options.organizationId;
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';

    const response = await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    });
    const payload = await parseResponseBody(response);

    if (!response.ok && !options.allowFailure) {
        const errorPayload = payload as ApiErrorPayload;
        const message = errorPayload?.message || `Request failed (${response.status})`;
        throw new Error(`${method} ${path}: ${message}`);
    }

    return payload as T;
};

type AuthSendResponse = {
    ok: boolean;
    verificationId: string;
    testCode?: string;
    message?: string;
};

type AuthVerifyResponse = {
    ok: boolean;
    token: string;
    user: { uid: string; role: string };
    message?: string;
};

type OrganizationEntry = { id: string; name: string; code: string };

type OrganizationsResponse = {
    ok: boolean;
    organizations?: OrganizationEntry[];
    message?: string;
};

type CurrentOrganizationResponse = {
    ok: boolean;
    organization?: { id: string; name: string; code: string };
    context?: {
        role: string;
        permissions?: Record<string, boolean>;
        settings?: Record<string, unknown>;
    };
    message?: string;
};

type CreateOrganizationResponse = {
    ok: boolean;
    id?: string;
    message?: string;
    upgrade?: {
        feature?: string;
        used?: number;
        limit?: number;
    };
};

type OrganizationSettingsResponse = {
    ok: boolean;
    settings?: Record<string, unknown>;
    message?: string;
};

const getNested = (value: Record<string, unknown> | undefined, path: string): unknown => {
    if (!value) return undefined;
    const keys = path.split('.');
    let current: unknown = value;

    for (const key of keys) {
        if (!current || typeof current !== 'object') return undefined;
        current = (current as Record<string, unknown>)[key];
    }

    return current;
};

const main = async () => {
    logStep('AUTH', `Sending OTP to ${phoneNumber}`);
    const sendOtp = await apiCall<AuthSendResponse>('POST', '/auth/phone/send', {
        body: { phoneNumber },
    });
    if (!sendOtp.ok || !sendOtp.verificationId) {
        throw new Error(sendOtp.message || 'OTP send failed.');
    }

    const otpCode = forcedOtp || sendOtp.testCode;
    if (!otpCode) {
        throw new Error('No OTP code available. Set SMOKE_OTP_CODE or enable testCode response.');
    }

    logStep('AUTH', 'Verifying OTP and creating session token');
    const verify = await apiCall<AuthVerifyResponse>('POST', '/auth/phone/verify', {
        body: {
            verificationId: sendOtp.verificationId,
            verificationCode: otpCode,
        },
    });
    if (!verify.ok || !verify.token) {
        throw new Error(verify.message || 'OTP verify failed.');
    }
    const token = verify.token;

    logStep('ORG', 'Resolving current organization');
    const currentOrg = await apiCall<CurrentOrganizationResponse>('GET', '/organizations/current', {
        token,
    });
    if (!currentOrg.ok || !currentOrg.organization) {
        throw new Error(currentOrg.message || 'Failed to resolve current organization.');
    }
    let primaryOrganizationId = currentOrg.organization.id;

    const myOrganizations = await apiCall<OrganizationsResponse>('GET', '/organizations/mine', { token });
    const organizations = myOrganizations.organizations ?? [currentOrg.organization];

    let switchedOrganizationId = organizations.find((entry) => entry.id !== primaryOrganizationId)?.id;
    if (!switchedOrganizationId && createSecondStore) {
        logStep('ORG', 'No secondary store found; trying to create one for switch-flow smoke');
        const created = await apiCall<CreateOrganizationResponse>('POST', '/organizations', {
            token,
            organizationId: primaryOrganizationId,
            body: {
                name: `Smoke Store ${Date.now()}`,
                code: `SMK${Math.floor(Math.random() * 9000 + 1000)}`,
                currency: 'INR',
            },
            allowFailure: true,
        });

        if (created.ok && created.id) {
            switchedOrganizationId = created.id;
            logStep('ORG', `Created secondary store ${created.id}`);
        } else {
            logStep(
                'ORG',
                `Secondary store creation skipped: ${created.message || 'feature gate or permissions blocked this action'}`
            );
        }
    }

    const activeOrganizationId = switchedOrganizationId || primaryOrganizationId;
    const switchedOrg = await apiCall<CurrentOrganizationResponse>('GET', '/organizations/current', {
        token,
        organizationId: activeOrganizationId,
    });
    if (!switchedOrg.ok || !switchedOrg.organization) {
        throw new Error(switchedOrg.message || 'Failed to switch organization context.');
    }
    logStep('ORG', `Active organization: ${switchedOrg.organization.name} (${switchedOrg.organization.id})`);

    logStep('SETTINGS', 'Validating permissions + business-card settings flow');
    if (!switchedOrg.context?.permissions || typeof switchedOrg.context.permissions !== 'object') {
        throw new Error('Organization context permissions are missing.');
    }

    const settingsPatch = {
        staffFeatureAccess: {
            purchase: false,
            reports: true,
            inventory: true,
        },
        businessCard: {
            templateKey: 'ocean_blue',
            ownerName: 'Smoke Owner',
            phoneNumber,
            email: 'smoke-owner@billtap.test',
            website: 'https://billtap.test',
            tagline: 'Smoke validated',
            address: 'Smoke Test Street',
            gstNumber: '23ABCDE1234F1Z5',
        },
    };

    const updatedSettings = await apiCall<OrganizationSettingsResponse>('PUT', '/organizations/settings/current', {
        token,
        organizationId: activeOrganizationId,
        body: { settings: settingsPatch },
    });
    if (!updatedSettings.ok || !updatedSettings.settings) {
        throw new Error(updatedSettings.message || 'Failed to update organization settings.');
    }

    const expectedChecks: Array<[string, string | boolean]> = [
        ['staffFeatureAccess.purchase', false],
        ['staffFeatureAccess.inventory', true],
        ['businessCard.templateKey', 'ocean_blue'],
        ['businessCard.ownerName', 'Smoke Owner'],
    ];
    for (const [path, expected] of expectedChecks) {
        const actual = getNested(updatedSettings.settings, path);
        if (actual !== expected) {
            throw new Error(`Settings check failed for "${path}". Expected "${expected}", received "${String(actual)}".`);
        }
    }

    const itemId = `smoke_item_${Date.now()}`;
    logStep('BILL', 'Creating stock item for estimate billing flow');
    const createdItem = await apiCall<{ ok: boolean; id?: string; message?: string }>('POST', '/items', {
        token,
        organizationId: activeOrganizationId,
        body: {
            id: itemId,
            name: `Smoke Item ${Date.now()}`,
            price: 120,
            purchasePrice: 80,
            stock: 25,
            minimumStock: 3,
            gstPercentage: 18,
            isActive: true,
        },
    });
    if (!createdItem.ok || !createdItem.id) {
        throw new Error(createdItem.message || 'Failed to create smoke item.');
    }

    logStep('BILL', 'Creating estimate bill');
    const createdBill = await apiCall<{ ok: boolean; id?: string; message?: string }>('POST', '/transactions', {
        token,
        organizationId: activeOrganizationId,
        body: {
            type: 'SALE',
            billMode: 'ESTIMATE',
            affectsGst: false,
            paymentMode: 'CASH',
            items: [
                {
                    id: createdItem.id,
                    name: 'Smoke Item',
                    quantity: 1,
                    price: 120,
                    tax: 0,
                    total: 120,
                },
            ],
            totalAmount: 120,
            discountAmount: 0,
            taxAmount: 0,
            currency: 'INR',
            partyName: 'Smoke Customer',
            partyPhone: '+919999999999',
            remark: 'Smoke estimate bill',
        },
    });
    if (!createdBill.ok || !createdBill.id) {
        throw new Error(createdBill.message || 'Failed to create estimate bill.');
    }

    const reminderRecipient = reminderRecipientOverride || phoneNumber;
    logStep('REMINDER', 'Creating student and fee invoice');
    const createdStudent = await apiCall<{ ok: boolean; id?: string; message?: string }>('POST', '/institution/students', {
        token,
        organizationId: activeOrganizationId,
        body: {
            name: `Smoke Student ${Date.now()}`,
            className: 'Class 5',
            guardianName: 'Smoke Guardian',
            phoneNumber: reminderRecipient,
        },
    });
    if (!createdStudent.ok || !createdStudent.id) {
        throw new Error(createdStudent.message || 'Failed to create smoke student.');
    }

    const dueDate = new Date().toISOString();
    const createdInvoice = await apiCall<{ ok: boolean; id?: string; message?: string }>('POST', '/institution/fee-invoices', {
        token,
        organizationId: activeOrganizationId,
        body: {
            studentId: createdStudent.id,
            amount: 499,
            dueDate,
            notes: 'Smoke reminder invoice',
        },
    });
    if (!createdInvoice.ok || !createdInvoice.id) {
        throw new Error(createdInvoice.message || 'Failed to create fee invoice.');
    }

    logStep('REMINDER', 'Sending fee reminder through WhatsApp endpoint');
    const reminderSent = await apiCall<{ ok: boolean; status?: string; message?: string }>(
        'POST',
        `/institution/fee-reminders/${encodeURIComponent(createdInvoice.id)}/send-whatsapp`,
        {
            token,
            organizationId: activeOrganizationId,
            body: {
                recipient: reminderRecipient,
                customMessage: 'Smoke reminder message from E2E suite.',
            },
        }
    );
    if (!reminderSent.ok) {
        throw new Error(reminderSent.message || 'Failed to send fee reminder.');
    }

    logStep('DONE', 'Smoke suite passed');
    console.log(
        JSON.stringify(
            {
                ok: true,
                userId: verify.user.uid,
                organizationId: activeOrganizationId,
                billId: createdBill.id,
                feeInvoiceId: createdInvoice.id,
                reminderStatus: reminderSent.status ?? 'sent',
            },
            null,
            2
        )
    );
};

main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[SMOKE][FAILED] ${message}`);
    process.exit(1);
});
