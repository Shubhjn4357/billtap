import { useMemo, useState } from 'react';
import {
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useQuery } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { FeatureFlag } from '../../../constants/enums';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';
import { accountingApi, cashBankApi, invoiceApi, itemApi, loanApi, partyApi } from '../../../api/endpoints';
import { useAuthStore } from '../../../store/authStore';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import {
    canAccessModule,
    canUsePos,
    hasFeatureAccess,
    type AppModule,
} from '../../../utils/accessControl';

type ScreenLink = {
    label: string;
    route: string;
    description: string;
    module?: AppModule;
    ownerOnly?: boolean;
    requiresPos?: boolean;
    requiresFeature?: FeatureFlag;
};

type ScreenSection = {
    title: string;
    items: ScreenLink[];
};

type SmartDeepLink = {
    label: string;
    subtitle: string;
    route: string;
    module: AppModule;
};

const SCREEN_SECTIONS: ScreenSection[] = [
    {
        title: 'Core Navigation',
        items: [
            { label: 'Dashboard', route: '/(main)', description: 'Main business summary', module: 'home' },
            { label: 'Billing', route: '/(main)/billing', description: 'Invoices and transactions', module: 'billing' },
            { label: 'Inventory', route: '/(main)/inventory', description: 'Items and stock', module: 'inventory' },
            { label: 'Accounts', route: '/(main)/accounts', description: 'Cash, bank, expenses, and loans', module: 'accounts' },
            { label: 'Reports', route: '/(main)/reports', description: 'GST and accounting reports', module: 'reports' },
            { label: 'Parties', route: '/(main)/parties', description: 'Customers and suppliers', module: 'parties' },
            { label: 'More', route: '/(main)/more', description: 'Settings and system modules' },
        ],
    },
    {
        title: 'Billing Flows',
        items: [
            { label: 'Create Sales Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', description: 'Tax invoice billing', module: 'billing' },
            { label: 'POS Sale', route: '/(main)/billing/pos', description: 'Fast POS billing', module: 'billing', requiresPos: true },
            { label: 'Purchase Bill', route: '/(main)/billing/purchase-bill', description: 'Supplier purchase entry', module: 'billing' },
            { label: 'Estimate / Quotation', route: '/(main)/billing/estimate', description: 'Non-posting estimate', module: 'billing' },
            { label: 'Sale Order', route: '/(main)/billing/sale-order', description: 'Sales order workflow', module: 'billing' },
            { label: 'Purchase Order', route: '/(main)/billing/purchase-order', description: 'Purchase order workflow', module: 'billing' },
            { label: 'Sale Return', route: '/(main)/billing/sale-return', description: 'Credit note / return', module: 'billing' },
            { label: 'Purchase Return', route: '/(main)/billing/purchase-return', description: 'Debit note / return', module: 'billing' },
            { label: 'Delivery Challan', route: '/(main)/billing/delivery-challan', description: 'Goods movement document', module: 'billing' },
            { label: 'Payment In', route: '/(main)/billing/payment-in', description: 'Incoming payment entry', module: 'accounts' },
            { label: 'Payment Out', route: '/(main)/billing/payment-out', description: 'Outgoing payment entry', module: 'accounts' },
        ],
    },
    {
        title: 'Inventory and Masters',
        items: [
            { label: 'Add Item', route: '/(main)/inventory/add-item', description: 'Create product/service', module: 'inventory' },
            { label: 'Item Recycle Bin', route: '/(main)/inventory/recycle-bin', description: 'Restore archived items', module: 'inventory' },
            { label: 'Item Masters', route: '/(main)/more/item-masters', description: 'Categories and units', module: 'inventory' },
            { label: 'Godowns', route: '/(main)/more/godowns', description: 'Warehouse and stock transfer', module: 'inventory', requiresFeature: FeatureFlag.MULTI_GODOWN },
            { label: 'Stock Scan', route: '/scan?target=stock', description: 'Barcode scanner route', module: 'inventory' },
        ],
    },
    {
        title: 'Accounts Operations',
        items: [
            { label: 'Cash and Bank', route: '/(main)/accounts/cash-bank', description: 'All cash/bank balances', module: 'accounts' },
            { label: 'Add Cash/Bank Account', route: '/(main)/accounts/cash-bank/add', description: 'Create account ledger', module: 'accounts' },
            { label: 'Deposit', route: '/(main)/accounts/cash-bank/deposit', description: 'Bank deposit entry', module: 'accounts' },
            { label: 'Withdraw', route: '/(main)/accounts/cash-bank/withdraw', description: 'Bank withdrawal entry', module: 'accounts' },
            { label: 'Transfer', route: '/(main)/accounts/cash-bank/transfer', description: 'Contra transfer', module: 'accounts' },
            { label: 'Expenses', route: '/(main)/accounts/expenses', description: 'Expense register', module: 'accounts' },
            { label: 'Add Expense', route: '/(main)/accounts/expenses/add', description: 'Record expense entry', module: 'accounts' },
            { label: 'Expense Recycle Bin', route: '/(main)/accounts/expenses/recycle-bin', description: 'Restore archived expenses', module: 'accounts' },
            { label: 'Loans', route: '/(main)/accounts/loans', description: 'Loan register', module: 'accounts' },
            { label: 'Add Loan', route: '/(main)/accounts/loans/add', description: 'Create loan account', module: 'accounts' },
        ],
    },
    {
        title: 'Reports',
        items: [
            { label: 'GST Summary', route: '/(main)/reports/gst-summary', description: 'Slab-wise GST report', module: 'reports' },
            { label: 'Trial Balance', route: '/(main)/reports/trial-balance', description: 'Dr/Cr integrity check', module: 'reports' },
            { label: 'Ledgers', route: '/(main)/reports/ledgers', description: 'Ledger list and drilldown', module: 'reports' },
            { label: 'Profit and Loss', route: '/(main)/more/reports/pnl', description: 'Income vs expense report', module: 'reports' },
            { label: 'GSTR-1', route: '/(main)/more/reports/gstr1', description: 'Outward supplies', module: 'reports' },
            { label: 'GSTR-3B', route: '/(main)/more/reports/gstr3b', description: 'Monthly GST summary', module: 'reports' },
        ],
    },
    {
        title: 'Control and Settings',
        items: [
            { label: 'Settings', route: '/(main)/more/settings', description: 'All settings sections', module: 'settings' },
            { label: 'Staff', route: '/(main)/more/staff', description: 'Invite/manage team', module: 'staff' },
            { label: 'Role Access', route: '/(main)/more/role-access', description: 'Role/module/action permissions', module: 'settings', ownerOnly: true },
            { label: 'Operations', route: '/(main)/more/operations', description: 'Utility tools', module: 'operations' },
            { label: 'Announcements', route: '/(main)/more/announcements', description: 'Business notifications', module: 'operations' },
            { label: 'Sync Diagnostics', route: '/(main)/more/sync', description: 'Offline sync queue and status' },
            { label: 'Thermal Printers', route: '/(main)/more/thermal-printers', description: 'Printer profiles', module: 'settings' },
            { label: 'Subscription', route: '/(main)/more/subscription', description: 'Plan and limits' },
        ],
    },
    {
        title: 'Legal',
        items: [
            { label: 'Legal Center', route: '/legal', description: 'All legal documents' },
            { label: 'Terms of Service', route: '/legal/terms', description: 'Terms and conditions' },
            { label: 'Privacy Policy', route: '/legal/privacy', description: 'Data privacy statement' },
            { label: 'Changelog', route: '/legal/changelog', description: 'Version history' },
            { label: 'About', route: '/legal/about', description: 'App information' },
        ],
    },
];

export default function ScreenDirectoryScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');

    const [search, setSearch] = useState('');
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const normalizedSearch = search.trim().toLowerCase();

    const { data: invoiceList } = useQuery({
        queryKey: ['screen-directory', 'latest-invoice'],
        queryFn: () => invoiceApi.list({ limit: 1 }),
        staleTime: 60_000,
    });

    const { data: partyList } = useQuery({
        queryKey: ['screen-directory', 'latest-party'],
        queryFn: () => partyApi.list({ limit: 1 }),
        staleTime: 60_000,
    });

    const { data: itemList } = useQuery({
        queryKey: ['screen-directory', 'latest-item'],
        queryFn: () => itemApi.list({ limit: 1 }),
        staleTime: 60_000,
    });

    const { data: loanList } = useQuery({
        queryKey: ['screen-directory', 'latest-loan'],
        queryFn: () => loanApi.list(),
        staleTime: 60_000,
    });

    const { data: accountList } = useQuery({
        queryKey: ['screen-directory', 'latest-cash-bank'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 60_000,
    });

    const { data: ledgerList } = useQuery({
        queryKey: ['screen-directory', 'latest-ledger'],
        queryFn: () => accountingApi.getLedgers(),
        staleTime: 60_000,
    });

    const smartLinks = useMemo(() => {
        const latestInvoice = invoiceList?.data?.[0];
        const latestParty = partyList?.data?.[0];
        const latestItem = itemList?.items?.[0];
        const latestLoan = loanList?.data?.[0];
        const latestAccount = accountList?.data?.[0];
        const latestLedger = ledgerList?.data?.data?.[0];

        const links: SmartDeepLink[] = [
            {
                label: 'Latest Invoice Detail',
                subtitle: latestInvoice?.invoiceNumber
                    ? `Open ${latestInvoice.invoiceNumber}`
                    : 'No invoice found. Open create invoice.',
                route: latestInvoice
                    ? `/(main)/billing/${latestInvoice.id}`
                    : '/(main)/billing/create?type=TAX_INVOICE',
                module: 'billing',
            },
            {
                label: 'Latest Party Detail',
                subtitle: latestParty?.name
                    ? `Open ${latestParty.name}`
                    : 'No party found. Open add party.',
                route: latestParty
                    ? `/(main)/parties/${latestParty.id}`
                    : '/(main)/parties/add',
                module: 'parties',
            },
            {
                label: 'Latest Item Detail',
                subtitle: latestItem?.name
                    ? `Open ${latestItem.name}`
                    : 'No item found. Open add item.',
                route: latestItem
                    ? `/(main)/inventory/${latestItem.id}`
                    : '/(main)/inventory/add-item',
                module: 'inventory',
            },
            {
                label: 'Latest Loan Detail',
                subtitle: latestLoan?.lenderBorrowerName
                    ? `Open ${latestLoan.lenderBorrowerName}`
                    : 'No loan found. Open add loan.',
                route: latestLoan
                    ? `/(main)/accounts/loans/${latestLoan.id}`
                    : '/(main)/accounts/loans/add',
                module: 'accounts',
            },
            {
                label: 'Latest Cash/Bank Account',
                subtitle: latestAccount?.name
                    ? `Open ${latestAccount.name}`
                    : 'No account found. Open add cash/bank account.',
                route: latestAccount
                    ? `/(main)/accounts/cash-bank/${latestAccount.id}`
                    : '/(main)/accounts/cash-bank/add',
                module: 'accounts',
            },
            {
                label: 'Latest Ledger Detail',
                subtitle: latestLedger?.name
                    ? `Open ${latestLedger.name}`
                    : 'No ledger found. Open ledger list.',
                route: latestLedger
                    ? `/(main)/reports/ledgers/${latestLedger.id}`
                    : '/(main)/reports/ledgers',
                module: 'reports',
            },
        ];

        return links.filter((link) => {
            if (!canAccessModule(role, link.module, subscription)) return false;
            if (!normalizedSearch) return true;
            return `${link.label} ${link.subtitle}`.toLowerCase().includes(normalizedSearch);
        });
    }, [
        accountList?.data,
        invoiceList?.data,
        itemList?.items,
        ledgerList?.data?.data,
        loanList?.data,
        normalizedSearch,
        partyList?.data,
        role,
        subscription,
    ]);

    const sections = useMemo(() => {
        return SCREEN_SECTIONS.map((section) => {
            const visibleItems = section.items.filter((item) => {
                if (item.ownerOnly && role !== 'owner') return false;
                if (item.module && !canAccessModule(role, item.module, subscription)) return false;
                if (item.requiresPos && !canUsePos(subscription)) return false;
                if (item.requiresFeature && !hasFeatureAccess(subscription, item.requiresFeature)) return false;
                if (!normalizedSearch) return true;

                const haystack = `${item.label} ${item.description}`.toLowerCase();
                return haystack.includes(normalizedSearch);
            });

            return { title: section.title, items: visibleItems };
        }).filter((section) => section.items.length > 0);
    }, [normalizedSearch, role, subscription]);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Screen Directory"
                subtitle="Quick navigation across modules"
                onBackPress={smartBack}
            />

            <View style={s.searchWrap}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search screens..."
                    showScanAction={false}
                />
            </View>

            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
                <View style={s.section}>
                    <Text style={s.sectionTitle}>{'SMART DEEP LINKS'}</Text>
                    <View style={[s.group, { backgroundColor: colors.card }]}>
                        {smartLinks.map((link, index) => (
                            <Pressable
                                key={link.label}
                                style={({ pressed }) => [
                                    s.item,
                                    index < smartLinks.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                    pressed && { backgroundColor: colors.backgroundSelected },
                                ]}
                                onPress={() => router.push(link.route as Parameters<typeof router.push>[0])}
                            >
                                    <View style={s.itemTextWrap}>
                                        <Text style={s.itemLabel}>{link.label}</Text>
                                        <Text style={s.itemDescription}>{link.subtitle}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                                </Pressable>
                            ))}
                        {smartLinks.length === 0 ? (
                            <View style={s.emptyInline}>
                                <Text style={s.itemDescription}>No deep links available for current search or plan.</Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                {sections.map((section) => (
                    <View key={section.title} style={s.section}>
                        <Text style={s.sectionTitle}>{section.title.toUpperCase()}</Text>
                        <View style={[s.group, { backgroundColor: colors.card }]}>
                            {section.items.map((item, index) => (
                                <Pressable
                                    key={`${section.title}-${item.label}`}
                                    style={({ pressed }) => [
                                        s.item,
                                        index < section.items.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                        pressed && { backgroundColor: colors.backgroundSelected },
                                    ]}
                                    onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                                >
                                    <View style={s.itemTextWrap}>
                                        <Text style={s.itemLabel}>{item.label}</Text>
                                        <Text style={s.itemDescription}>{item.description}</Text>
                                    </View>
                                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.textSecondary} />
                                </Pressable>
                            ))}
                        </View>
                    </View>
                ))}

                {sections.length === 0 ? (
                    <View style={s.emptyWrap}>
                        <Text style={s.emptyText}>No screens match your search.</Text>
                    </View>
                ) : null}

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    searchWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    content: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, gap: Spacing.md },
    section: { gap: Spacing.sm },
    sectionTitle: {
        color: colors.textSecondary,
        fontSize: Typography.caption.size,
        fontWeight: '700',
        letterSpacing: 0.7,
    },
    group: { borderRadius: Radius.card, overflow: 'hidden' },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    itemTextWrap: { flex: 1 },
    itemLabel: { color: colors.text, fontWeight: '700', fontSize: Typography.body.size },
    itemDescription: { color: colors.textSecondary, fontSize: Typography.caption.size, marginTop: 2 },
    emptyInline: {
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xxl,
    },
    emptyText: { color: colors.textSecondary, fontSize: Typography.body.size },
});
