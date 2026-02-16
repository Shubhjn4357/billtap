import fs from 'node:fs';

const loadLocalEnv = () => {
    const envPath = '.env';
    if (!fs.existsSync(envPath)) return;

    const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const delimiterIndex = line.indexOf('=');
        if (delimiterIndex <= 0) continue;

        const key = line.slice(0, delimiterIndex).trim();
        if (!key || process.env[key] !== undefined) continue;

        let value = line.slice(delimiterIndex + 1).trim();
        if (
            (value.startsWith('"') && value.endsWith('"'))
            || (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }
        process.env[key] = value;
    }
};

loadLocalEnv();

const baseUrl = (process.env.SMOKE_API_BASE_URL ?? 'http://127.0.0.1:8787/api').replace(/\/$/, '');
const phoneNumber = process.env.SMOKE_PHONE_NUMBER;
const forcedOtp = process.env.SMOKE_OTP_CODE;
const createSecondStore = String(process.env.SMOKE_CREATE_SECOND_STORE ?? 'true').toLowerCase() !== 'false';
const reminderRecipientOverride = process.env.SMOKE_REMINDER_RECIPIENT;

if (!phoneNumber) {
    throw new Error('SMOKE_PHONE_NUMBER is required.');
}

const logStep = (label, message) => {
    console.log(`[SMOKE][${label}] ${message}`);
};

const parseResponseBody = async (response) => {
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return text;
    }
};

const apiCall = async (method, path, options = {}) => {
    const headers = {};
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
        const message = typeof payload === 'object' && payload && 'message' in payload
            ? payload.message
            : `Request failed (${response.status})`;
        throw new Error(`${method} ${path}: ${message}`);
    }

    return payload;
};

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const getNested = (value, path) => {
    const keys = path.split('.');
    let current = value;
    for (const key of keys) {
        if (!current || typeof current !== 'object') return undefined;
        current = current[key];
    }
    return current;
};

const main = async () => {
    logStep('AUTH', `Sending OTP to ${phoneNumber}`);
    const sendOtp = await apiCall('POST', '/auth/phone/send', {
        body: { phoneNumber },
    });
    assert(sendOtp?.ok && sendOtp?.verificationId, sendOtp?.message || 'OTP send failed.');

    const otpCode = forcedOtp || sendOtp?.testCode;
    assert(otpCode, 'No OTP code available. Set SMOKE_OTP_CODE or enable testCode response.');

    logStep('AUTH', 'Verifying OTP and creating session token');
    const verify = await apiCall('POST', '/auth/phone/verify', {
        body: {
            verificationId: sendOtp.verificationId,
            verificationCode: otpCode,
        },
    });
    assert(verify?.ok && verify?.token, verify?.message || 'OTP verify failed.');
    const token = verify.token;

    logStep('ORG', 'Resolving current organization');
    const currentOrg = await apiCall('GET', '/organizations/current', { token });
    assert(currentOrg?.ok && currentOrg?.organization?.id, currentOrg?.message || 'Failed to resolve current organization.');
    const primaryOrganizationId = currentOrg.organization.id;

    const myOrganizations = await apiCall('GET', '/organizations/mine', { token });
    const organizations = Array.isArray(myOrganizations?.organizations)
        ? myOrganizations.organizations
        : [currentOrg.organization];

    let switchedOrganizationId = organizations.find((entry) => entry.id !== primaryOrganizationId)?.id;
    if (!switchedOrganizationId && createSecondStore) {
        logStep('ORG', 'No secondary store found; trying to create one for switch-flow smoke');
        const created = await apiCall('POST', '/organizations', {
            token,
            organizationId: primaryOrganizationId,
            body: {
                name: `Smoke Store ${Date.now()}`,
                code: `SMK${Math.floor(Math.random() * 9000 + 1000)}`,
                currency: 'INR',
            },
            allowFailure: true,
        });

        if (created?.ok && created?.id) {
            switchedOrganizationId = created.id;
            logStep('ORG', `Created secondary store ${created.id}`);
        } else {
            logStep(
                'ORG',
                `Secondary store creation skipped: ${created?.message || 'feature gate or permissions blocked this action'}`
            );
        }
    }

    const activeOrganizationId = switchedOrganizationId || primaryOrganizationId;
    const switchedOrg = await apiCall('GET', '/organizations/current', {
        token,
        organizationId: activeOrganizationId,
    });
    assert(switchedOrg?.ok && switchedOrg?.organization?.id, switchedOrg?.message || 'Failed to switch organization context.');
    logStep('ORG', `Active organization: ${switchedOrg.organization.name} (${switchedOrg.organization.id})`);

    logStep('SETTINGS', 'Validating permissions + business-card settings flow');
    assert(
        switchedOrg?.context?.permissions && typeof switchedOrg.context.permissions === 'object',
        'Organization context permissions are missing.'
    );

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

    const updatedSettings = await apiCall('PUT', '/organizations/settings/current', {
        token,
        organizationId: activeOrganizationId,
        body: { settings: settingsPatch },
    });
    assert(updatedSettings?.ok, updatedSettings?.message || 'Failed to update organization settings.');

    const expectedChecks = [
        ['staffFeatureAccess.purchase', false],
        ['staffFeatureAccess.inventory', true],
        ['businessCard.templateKey', 'ocean_blue'],
        ['businessCard.ownerName', 'Smoke Owner'],
    ];
    for (const [path, expected] of expectedChecks) {
        const actual = getNested(updatedSettings?.settings, path);
        assert(
            actual === expected,
            `Settings check failed for "${path}". Expected "${expected}", received "${actual}".`
        );
    }

    const itemId = `smoke_item_${Date.now()}`;
    logStep('BILL', 'Creating stock item for estimate billing flow');
    const createdItem = await apiCall('POST', '/items', {
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
    assert(createdItem?.ok && createdItem?.id, createdItem?.message || 'Failed to create smoke item.');

    logStep('BILL', 'Creating estimate bill');
    const createdBill = await apiCall('POST', '/transactions', {
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
    assert(createdBill?.ok && createdBill?.id, createdBill?.message || 'Failed to create estimate bill.');

    const reminderRecipient = reminderRecipientOverride || phoneNumber;
    logStep('REMINDER', 'Creating student and fee invoice');
    const createdStudent = await apiCall('POST', '/institution/students', {
        token,
        organizationId: activeOrganizationId,
        body: {
            name: `Smoke Student ${Date.now()}`,
            className: 'Class 5',
            guardianName: 'Smoke Guardian',
            phoneNumber: reminderRecipient,
        },
    });
    assert(createdStudent?.ok && createdStudent?.id, createdStudent?.message || 'Failed to create smoke student.');

    const dueDate = new Date().toISOString();
    const createdInvoice = await apiCall('POST', '/institution/fee-invoices', {
        token,
        organizationId: activeOrganizationId,
        body: {
            studentId: createdStudent.id,
            amount: 499,
            dueDate,
            notes: 'Smoke reminder invoice',
        },
    });
    assert(createdInvoice?.ok && createdInvoice?.id, createdInvoice?.message || 'Failed to create fee invoice.');

    logStep('REMINDER', 'Sending fee reminder through WhatsApp endpoint');
    const reminderSent = await apiCall(
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
    assert(reminderSent?.ok, reminderSent?.message || 'Failed to send fee reminder.');

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

main().catch((error) => {
    console.error(`[SMOKE][FAILED] ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
});
