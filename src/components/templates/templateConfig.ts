import type { TemplateContent, TemplateType } from "@/types";

export type TemplateDraft = {
    layoutPreset: string;
    accentTone: string;
    headline: string;
    subheadline: string;
    footerNote: string;
    htmlBody: string;
    showLogo: boolean;
    showGst: boolean;
    showSignature: boolean;
    showQr: boolean;
};

export const TEMPLATE_TYPE_OPTIONS: Array<{ value: TemplateType; label: string; description: string }> = [
    { value: "invoice", label: "Invoice", description: "GST invoice, thermal, and PDF print output." },
    { value: "card", label: "Business Card", description: "Counter card, business identity, and QR sharing." },
    { value: "email", label: "Email", description: "Lifecycle message, reminder, or offer mailer." },
];

export const TEMPLATE_TONE_OPTIONS = [
    { value: "slate", label: "Slate Blue" },
    { value: "emerald", label: "Emerald" },
    { value: "amber", label: "Amber" },
    { value: "rose", label: "Rose" },
] as const;

export const TEMPLATE_PRESET_OPTIONS: Record<TemplateType, Array<{ value: string; label: string; description: string }>> = {
    invoice: [
        { value: "classic", label: "Classic GST", description: "Formal tax invoice with header and totals." },
        { value: "modern", label: "Modern Sheet", description: "Cleaner PDF-style layout with emphasis on totals." },
        { value: "thermal", label: "Thermal Slip", description: "Compact 58/80mm receipt layout." },
    ],
    card: [
        { value: "executive", label: "Executive", description: "Polished business identity with strong name treatment." },
        { value: "banking", label: "Banking", description: "PhonePe-inspired card with functional action tone." },
        { value: "minimal", label: "Minimal", description: "Quiet card focused on contact details." },
    ],
    email: [
        { value: "announcement", label: "Announcement", description: "Short platform announcement or alert." },
        { value: "invoice-summary", label: "Invoice Summary", description: "Transactional document summary." },
        { value: "renewal", label: "Renewal Prompt", description: "Subscription nudges and action CTA." },
    ],
};

const KNOWN_CONTENT_KEYS = new Set([
    "layoutPreset",
    "accentTone",
    "headline",
    "subheadline",
    "footerNote",
    "htmlBody",
    "showLogo",
    "showGst",
    "showSignature",
    "showQr",
]);

const DEFAULT_TEMPLATE_DRAFT: Record<TemplateType, TemplateDraft> = {
    invoice: {
        layoutPreset: "classic",
        accentTone: "slate",
        headline: "Tax Invoice",
        subheadline: "Business-ready GST document",
        footerNote: "Thank you for your business.",
        htmlBody: "",
        showLogo: true,
        showGst: true,
        showSignature: false,
        showQr: false,
    },
    card: {
        layoutPreset: "executive",
        accentTone: "slate",
        headline: "Business Card",
        subheadline: "Share business details at the counter",
        footerNote: "Scan to save contact or pay directly.",
        htmlBody: "",
        showLogo: true,
        showGst: false,
        showSignature: false,
        showQr: true,
    },
    email: {
        layoutPreset: "announcement",
        accentTone: "slate",
        headline: "Customer Update",
        subheadline: "Simple, direct communication from Vahi",
        footerNote: "Need help? Reply to this message.",
        htmlBody: "<p>Write your message body here.</p>",
        showLogo: true,
        showGst: false,
        showSignature: false,
        showQr: false,
    },
};

const toBoolean = (value: unknown, fallback: boolean) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
        if (value.toLowerCase() === "true") return true;
        if (value.toLowerCase() === "false") return false;
    }
    return fallback;
};

const toStringValue = (value: unknown, fallback: string) => {
    if (typeof value === "string" && value.trim().length > 0) return value;
    return fallback;
};

export const getDefaultTemplateDraft = (type: TemplateType): TemplateDraft => ({
    ...DEFAULT_TEMPLATE_DRAFT[type],
});

export const getStructuredTemplateDraft = (
    type: TemplateType,
    content?: TemplateContent | Record<string, unknown> | null
): TemplateDraft => {
    const base = getDefaultTemplateDraft(type);
    const record = content ?? {};
    return {
        layoutPreset: toStringValue(record.layoutPreset, base.layoutPreset),
        accentTone: toStringValue(record.accentTone, base.accentTone),
        headline: toStringValue(record.headline, base.headline),
        subheadline: toStringValue(record.subheadline, base.subheadline),
        footerNote: toStringValue(record.footerNote, base.footerNote),
        htmlBody: toStringValue(record.htmlBody, base.htmlBody),
        showLogo: toBoolean(record.showLogo, base.showLogo),
        showGst: toBoolean(record.showGst, base.showGst),
        showSignature: toBoolean(record.showSignature, base.showSignature),
        showQr: toBoolean(record.showQr, base.showQr),
    };
};

export const getTemplateExtraContent = (
    content?: TemplateContent | Record<string, unknown> | null
): Record<string, unknown> => {
    const record = { ...(content ?? {}) };
    for (const key of KNOWN_CONTENT_KEYS) {
        delete record[key];
    }
    return record;
};

export const buildTemplateContent = ({
    type,
    draft,
    extras,
}: {
    type: TemplateType;
    draft: TemplateDraft;
    extras: Record<string, unknown>;
}): Record<string, unknown> => {
    const structured: Record<string, unknown> = {
        layoutPreset: draft.layoutPreset,
        accentTone: draft.accentTone,
        headline: draft.headline.trim() || getDefaultTemplateDraft(type).headline,
        subheadline: draft.subheadline.trim(),
        footerNote: draft.footerNote.trim(),
        showLogo: draft.showLogo,
    };

    if (type === "invoice") {
        structured.showGst = draft.showGst;
        structured.showSignature = draft.showSignature;
    }

    if (type === "card") {
        structured.showQr = draft.showQr;
    }

    if (type === "email") {
        structured.htmlBody = draft.htmlBody.trim();
    }

    return {
        ...extras,
        ...structured,
    };
};
