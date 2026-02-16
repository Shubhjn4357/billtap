/* eslint-disable import/first */
import { describe, expect, it, vi } from 'vitest';

vi.mock('expo-print', () => ({
    printToFileAsync: vi.fn(),
}));

vi.mock('expo-sharing', () => ({
    shareAsync: vi.fn(),
}));

import { BUSINESS_CARD_TEMPLATES, buildBusinessCardHtml } from './businessCard';

const basePayload = {
    templateKey: BUSINESS_CARD_TEMPLATES[0].key,
    businessName: 'ACME Traders & Sons',
    ownerName: 'Shubh Jain',
    phoneNumber: '+91 98765 43210',
    email: 'hello@acme.test',
    website: 'https://acme.test',
    tagline: 'Trusted billing partner since 2016',
    address: 'Main Road, Ratlam',
    gstNumber: '23ABCDE1234F1Z5',
};

describe('buildBusinessCardHtml', () => {
    it('escapes unsafe html in user-provided fields', () => {
        const html = buildBusinessCardHtml({
            ...basePayload,
            businessName: '<script>alert(1)</script>',
        });

        expect(html).not.toContain('<script>alert(1)</script>');
        expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });

    for (const template of BUSINESS_CARD_TEMPLATES) {
        it(`renders stable markup for template: ${template.key}`, () => {
            const html = buildBusinessCardHtml({
                ...basePayload,
                templateKey: template.key,
            });

            expect(html).toMatchSnapshot();
        });
    }
});
