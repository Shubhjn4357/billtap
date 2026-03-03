#!/usr/bin/env node

const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const projectRoot = path.resolve(__dirname, '..');
const sourcePath = path.join(projectRoot, 'src', 'utils', 'invoiceHtml.ts');
const snapshotDir = path.join(projectRoot, 'tests', 'golden');
const updateSnapshots = process.argv.includes('--update');

function loadInvoiceTemplateModule() {
    const source = fs.readFileSync(sourcePath, 'utf8');
    const transpiled = ts.transpileModule(source, {
        compilerOptions: {
            target: ts.ScriptTarget.ES2020,
            module: ts.ModuleKind.CommonJS,
            esModuleInterop: true,
        },
        fileName: sourcePath,
    }).outputText;

    const module = { exports: {} };
    const localRequire = (specifier) => {
        if (specifier.startsWith('.')) {
            const resolved = path.resolve(path.dirname(sourcePath), specifier);
            return require(resolved);
        }
        return require(specifier);
    };

    // eslint-disable-next-line no-new-func
    const fn = new Function('require', 'module', 'exports', transpiled);
    fn(localRequire, module, module.exports);
    return module.exports;
}

function buildFixtureInvoice() {
    return {
        id: 'inv_fixture_01',
        businessId: 'biz_fixture_01',
        invoiceType: 'TAX_INVOICE',
        invoiceNumber: 'VH-2026-0001',
        invoiceDate: '2026-03-01',
        partyId: 'pty_1',
        placeOfSupply: 'Rajasthan',
        totalTaxableValue: 1450,
        totalTaxAmount: 261,
        totalInvoiceValue: 1711,
        discountAmount: 0,
        roundOffAmount: 0,
        additionalCharges: 0,
        reverseCharge: false,
        gstRateBreakupJson: {},
        eInvoiceIrn: null,
        eInvoiceStatus: null,
        eWayBillNumber: null,
        paymentStatus: 'PARTIALLY_PAID',
        paidAmount: 500,
        dueDate: '2026-03-10',
        notes: 'Delivered in good condition.',
        termsAndConditions: 'Goods once sold will not be taken back.',
        sourceVoucherType: null,
        sourceVoucherId: null,
        isDeleted: false,
        createdByUserId: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        totalCgstAmount: 130.5,
        totalSgstAmount: 130.5,
        totalIgstAmount: 0,
        partySnapshot: {
            name: 'Acme Traders',
            gstin: '08ABCDE1234F1Z5',
            phone: '9876543210',
            address: 'Jaipur, Rajasthan',
        },
        items: [
            {
                id: 'line_1',
                invoiceId: 'inv_fixture_01',
                itemId: 'itm_1',
                description: 'Premium Tea Pack',
                quantity: 10,
                unit: 'pcs',
                rate: 120,
                discountPercent: 0,
                discountAmount: 0,
                taxableValue: 1200,
                gstRate: 18,
                cgstRate: 9,
                cgstAmount: 108,
                sgstRate: 9,
                sgstAmount: 108,
                igstRate: 0,
                igstAmount: 0,
                cessRate: 0,
                cessAmount: 0,
                total: 1416,
                sortOrder: 1,
            },
            {
                id: 'line_2',
                invoiceId: 'inv_fixture_01',
                itemId: 'itm_2',
                description: 'Thermal Paper Roll',
                quantity: 5,
                unit: 'pcs',
                rate: 50,
                discountPercent: 0,
                discountAmount: 0,
                taxableValue: 250,
                gstRate: 18,
                cgstRate: 9,
                cgstAmount: 22.5,
                sgstRate: 9,
                sgstAmount: 22.5,
                igstRate: 0,
                igstAmount: 0,
                cessRate: 0,
                cessAmount: 0,
                total: 295,
                sortOrder: 2,
            },
        ],
    };
}

function normalizeText(value) {
    return value.replace(/\r\n/g, '\n').trim();
}

function run() {
    if (!fs.existsSync(sourcePath)) {
        console.error(`[verify:invoice-snapshots] Missing source file: ${sourcePath}`);
        process.exit(1);
    }

    const templateModule = loadInvoiceTemplateModule();
    const generateInvoiceHtml = templateModule.generateInvoiceHtml;
    const baseConfig = templateModule.DEFAULT_INVOICE_PRINT_CONFIG;

    if (typeof generateInvoiceHtml !== 'function' || !baseConfig) {
        console.error('[verify:invoice-snapshots] Could not load invoice template exports.');
        process.exit(1);
    }

    const invoice = buildFixtureInvoice();
    const sharedExtras = {
        upiId: 'merchant@upi',
        dueAmount: 1211,
        currencyCode: 'INR',
        businessName: 'Vahi Demo Store',
        businessAddress: 'Ajmer Road, Jaipur',
        businessPhone: '9123456789',
        businessEmail: 'billing@vahi.app',
        businessGstin: '08ABCDE1234F1Z5',
        businessLogoUrl: 'https://example.com/logo.png',
        signatureImageUrl: 'https://example.com/signature.png',
        qrImageUrl: 'https://example.com/qr.png',
    };

    const snapshots = {
        'invoice-a4.html': generateInvoiceHtml(invoice, {
            ...sharedExtras,
            printConfig: {
                ...baseConfig,
                printLayoutType: 'REGULAR',
                pageSize: 'A4',
                orientation: 'PORTRAIT',
                printSignatureText: true,
                printSignatureImage: true,
                customSignatureText: 'Authorized Signatory',
                printPaymentMode: true,
                printReceivedAmount: true,
                printBalanceAmount: true,
                printTermsAndConditions: true,
                printTotalItemQuantity: true,
            },
        }),
        'invoice-thermal.html': generateInvoiceHtml(invoice, {
            ...sharedExtras,
            printConfig: {
                ...baseConfig,
                printLayoutType: 'THERMAL',
                pageSize: '80mm',
                printTextSize: 'SMALL',
                printCompanyLogo: false,
                printTaxDetailsBreakup: false,
                printDescription: false,
                printSignatureText: false,
                printSignatureImage: false,
                printPageNumbers: false,
            },
        }),
    };

    fs.mkdirSync(snapshotDir, { recursive: true });

    const issues = [];
    for (const [fileName, output] of Object.entries(snapshots)) {
        const snapshotPath = path.join(snapshotDir, fileName);
        const normalizedOutput = `${normalizeText(output)}\n`;

        if (updateSnapshots || !fs.existsSync(snapshotPath)) {
            fs.writeFileSync(snapshotPath, normalizedOutput, 'utf8');
            continue;
        }

        const existing = normalizeText(fs.readFileSync(snapshotPath, 'utf8'));
        if (existing !== normalizeText(normalizedOutput)) {
            issues.push(fileName);
        }
    }

    if (issues.length > 0) {
        console.error('\nInvoice HTML snapshot check failed:\n');
        for (const issue of issues) {
            console.error(`- Snapshot mismatch: tests/golden/${issue}`);
        }
        console.error('\nRun: pnpm run verify:invoice-snapshots:update');
        process.exit(1);
    }

    console.log(`[verify:invoice-snapshots] Passed (${Object.keys(snapshots).length} snapshots checked).`);
}

run();
