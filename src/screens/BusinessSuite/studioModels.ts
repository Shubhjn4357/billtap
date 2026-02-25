import type { OrganizationSummary } from '../../api/businessSuiteService';
import type { UserProfile } from '../../types';
import { BUSINESS_CARD_TEMPLATES } from '../../utils/businessCard';

export type PrinterType = 'STANDARD' | 'THERMAL';
export type PaperSize = 'A4' | 'A5' | '2INCH' | '3INCH';

export interface TemplateStudioModel {
    templateKey: string;
    godHeaderText: string;
    acknowledgmentText: string;
    footerText: string;
    printerType: PrinterType;
    paperSize: PaperSize;
}

export interface TemplateStudioMeta {
    upiId: string;
}

export interface BusinessCardStudioModel {
    templateKey: string;
    ownerName: string;
    phoneNumber: string;
    email: string;
    website: string;
    tagline: string;
    address: string;
    gstNumber: string;
}

const DEFAULT_TEMPLATE_KEY = 'modern_minimal';
const DEFAULT_BUSINESS_CARD_TEMPLATE = BUSINESS_CARD_TEMPLATES[0]?.key ?? 'sunrise_orange';

const asRecord = (value: unknown): Record<string, unknown> => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
};

const asString = (value: unknown): string => (typeof value === 'string' ? value : '');

const normalizePrinterType = (value: unknown): PrinterType => (value === 'THERMAL' ? 'THERMAL' : 'STANDARD');

const normalizePaperSize = (value: unknown, printerType: PrinterType): PaperSize => {
    if (value === 'A4' || value === 'A5' || value === '2INCH' || value === '3INCH') {
        if (printerType === 'THERMAL' && (value === '2INCH' || value === '3INCH')) return value;
        if (printerType === 'STANDARD' && (value === 'A4' || value === 'A5')) return value;
    }
    return printerType === 'THERMAL' ? '3INCH' : 'A4';
};

export const parseTemplateStudioModel = (
    settingsInput: Record<string, unknown> | null | undefined,
    allowedTemplateKeys: readonly string[]
): TemplateStudioModel => {
    const settings = asRecord(settingsInput);
    const customization = asRecord(settings.customization);
    const print = asRecord(settings.print);

    const candidateTemplateKey = asString(customization.templateKey).trim();
    const templateKey = allowedTemplateKeys.includes(candidateTemplateKey)
        ? candidateTemplateKey
        : DEFAULT_TEMPLATE_KEY;
    const printerType = normalizePrinterType(print.printerType);

    return {
        templateKey,
        godHeaderText: asString(customization.godHeaderText),
        acknowledgmentText: asString(customization.acknowledgmentText),
        footerText: asString(customization.footerText),
        printerType,
        paperSize: normalizePaperSize(print.paperSize, printerType),
    };
};

export const parseTemplateStudioMeta = (settingsInput: Record<string, unknown> | null | undefined): TemplateStudioMeta => {
    const settings = asRecord(settingsInput);
    const payment = asRecord(settings.payment);
    return {
        upiId: asString(payment.upiId).trim(),
    };
};

export const toTemplateStudioSettingsPatch = (model: TemplateStudioModel): Record<string, unknown> => {
    const printerType = normalizePrinterType(model.printerType);
    const paperSize = normalizePaperSize(model.paperSize, printerType);

    return {
        customization: {
            templateKey: model.templateKey,
            godHeaderText: model.godHeaderText.trim(),
            acknowledgmentText: model.acknowledgmentText.trim(),
            footerText: model.footerText.trim(),
        },
        print: {
            printerType,
            paperSize,
        },
    };
};

export const equalTemplateStudioModel = (left: TemplateStudioModel, right: TemplateStudioModel): boolean => {
    return (
        left.templateKey === right.templateKey
        && left.godHeaderText === right.godHeaderText
        && left.acknowledgmentText === right.acknowledgmentText
        && left.footerText === right.footerText
        && left.printerType === right.printerType
        && left.paperSize === right.paperSize
    );
};

export const parseBusinessCardStudioModel = (
    settingsInput: Record<string, unknown> | null | undefined,
    organization: Pick<OrganizationSummary, 'phoneNumber' | 'email' | 'address' | 'gstNumber'> | null | undefined,
    user: Pick<UserProfile, 'displayName' | 'phoneNumber' | 'email' | 'gstNumber'> | null | undefined
): BusinessCardStudioModel => {
    const settings = asRecord(settingsInput);
    const businessCard = asRecord(settings.businessCard);
    const candidateTemplateKey = asString(businessCard.templateKey).trim();
    const templateKey = BUSINESS_CARD_TEMPLATES.some((entry) => entry.key === candidateTemplateKey)
        ? candidateTemplateKey
        : DEFAULT_BUSINESS_CARD_TEMPLATE;

    return {
        templateKey,
        ownerName: asString(businessCard.ownerName).trim() || user?.displayName?.trim() || user?.phoneNumber?.trim() || 'Owner',
        phoneNumber: asString(businessCard.phoneNumber).trim() || organization?.phoneNumber?.trim() || user?.phoneNumber?.trim() || '',
        email: asString(businessCard.email).trim() || organization?.email?.trim() || user?.email?.trim() || '',
        website: asString(businessCard.website).trim(),
        tagline: asString(businessCard.tagline).trim(),
        address: asString(businessCard.address).trim() || organization?.address?.trim() || '',
        gstNumber: asString(businessCard.gstNumber).trim() || organization?.gstNumber?.trim() || user?.gstNumber?.trim() || '',
    };
};

export const toBusinessCardSettingsPatch = (model: BusinessCardStudioModel): Record<string, unknown> => {
    return {
        businessCard: {
            templateKey: model.templateKey,
            ownerName: model.ownerName.trim(),
            phoneNumber: model.phoneNumber.trim(),
            email: model.email.trim(),
            website: model.website.trim(),
            tagline: model.tagline.trim(),
            address: model.address.trim(),
            gstNumber: model.gstNumber.trim(),
        },
    };
};

export const equalBusinessCardStudioModel = (
    left: BusinessCardStudioModel,
    right: BusinessCardStudioModel
): boolean => {
    return (
        left.templateKey === right.templateKey
        && left.ownerName === right.ownerName
        && left.phoneNumber === right.phoneNumber
        && left.email === right.email
        && left.website === right.website
        && left.tagline === right.tagline
        && left.address === right.address
        && left.gstNumber === right.gstNumber
    );
};
