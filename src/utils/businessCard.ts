import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

export interface BusinessCardTemplate {
    key: string;
    name: string;
    background: string;
    foreground: string;
    accent: string;
    muted?: string;
}

export const BUSINESS_CARD_TEMPLATES: BusinessCardTemplate[] = [
    { key: 'sunrise_orange', name: 'Sunrise Orange', background: '#FFF4EB', foreground: '#47280C', accent: '#EA580C', muted: '#9A3412' },
    { key: 'ocean_blue', name: 'Ocean Blue', background: '#EEF4FF', foreground: '#0F2B52', accent: '#1D4ED8', muted: '#1E40AF' },
    { key: 'mint_fresh', name: 'Mint Fresh', background: '#ECFDF5', foreground: '#064E3B', accent: '#059669', muted: '#065F46' },
    { key: 'charcoal_clean', name: 'Charcoal Clean', background: '#F4F4F5', foreground: '#18181B', accent: '#3F3F46', muted: '#52525B' },
    { key: 'ruby_classic', name: 'Ruby Classic', background: '#FFF1F2', foreground: '#4A0817', accent: '#DB2777', muted: '#9D174D' },
    { key: 'amber_gold', name: 'Amber Gold', background: '#FFF8E8', foreground: '#3D2A0D', accent: '#B45309', muted: '#92400E' },
    { key: 'forest_pro', name: 'Forest Pro', background: '#EAFBF0', foreground: '#0B3B2E', accent: '#0F766E', muted: '#115E59' },
    { key: 'indigo_modern', name: 'Indigo Modern', background: '#EEF2FF', foreground: '#1E1B4B', accent: '#4F46E5', muted: '#4338CA' },
    { key: 'slate_business', name: 'Slate Business', background: '#F8FAFC', foreground: '#0F172A', accent: '#334155', muted: '#475569' },
    { key: 'peach_soft', name: 'Peach Soft', background: '#FFF7ED', foreground: '#7C2D12', accent: '#EA580C', muted: '#9A3412' },
    { key: 'teal_minimal', name: 'Teal Minimal', background: '#F0FDFA', foreground: '#134E4A', accent: '#0F766E', muted: '#0F766E' },
    { key: 'rose_modern', name: 'Rose Modern', background: '#FFF1F5', foreground: '#831843', accent: '#DB2777', muted: '#9D174D' },
];

export interface BusinessCardPayload {
    templateKey: string;
    businessName: string;
    ownerName: string;
    phoneNumber: string;
    email: string;
    website: string;
    tagline: string;
    address: string;
    gstNumber: string;
}

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');

const pickTemplate = (templateKey: string): BusinessCardTemplate => {
    return BUSINESS_CARD_TEMPLATES.find((entry) => entry.key === templateKey) ?? BUSINESS_CARD_TEMPLATES[0];
};

const buildInitials = (value: string): string => {
    const tokens = value
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2);
    if (tokens.length === 0) return 'BS';
    return tokens.map((token) => token[0]?.toUpperCase() ?? '').join('');
};

export const buildBusinessCardHtml = (payload: BusinessCardPayload): string => {
    const template = pickTemplate(payload.templateKey);
    const businessName = escapeHtml(payload.businessName || 'Business Name');
    const ownerName = escapeHtml(payload.ownerName || 'Owner');
    const phone = escapeHtml(payload.phoneNumber || '-');
    const email = escapeHtml(payload.email || '-');
    const website = escapeHtml(payload.website || '-');
    const address = escapeHtml(payload.address || '-');
    const tagline = escapeHtml(payload.tagline || '');
    const gstNumber = escapeHtml(payload.gstNumber || '');
    const initials = escapeHtml(buildInitials(payload.businessName || 'Business'));
    const muted = template.muted ?? template.accent;

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 24px;
        background: #f5f7fb;
        font-family: "Segoe UI", Arial, sans-serif;
      }
      .page {
        max-width: 760px;
        margin: 0 auto;
      }
      .cards-row {
        display: flex;
        gap: 14px;
        flex-wrap: wrap;
      }
      .card {
        width: 340px;
        min-height: 190px;
        border: 2px solid ${template.accent};
        border-radius: 14px;
        background: ${template.background};
        color: ${template.foreground};
        box-sizing: border-box;
        padding: 14px;
      }
      .front-top {
        display: flex;
        gap: 10px;
        align-items: flex-start;
      }
      .badge {
        width: 40px;
        height: 40px;
        border-radius: 10px;
        border: 1px solid ${template.accent};
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 13px;
        font-weight: 700;
        color: ${template.accent};
      }
      .title {
        font-size: 21px;
        font-weight: 800;
        line-height: 1.1;
      }
      .owner {
        margin-top: 4px;
        font-size: 13px;
        font-weight: 700;
        color: ${muted};
      }
      .tagline {
        margin-top: 8px;
        font-size: 11px;
      }
      .detail-row {
        font-size: 11px;
        line-height: 1.45;
        color: ${template.foreground};
      }
      .details {
        margin-top: 8px;
        display: grid;
        gap: 2px;
      }
      .back {
        background: ${template.accent};
        border-color: ${template.foreground};
        color: #ffffff;
      }
      .back-head {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        gap: 8px;
      }
      .back-title {
        font-size: 18px;
        font-weight: 800;
        line-height: 1.2;
      }
      .qr {
        width: 52px;
        height: 52px;
        border-radius: 8px;
        background: #ffffff;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .qr::before {
        content: "";
        width: 24px;
        height: 24px;
        border: 2px solid #101828;
        border-radius: 4px;
      }
      .address {
        margin-top: 8px;
        font-size: 11px;
        line-height: 1.4;
        opacity: 0.95;
      }
    </style>
  </head>
  <body>
    <div class="page">
      <div class="cards-row">
        <div class="card">
          <div class="front-top">
            <div class="badge">${initials}</div>
            <div>
              <div class="title">${businessName}</div>
              <div class="owner">${ownerName}</div>
            </div>
          </div>
          ${tagline ? `<div class="tagline">${tagline}</div>` : ''}
          <div class="details">
            <div class="detail-row">${phone}</div>
            <div class="detail-row">${email}</div>
            <div class="detail-row">${website}</div>
          </div>
        </div>

        <div class="card back">
          <div class="back-head">
            <div class="back-title">${businessName}</div>
            <div class="qr"></div>
          </div>
          <div class="address">${address}</div>
          ${gstNumber ? `<div class="address">GSTIN: ${gstNumber}</div>` : ''}
        </div>
      </div>
    </div>
  </body>
</html>`;
};

export const shareBusinessCardPdf = async (payload: BusinessCardPayload): Promise<void> => {
    const html = buildBusinessCardHtml(payload);
    const { uri } = await Print.printToFileAsync({
        html,
        width: 612,
        height: 792,
        base64: false,
    });
    await shareAsync(uri, {
        dialogTitle: 'Share Business Card',
        mimeType: 'application/pdf',
        UTI: 'com.adobe.pdf',
    });
};
