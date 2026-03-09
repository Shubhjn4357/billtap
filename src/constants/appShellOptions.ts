import { MaterialCommunityIcons } from '@expo/vector-icons';

type AppShellIconName = keyof typeof MaterialCommunityIcons.glyphMap;

export const LOGIN_FEATURES: { icon: AppShellIconName; text: string }[] = [
    { icon: 'file-document-check-outline', text: 'GST compliant invoices in seconds' },
    { icon: 'warehouse', text: 'Inventory tracking with low-stock alerts' },
    { icon: 'chart-line', text: 'Profit and GST reports on the go' },
    { icon: 'cloud-sync-outline', text: 'Sync across devices and web' },
] as const;

export const LEGAL_CENTER_LINKS = [
    {
        title: 'Terms of Service',
        description: 'Usage rules, subscriptions, billing, and legal conditions.',
        route: '/legal/terms',
    },
    {
        title: 'Privacy Policy',
        description: 'How account and business data is collected and used.',
        route: '/legal/privacy',
    },
    {
        title: 'Changelog',
        description: 'Version history and major feature updates.',
        route: '/legal/changelog',
    },
    {
        title: 'About Vahi',
        description: 'App identity, build version, and support details.',
        route: '/legal/about',
    },
] as const;
