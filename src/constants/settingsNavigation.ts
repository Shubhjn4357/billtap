import { MaterialCommunityIcons } from '@expo/vector-icons';

export type SettingsCategoryKey =
    | 'account'
    | 'appearance'
    | 'notifications'
    | 'billing'
    | 'inventory'
    | 'privacy'
    | 'help';

export type SettingsCategoryConfig = {
    key: SettingsCategoryKey;
    title: string;
    subtitle: string;
    route: string;
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    sections: string[];
};

export const SETTINGS_HOME_CATEGORIES: SettingsCategoryConfig[] = [
    {
        key: 'account',
        title: 'Account',
        subtitle: 'Business profile, firm behavior, backups, and subscription health.',
        route: '/(main)/settings/account',
        icon: 'account-circle-outline',
        sections: ['GENERAL', 'MULTI_FIRM', 'BACKUP_SETTINGS'],
    },
    {
        key: 'appearance',
        title: 'Appearance',
        subtitle: 'Theme, language, motion, haptics, and document look.',
        route: '/(main)/settings/appearance',
        icon: 'palette-outline',
        sections: [],
    },
    {
        key: 'notifications',
        title: 'Notifications',
        subtitle: 'Announcements, offline sync status, and business communication state.',
        route: '/(main)/settings/notifications',
        icon: 'bell-ring-outline',
        sections: [],
    },
    {
        key: 'billing',
        title: 'Billing',
        subtitle: 'GST, invoice layout rules, table behavior, and print templates.',
        route: '/(main)/settings/billing',
        icon: 'file-document-outline',
        sections: [
            'TAXES_AND_GST',
            'TRANSACTION_HEADER',
            'ITEM_TABLE',
            'TAX_DISCOUNT_TOTAL',
            'MORE_TRANSACTION_FEATURES',
        ],
    },
    {
        key: 'inventory',
        title: 'Inventory',
        subtitle: 'Item defaults, party behavior, warehouses, and stock movement setup.',
        route: '/(main)/settings/inventory',
        icon: 'package-variant-closed',
        sections: ['ITEM_SETTINGS', 'PARTY_SETTINGS', 'GODOWN_AND_STOCK_TRANSFER'],
    },
    {
        key: 'privacy',
        title: 'Privacy',
        subtitle: 'Security, biometrics, staff, and role-based access control.',
        route: '/(main)/settings/privacy',
        icon: 'shield-lock-outline',
        sections: ['SECURITY'],
    },
    {
        key: 'help',
        title: 'Help & Support',
        subtitle: 'Legal, changelog, and product support touchpoints.',
        route: '/(main)/settings/help',
        icon: 'lifebuoy',
        sections: [],
    },
];
