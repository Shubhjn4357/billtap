import { Platform, Share } from 'react-native';
import { printAsync, printToFileAsync } from 'expo-print';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

type BusinessCardDocumentInput = {
    businessName: string;
    legalName?: string | null;
    ownerName?: string | null;
    phone?: string | null;
    email?: string | null;
    gstin?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    shareTitle?: string;
};

const escapeHtml = (value: string) =>
    value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');

const compactLines = (values: (string | null | undefined)[]) =>
    values.map((value) => String(value ?? '').trim()).filter(Boolean);

export const createBusinessCardDocumentHtml = ({
    businessName,
    legalName,
    ownerName,
    phone,
    email,
    gstin,
    address,
    city,
    state,
}: BusinessCardDocumentInput) => {
    const contactLines = compactLines([phone, email, gstin ? `GSTIN ${gstin}` : null]);
    const addressLines = compactLines([address, [city, state].filter(Boolean).join(', ')]);

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(businessName)}</title>
    <style>
        :root {
            color-scheme: light;
            --bg: #eff4fb;
            --card: #ffffff;
            --ink: #152235;
            --muted: #617189;
            --brand: #2f62dd;
            --brand-soft: rgba(47, 98, 221, 0.10);
            --line: #d7e0ee;
            --accent: #1f8d5d;
        }
        * { box-sizing: border-box; }
        body {
            margin: 0;
            min-height: 100vh;
            display: grid;
            place-items: center;
            background:
                radial-gradient(circle at top right, rgba(47, 98, 221, 0.14), transparent 32%),
                linear-gradient(180deg, #f4f7fc 0%, #eaf0f8 100%);
            color: var(--ink);
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
            padding: 24px;
        }
        .sheet {
            width: 100%;
            max-width: 760px;
            display: grid;
            gap: 18px;
        }
        .meta {
            color: var(--muted);
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .card {
            position: relative;
            overflow: hidden;
            background: var(--card);
            border: 1px solid var(--line);
            border-radius: 32px;
            padding: 28px;
            min-height: 360px;
            box-shadow: 0 24px 80px rgba(18, 31, 51, 0.08);
        }
        .orb {
            position: absolute;
            width: 240px;
            height: 240px;
            border-radius: 999px;
            top: -68px;
            right: -44px;
            background: radial-gradient(circle, rgba(47, 98, 221, 0.18) 0%, rgba(47, 98, 221, 0) 72%);
        }
        .top {
            display: flex;
            justify-content: space-between;
            gap: 20px;
            align-items: flex-start;
        }
        .eyebrow {
            display: inline-flex;
            align-items: center;
            padding: 8px 12px;
            border-radius: 999px;
            background: var(--brand-soft);
            color: var(--brand);
            font-size: 11px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
            margin-bottom: 14px;
        }
        h1 {
            margin: 0;
            font-size: 34px;
            line-height: 1.05;
            letter-spacing: -0.03em;
        }
        .legal {
            margin-top: 8px;
            color: var(--muted);
            font-size: 14px;
            font-weight: 600;
        }
        .owner {
            margin-top: 18px;
            color: var(--accent);
            font-size: 12px;
            font-weight: 800;
            letter-spacing: 0.08em;
            text-transform: uppercase;
        }
        .contact {
            margin-top: 22px;
            display: grid;
            gap: 8px;
        }
        .contact-line {
            color: var(--ink);
            font-size: 15px;
            font-weight: 600;
        }
        .address {
            margin-top: 16px;
            display: grid;
            gap: 6px;
            color: var(--muted);
            font-size: 13px;
            line-height: 1.5;
        }
        .qr {
            width: 72px;
            height: 72px;
            border-radius: 18px;
            border: 1px solid rgba(31, 141, 93, 0.24);
            display: grid;
            place-items: center;
            color: var(--accent);
            font-size: 13px;
            font-weight: 800;
            background: rgba(31, 141, 93, 0.08);
        }
        .footer {
            margin-top: 28px;
            display: flex;
            justify-content: space-between;
            gap: 16px;
            align-items: flex-end;
        }
        .hint {
            color: var(--muted);
            font-size: 12px;
            line-height: 1.6;
            max-width: 320px;
        }
    </style>
</head>
<body>
    <main class="sheet">
        <div class="meta">Business card</div>
        <section class="card">
            <div class="orb"></div>
            <div class="top">
                <div>
                    <div class="eyebrow">Billing • GST • Business</div>
                    <h1>${escapeHtml(businessName)}</h1>
                    ${legalName ? `<div class="legal">${escapeHtml(legalName)}</div>` : ''}
                    ${ownerName ? `<div class="owner">${escapeHtml(ownerName)}</div>` : ''}
                    <div class="contact">
                        ${contactLines.map((line) => `<div class="contact-line">${escapeHtml(line)}</div>`).join('')}
                    </div>
                    ${addressLines.length > 0 ? `
                        <div class="address">
                            ${addressLines.map((line) => `<div>${escapeHtml(line)}</div>`).join('')}
                        </div>
                    ` : ''}
                </div>
                <div class="qr">SCAN</div>
            </div>
            <div class="footer">
                <div class="hint">
                    Share this card to help customers save your billing contact and GST identity quickly.
                </div>
            </div>
        </section>
    </main>
</body>
</html>`;
};

export const shareBusinessCardDocument = async ({
    shareTitle,
    ...input
}: BusinessCardDocumentInput) => {
    const html = createBusinessCardDocumentHtml(input);
    const resolvedTitle = shareTitle ?? `${input.businessName} Business Card`;

    if (Platform.OS === 'web') {
        await printAsync({ html });
        return { mode: 'print' as const };
    }

    const { uri } = await printToFileAsync({ html });
    if (await isAvailableAsync()) {
        await shareAsync(uri, {
            UTI: '.pdf',
            mimeType: 'application/pdf',
            dialogTitle: resolvedTitle,
        });
        return { mode: 'share' as const, uri };
    }

    await Share.share({
        title: resolvedTitle,
        message: `${resolvedTitle}\n${uri}`,
        url: uri,
    });
    return { mode: 'share' as const, uri };
};
