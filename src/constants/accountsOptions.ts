import type { UtilityTone } from './utilityNavigation';

type IconName = string;

export type AccountsHubLink = {
    title: string;
    subtitle: string;
    route: string;
    icon: IconName;
    tone: UtilityTone;
};

export const ACCOUNTS_HUB_LINKS: AccountsHubLink[] = [
    {
        title: 'Trial Balance',
        subtitle: 'Debit/credit integrity check',
        route: '/(main)/reports/trial-balance',
        icon: 'scale-balance',
        tone: 'warning',
    },
    {
        title: 'Balance Sheet',
        subtitle: 'Assets, liability and equity view',
        route: '/(main)/reports/balance-sheet',
        icon: 'safe-square-outline',
        tone: 'success',
    },
    {
        title: 'Ledgers',
        subtitle: 'Account-wise drilldown',
        route: '/(main)/reports/ledgers',
        icon: 'book-open-page-variant-outline',
        tone: 'info',
    },
    {
        title: 'GST Summary',
        subtitle: 'Tax position and slabs',
        route: '/(main)/reports/gst-summary',
        icon: 'bank-outline',
        tone: 'success',
    },
];
