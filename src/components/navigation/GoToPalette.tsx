import { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FeatureFlag } from '../../constants/enums';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../constants/theme';
import { accountingApi, cashBankApi, invoiceApi, itemApi, loanApi, partyApi } from '../../api/endpoints';
import { useAuthStore } from '../../store/authStore';
import {
    canAccessModule,
    canUsePos,
    hasFeatureAccess,
    type AppModule,
} from '../../utils/accessControl';

type RouteEntry = {
    label: string;
    route: string;
    description: string;
    module?: AppModule;
    ownerOnly?: boolean;
    requiresPos?: boolean;
    requiresFeature?: FeatureFlag;
};

type SmartRouteEntry = {
    label: string;
    subtitle: string;
    route: string;
    module: AppModule;
};

const ROUTES: RouteEntry[] = [
    { label: 'Dashboard', route: '/(main)', description: 'Home summary', module: 'home' },
    { label: 'Billing', route: '/(main)/billing', description: 'Sales and purchases', module: 'billing' },
    { label: 'Create Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', description: 'New tax invoice', module: 'billing' },
    { label: 'POS Sale', route: '/(main)/billing/pos', description: 'Point of sale billing', module: 'billing', requiresPos: true },
    { label: 'Inventory', route: '/(main)/inventory', description: 'Items and stock', module: 'inventory' },
    { label: 'Add Item', route: '/(main)/inventory/add-item', description: 'Create inventory item', module: 'inventory' },
    { label: 'Parties', route: '/(main)/parties', description: 'Customers and suppliers', module: 'parties' },
    { label: 'Add Party', route: '/(main)/parties/add', description: 'Create customer/supplier', module: 'parties' },
    { label: 'Accounts', route: '/(main)/accounts', description: 'Cash, bank, loans, expenses', module: 'accounts' },
    { label: 'Cash and Bank', route: '/(main)/accounts/cash-bank', description: 'Cash/bank ledger', module: 'accounts' },
    { label: 'Expenses', route: '/(main)/accounts/expenses', description: 'Expense entries', module: 'accounts' },
    { label: 'Loans', route: '/(main)/accounts/loans', description: 'Loan management', module: 'accounts' },
    { label: 'Reports', route: '/(main)/reports', description: 'Business reports', module: 'reports' },
    { label: 'Trial Balance', route: '/(main)/reports/trial-balance', description: 'Debit/credit balancing', module: 'reports' },
    { label: 'Ledgers', route: '/(main)/reports/ledgers', description: 'Account ledgers', module: 'reports' },
    { label: 'GST Summary', route: '/(main)/reports/gst-summary', description: 'GST slab report', module: 'reports' },
    { label: 'More', route: '/(main)/more', description: 'Utilities and controls' },
    { label: 'Settings', route: '/(main)/more/settings', description: 'Business settings', module: 'settings' },
    { label: 'Staff', route: '/(main)/more/staff', description: 'Team management', module: 'staff' },
    { label: 'Role Access', route: '/(main)/more/role-access', description: 'Role based controls', module: 'settings', ownerOnly: true },
    { label: 'Godowns', route: '/(main)/more/godowns', description: 'Warehouse management', module: 'inventory', requiresFeature: FeatureFlag.MULTI_GODOWN },
    { label: 'Subscription', route: '/(main)/more/subscription', description: 'Plan and limits' },
    { label: 'Screen Directory', route: '/(main)/more/screen-directory', description: 'Full route explorer' },
    { label: 'Legal Center', route: '/legal', description: 'Terms/privacy/changelog' },
    { label: 'Stock Scanner', route: '/scan?target=stock', description: 'Barcode scanner', module: 'inventory' },
];

const listeners = new Set<() => void>();
export const openGoToPalette = () => {
    listeners.forEach((listener) => listener());
};

export function GoToPalette() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const insets = useSafeAreaInsets();
    const s = styles(colors);

    const [visible, setVisible] = useState(false);
    const [query, setQuery] = useState('');
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const normalizedQuery = query.trim().toLowerCase();

    const { data: invoiceList } = useQuery({
        queryKey: ['go-to-palette', 'latest-invoice'],
        queryFn: () => invoiceApi.list({ limit: 1 }),
        staleTime: 60_000,
    });

    const { data: partyList } = useQuery({
        queryKey: ['go-to-palette', 'latest-party'],
        queryFn: () => partyApi.list({ limit: 1 }),
        staleTime: 60_000,
    });

    const { data: itemList } = useQuery({
        queryKey: ['go-to-palette', 'latest-item'],
        queryFn: () => itemApi.list({ limit: 1 }),
        staleTime: 60_000,
    });

    const { data: loanList } = useQuery({
        queryKey: ['go-to-palette', 'latest-loan'],
        queryFn: () => loanApi.list(),
        staleTime: 60_000,
    });

    const { data: accountList } = useQuery({
        queryKey: ['go-to-palette', 'latest-cash-bank'],
        queryFn: () => cashBankApi.getBalances(),
        staleTime: 60_000,
    });

    const { data: ledgerList } = useQuery({
        queryKey: ['go-to-palette', 'latest-ledger'],
        queryFn: () => accountingApi.getLedgers(),
        staleTime: 60_000,
    });

    const smartEntries = useMemo(() => {
        const latestInvoice = invoiceList?.data?.[0];
        const latestParty = partyList?.data?.[0];
        const latestItem = itemList?.items?.[0];
        const latestLoan = loanList?.data?.[0];
        const latestAccount = accountList?.data?.[0];
        const latestLedger = ledgerList?.data?.data?.[0];

        const items: SmartRouteEntry[] = [
            {
                label: 'Latest Invoice',
                subtitle: latestInvoice?.invoiceNumber
                    ? `Open ${latestInvoice.invoiceNumber}`
                    : 'Create first invoice',
                route: latestInvoice ? `/(main)/billing/${latestInvoice.id}` : '/(main)/billing/create?type=TAX_INVOICE',
                module: 'billing',
            },
            {
                label: 'Latest Party',
                subtitle: latestParty?.name
                    ? `Open ${latestParty.name}`
                    : 'Create first party',
                route: latestParty ? `/(main)/parties/${latestParty.id}` : '/(main)/parties/add',
                module: 'parties',
            },
            {
                label: 'Latest Item',
                subtitle: latestItem?.name
                    ? `Open ${latestItem.name}`
                    : 'Create first item',
                route: latestItem ? `/(main)/inventory/${latestItem.id}` : '/(main)/inventory/add-item',
                module: 'inventory',
            },
            {
                label: 'Latest Loan',
                subtitle: latestLoan?.lenderBorrowerName
                    ? `Open ${latestLoan.lenderBorrowerName}`
                    : 'Create first loan',
                route: latestLoan ? `/(main)/accounts/loans/${latestLoan.id}` : '/(main)/accounts/loans/add',
                module: 'accounts',
            },
            {
                label: 'Latest Cash/Bank',
                subtitle: latestAccount?.name
                    ? `Open ${latestAccount.name}`
                    : 'Create cash/bank account',
                route: latestAccount ? `/(main)/accounts/cash-bank/${latestAccount.id}` : '/(main)/accounts/cash-bank/add',
                module: 'accounts',
            },
            {
                label: 'Latest Ledger',
                subtitle: latestLedger?.name
                    ? `Open ${latestLedger.name}`
                    : 'Open ledger list',
                route: latestLedger ? `/(main)/reports/ledgers/${latestLedger.id}` : '/(main)/reports/ledgers',
                module: 'reports',
            },
        ];

        return items.filter((entry) => {
            if (!canAccessModule(role, entry.module, subscription)) return false;
            if (!normalizedQuery) return true;
            return `${entry.label} ${entry.subtitle}`.toLowerCase().includes(normalizedQuery);
        });
    }, [
        accountList?.data,
        invoiceList?.data,
        itemList?.items,
        ledgerList?.data?.data,
        loanList?.data,
        normalizedQuery,
        partyList?.data,
        role,
        subscription,
    ]);

    const visibleRoutes = useMemo(() => {
        return ROUTES.filter((entry) => {
            if (entry.ownerOnly && role !== 'owner') return false;
            if (entry.module && !canAccessModule(role, entry.module, subscription)) return false;
            if (entry.requiresPos && !canUsePos(subscription)) return false;
            if (entry.requiresFeature && !hasFeatureAccess(subscription, entry.requiresFeature)) return false;
            if (!normalizedQuery) return true;
            return `${entry.label} ${entry.description}`.toLowerCase().includes(normalizedQuery);
        });
    }, [normalizedQuery, role, subscription]);

    useEffect(() => {
        const opener = () => setVisible(true);
        listeners.add(opener);
        return () => {
            listeners.delete(opener);
        };
    }, []);

    useEffect(() => {
        if (Platform.OS !== 'web') return;

        const win = globalThis as unknown as {
            addEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
            removeEventListener: (type: 'keydown', listener: (event: KeyboardEvent) => void) => void;
        };
        const onKeyDown = (event: KeyboardEvent) => {
            const key = event.key.toLowerCase();
            if ((event.ctrlKey || event.metaKey) && key === 'k') {
                event.preventDefault();
                setVisible((current) => !current);
            }
            if (event.key === 'Escape') {
                setVisible(false);
            }
        };

        win.addEventListener('keydown', onKeyDown);
        return () => win.removeEventListener('keydown', onKeyDown);
    }, []);

    const openRoute = (route: string) => {
        setVisible(false);
        setQuery('');
        router.push(route as Parameters<typeof router.push>[0]);
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={() => setVisible(false)}
        >
            <View style={s.modalRoot}>
                <Pressable style={s.backdrop} onPress={() => setVisible(false)} />
                <View
                    style={[
                        s.sheet,
                        {
                            backgroundColor: colors.surface,
                            borderColor: colors.border,
                            paddingBottom: Math.max(insets.bottom + Spacing.lg, Spacing.xl),
                        },
                    ]}
                >
                        <View style={s.sheetHeader}>
                            <Text style={[s.sheetTitle, { color: colors.text }]}>Go To</Text>
                            <Pressable onPress={() => setVisible(false)}>
                                <Text style={[s.closeText, { color: colors.primary }]}>Close</Text>
                            </Pressable>
                        </View>

                        <TextInput
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Search screens... (Ctrl/Cmd + K)"
                            placeholderTextColor={colors.textSecondary}
                            style={[s.searchInput, { backgroundColor: colors.surfaceVariant, color: colors.text }]}
                            autoFocus
                        />

                        <ScrollView style={s.results} contentContainerStyle={s.resultsContent} keyboardShouldPersistTaps="handled">
                            {smartEntries.length > 0 ? (
                                <View style={s.block}>
                                    <Text style={[s.blockTitle, { color: colors.textSecondary }]}>SMART LINKS</Text>
                                    <View style={[s.group, { backgroundColor: colors.card }]}>
                                        {smartEntries.map((entry, index) => (
                                            <Pressable
                                                key={entry.label}
                                                style={({ pressed }) => [
                                                    s.row,
                                                    index < smartEntries.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                                    pressed && { backgroundColor: colors.backgroundSelected },
                                                ]}
                                                onPress={() => openRoute(entry.route)}
                                            >
                                                <View style={s.rowText}>
                                                    <Text style={[s.rowLabel, { color: colors.text }]}>{entry.label}</Text>
                                                    <Text style={[s.rowSub, { color: colors.textSecondary }]}>{entry.subtitle}</Text>
                                                </View>
                                                <Text style={[s.chevron, { color: colors.textSecondary }]}>{'>'}</Text>
                                            </Pressable>
                                        ))}
                                    </View>
                                </View>
                            ) : null}

                            <View style={s.block}>
                                <Text style={[s.blockTitle, { color: colors.textSecondary }]}>ALL ROUTES</Text>
                                <View style={[s.group, { backgroundColor: colors.card }]}>
                                    {visibleRoutes.map((entry, index) => (
                                        <Pressable
                                            key={entry.label}
                                            style={({ pressed }) => [
                                                s.row,
                                                index < visibleRoutes.length - 1 && { borderBottomWidth: 1, borderBottomColor: colors.border },
                                                pressed && { backgroundColor: colors.backgroundSelected },
                                            ]}
                                            onPress={() => openRoute(entry.route)}
                                        >
                                            <View style={s.rowText}>
                                                <Text style={[s.rowLabel, { color: colors.text }]}>{entry.label}</Text>
                                                <Text style={[s.rowSub, { color: colors.textSecondary }]}>{entry.description}</Text>
                                            </View>
                                            <Text style={[s.chevron, { color: colors.textSecondary }]}>{'>'}</Text>
                                        </Pressable>
                                    ))}
                                </View>
                            </View>

                            {visibleRoutes.length === 0 && smartEntries.length === 0 ? (
                                <View style={s.emptyState}>
                                    <Text style={[s.rowSub, { color: colors.textSecondary }]}>No route matches your search.</Text>
                                </View>
                            ) : null}
                        </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    modalRoot: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
        backgroundColor: withAlpha(colors.text, '88'),
    },
    sheet: {
        borderTopLeftRadius: Radius.lg,
        borderTopRightRadius: Radius.lg,
        borderWidth: 1,
        borderBottomWidth: 0,
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.md,
        gap: Spacing.sm,
        minHeight: '96%',
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    sheetTitle: {
        fontSize: Typography.title.size,
        fontWeight: '700',
    },
    closeText: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    searchInput: {
        borderRadius: Radius.pill,
        paddingHorizontal: Spacing.lg,
        paddingVertical: Spacing.sm,
        fontSize: Typography.body.size,
    },
    results: {
        flex: 1,
    },
    resultsContent: {
        gap: Spacing.sm,
        paddingBottom: Spacing.sm,
    },
    block: {
        gap: Spacing.xs,
    },
    blockTitle: {
        fontSize: Typography.caption.size,
        fontWeight: '700',
        letterSpacing: 0.7,
    },
    group: {
        borderRadius: Radius.card,
        overflow: 'hidden',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.sm,
        paddingHorizontal: Spacing.md,
        paddingVertical: Spacing.md,
    },
    rowText: { flex: 1 },
    rowLabel: {
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    rowSub: {
        fontSize: Typography.caption.size,
        marginTop: 2,
    },
    chevron: {
        fontSize: 16,
        fontWeight: '700',
    },
    emptyState: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: Spacing.xl,
    },
});


