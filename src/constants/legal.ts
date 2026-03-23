export type LegalSection = {
    title: string;
    points: string[];
};

export const TERMS_LAST_UPDATED = 'February 28, 2026';
export const PRIVACY_LAST_UPDATED = 'February 28, 2026';

export const TERMS_SECTIONS: LegalSection[] = [
    {
        title: 'Acceptance of Terms',
        points: [
            'By using Vahi, you agree to these Terms of Service.',
            'If you do not agree, do not use the app.',
            'You must be legally capable of entering a binding agreement.',
        ],
    },
    {
        title: 'Use of Service',
        points: [
            'Vahi provides billing, inventory, accounting, and reporting tools.',
            'You are responsible for data entered by you and your team.',
            'You must not use Vahi for unlawful, fraudulent, or abusive purposes.',
        ],
    },
    {
        title: 'Accounts and Security',
        points: [
            'You are responsible for safeguarding your login and device access.',
            'You must notify us if you suspect unauthorized access.',
            'We may suspend access for security, abuse, or legal reasons.',
        ],
    },
    {
        title: 'Data and Compliance',
        points: [
            'You remain owner of your business data.',
            'You are responsible for tax filings, statutory compliance, and legal accuracy of documents.',
            'Vahi is a software platform and not a substitute for legal, tax, or accounting advice.',
        ],
    },
    {
        title: 'Subscriptions and Billing',
        points: [
            'Paid features depend on your active subscription plan.',
            'Feature limits and usage caps are enforced as per selected plan.',
            'Failure to renew may move account access to restricted/read-only mode as configured.',
        ],
    },
    {
        title: 'Service Availability',
        points: [
            'We strive for reliable service but do not guarantee uninterrupted availability.',
            'Maintenance, outages, and third-party service issues can affect access.',
            'You should maintain backups of critical business records.',
        ],
    },
    {
        title: 'Limitation of Liability',
        points: [
            'To the maximum extent permitted by law, Vahi is not liable for indirect or consequential losses.',
            'Total liability is limited to amounts paid for service in the preceding subscription term.',
            'This does not limit liabilities that cannot legally be excluded.',
        ],
    },
    {
        title: 'Changes to Terms',
        points: [
            'We may update these terms from time to time.',
            'Continued use after updates means acceptance of revised terms.',
            'Material changes will be reflected in the in-app legal pages with updated date.',
        ],
    },
];

export const PRIVACY_SECTIONS: LegalSection[] = [
    {
        title: 'What We Collect',
        points: [
            'Account details: name, email, and authentication identifiers.',
            'Business data you provide: items, parties, invoices, expenses, and settings.',
            'Operational metadata: device/platform details and usage diagnostics.',
        ],
    },
    {
        title: 'How We Use Data',
        points: [
            'To provide billing, accounting, inventory, reporting, and sync functionality.',
            'To secure accounts, prevent abuse, and troubleshoot issues.',
            'To improve product quality and reliability.',
        ],
    },
    {
        title: 'Data Sharing',
        points: [
            'We do not sell your personal or business data.',
            'Data may be processed by infrastructure providers required to operate the service.',
            'Data may be disclosed only when legally required.',
        ],
    },
    {
        title: 'Security',
        points: [
            'Data is transmitted over encrypted channels.',
            'Access controls are applied for authenticated routes and admin workflows.',
            'You should protect device access with passcode/biometric settings where possible.',
        ],
    },
    {
        title: 'Retention and Deletion',
        points: [
            'Data is retained while your account is active and as needed for legal/compliance obligations.',
            'You may request deletion of account data subject to mandatory legal retention.',
            'Backups may persist for a limited disaster-recovery period before expiry.',
        ],
    },
    {
        title: 'Your Choices',
        points: [
            'You can review and update business profile data in app settings.',
            'You may control notification preferences where available.',
            'You may request account closure by contacting support.',
        ],
    },
    {
        title: 'Policy Updates',
        points: [
            'This policy can be updated as our features and legal obligations evolve.',
            'Updated policy date will be shown in this screen.',
            'Continued use indicates acknowledgement of updated policy.',
        ],
    },
];

export type ChangelogEntry = {
    version: string;
    date: string;
    highlights: string[];
};

export const CHANGELOG_ENTRIES: ChangelogEntry[] = [
    {
        version: '4.2.0',
        date: '2026-03-23',
        highlights: [
            'Reworked the app with the minimal shell, cleaner navigation, and calmer dashboard and utility layouts.',
            'Fixed subscription gating, invoice draft preservation, GST toggles, POS stock ceiling checks, and module alignment across app, server, and admin.',
            'Removed SMS and WhatsApp as active product channels and kept notifications plus announcements as the supported surface.',
            'Added admin follow-up for banner announcements with route-targeted CTA selection, scheduling, and live in-app redirect handling.',
        ],
    },
    {
        version: '4.1.0',
        date: '2026-02-28',
        highlights: [
            'Expanded accounting modules: cash and bank flows, loan workflows, and godown support.',
            'Improved POS and billing flows with scan integration and invoice sharing enhancements.',
            'Added API contract verification and stronger CI/CD verification pipeline.',
            'Added in-app legal center with Terms, Privacy Policy, App Info, and Changelog screens.',
        ],
    },
    {
        version: '4.0.0',
        date: '2026-02-20',
        highlights: [
            'New Vahi React Native app foundation with modern navigation and typed API layer.',
            'Cloudflare Worker + Neon backend integration for core business modules.',
            'Subscription model and feature-flag controlled capabilities introduced.',
        ],
    },
];
