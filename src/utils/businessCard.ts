import * as Print from 'expo-print';
import { shareAsync } from 'expo-sharing';

export interface BusinessCardTemplate {
    key: string;
    name: string;
    background: string;
    foreground: string;
    accent: string;
}

export const BUSINESS_CARD_TEMPLATES: BusinessCardTemplate[] = [
    { key: 'sunrise_orange', name: 'Sunrise Orange', background: '#fff2e8', foreground: '#4a2207', accent: '#f97316' },
    { key: 'ocean_blue', name: 'Ocean Blue', background: '#e8f2ff', foreground: '#0c2f4f', accent: '#2563eb' },
    { key: 'mint_fresh', name: 'Mint Fresh', background: '#e8fff7', foreground: '#114737', accent: '#10b981' },
    { key: 'charcoal_clean', name: 'Charcoal Clean', background: '#f4f4f5', foreground: '#27272a', accent: '#52525b' },
    { key: 'ruby_classic', name: 'Ruby Classic', background: '#fff1f2', foreground: '#4a0817', accent: '#e11d48' },
    { key: 'amber_gold', name: 'Amber Gold', background: '#fffbeb', foreground: '#4a3410', accent: '#d97706' },
    { key: 'forest_pro', name: 'Forest Pro', background: '#ecfdf5', foreground: '#064e3b', accent: '#047857' },
    { key: 'indigo_modern', name: 'Indigo Modern', background: '#eef2ff', foreground: '#1e1b4b', accent: '#4f46e5' },
    { key: 'slate_business', name: 'Slate Business', background: '#f8fafc', foreground: '#1e293b', accent: '#334155' },
    { key: 'peach_soft', name: 'Peach Soft', background: '#fff7ed', foreground: '#7c2d12', accent: '#ea580c' },
    { key: 'teal_minimal', name: 'Teal Minimal', background: '#f0fdfa', foreground: '#134e4a', accent: '#0f766e' },
    { key: 'rose_modern', name: 'Rose Modern', background: '#fff1f5', foreground: '#831843', accent: '#db2777' },
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

    return `
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      body {
        margin: 0;
        padding: 24px;
        font-family: Arial, sans-serif;
      }
      .card {
        width: 340px;
        height: 190px;
        border: 2px solid ${template.accent};
        border-radius: 14px;
        background: ${template.background};
        color: ${template.foreground};
        box-sizing: border-box;
        padding: 16px;
      }
      .title {
        font-size: 22px;
        font-weight: 700;
        line-height: 1.1;
      }
      .owner {
        margin-top: 6px;
        font-size: 14px;
        font-weight: 600;
        color: ${template.accent};
      }
      .tagline {
        margin-top: 6px;
        font-size: 11px;
      }
      .row {
        margin-top: 8px;
        font-size: 11px;
      }
      .gst {
        margin-top: 8px;
        font-size: 10px;
        opacity: 0.9;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="title">${businessName}</div>
      <div class="owner">${ownerName}</div>
      ${tagline ? `<div class="tagline">${tagline}</div>` : ''}
      <div class="row">Phone: ${phone}</div>
      <div class="row">Email: ${email}</div>
      <div class="row">Website: ${website}</div>
      <div class="row">Address: ${address}</div>
      ${gstNumber ? `<div class="gst">GSTIN: ${gstNumber}</div>` : ''}
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
