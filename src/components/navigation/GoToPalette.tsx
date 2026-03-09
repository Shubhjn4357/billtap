import { useEffect, useMemo, useState } from 'react';
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
} from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DESIGN_SPACING, getSurfaceStyle } from '../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { useAuthStore } from '../../store/authStore';
import {
    canAccessModule,
    canUsePos,
    hasFeatureAccess,
    type AppModule,
} from '../../utils/accessControl';
import { GO_TO_PALETTE_ROUTES } from '../../constants/navigationOptions';
import { useItemCatalog } from '../../hooks/useInventory';
import { useLoans } from '../../hooks/useLoans';
import { useInvoices } from '../../hooks/useInvoices';
import { useParties } from '../../hooks/useParties';
import { useCashBankAccounts } from '../../hooks/useCashBankAccounts';
import { useAccountingLedgers } from '../../hooks/useAccountingLedgers';

type SmartRouteEntry = {
    label: string;
    subtitle: string;
    route: string;
    module: AppModule;
};

const listeners = new Set<() => void>();
export const openGoToPalette = () => {
    listeners.forEach((listener) => listener());
};

export function GoToPalette() {
    const colors = useAppColors();
    const insets = useSafeAreaInsets();
    const s = styles(colors);

    const [visible, setVisible] = useState(false);
    const [query, setQuery] = useState('');
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const normalizedQuery = query.trim().toLowerCase();

    const { invoices: latestInvoices } = useInvoices({
        type: 'ALL',
        limit: 1,
        staleTime: 60_000,
        enabled: visible,
    });

    const { parties: latestParties } = useParties({
        limit: 1,
        staleTime: 60_000,
        enabled: visible,
    });

    const { items: latestItems } = useItemCatalog({ limit: 1, staleTime: 60_000, enabled: visible });
    const { loans: latestLoans } = useLoans({ limit: 1, staleTime: 60_000, enabled: visible });
    const { accounts: latestAccounts } = useCashBankAccounts({ staleTime: 60_000, enabled: visible });
    const { rows: latestLedgers } = useAccountingLedgers({ limit: 1, staleTime: 60_000, enabled: visible });

    const smartEntries = useMemo(() => {
        const latestInvoice = latestInvoices[0];
        const latestParty = latestParties[0];
        const latestItem = latestItems[0];
        const latestLoan = latestLoans[0];
        const latestAccount = latestAccounts[0];
        const latestLedger = latestLedgers[0];

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
        latestAccounts,
        latestInvoices,
        latestItems,
        latestLedgers,
        latestLoans,
        normalizedQuery,
        latestParties,
        role,
        subscription,
    ]);

    const visibleRoutes = useMemo(() => {
        return GO_TO_PALETTE_ROUTES.filter((entry) => {
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
                                    <View style={[s.group, getSurfaceStyle(colors, { elevated: true })]}>
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
                                <View style={[s.group, getSurfaceStyle(colors, { elevated: true })]}>
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
        borderBottomWidth: 0,
        paddingHorizontal: DESIGN_SPACING.screenX,
        paddingTop: Spacing.md,
        gap: Spacing.sm,
        minHeight: '96%',
        ...getSurfaceStyle(colors, { floating: true }),
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
        paddingHorizontal: Spacing.md,
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
