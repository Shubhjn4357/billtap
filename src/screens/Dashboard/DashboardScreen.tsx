import React, { useCallback, useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    View,
    Pressable,
    useWindowDimensions,
} from 'react-native';
import { AppRefreshControl } from '../../components/common/AppRefreshControl';
import { useRouter } from 'expo-router';
import { Text, useTheme, Icon } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SummaryCard } from '../../components/common/SummaryCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { SkeletonList, SkeletonCardRow } from '../../components/common/SkeletonList';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';

// ─── Helpers ───────────────────────────────────────────────────────────────────

const asRecord = (v: unknown): Record<string, unknown> =>
    !v || typeof v !== 'object' || Array.isArray(v) ? {} : v as Record<string, unknown>;

const getBillPaymentStatus = (bill: unknown): 'PAID' | 'PARTIAL' | 'PENDING' => {
    const raw = asRecord(bill);
    const ps = typeof raw.paymentStatus === 'string' ? raw.paymentStatus.toUpperCase() : '';
    if (ps === 'PAID') return 'PAID';
    if (ps === 'PARTIAL') return 'PARTIAL';
    return 'PENDING';
};

// ─── Quick Actions ─────────────────────────────────────────────────────────────

interface QuickActionItem {
    icon: string;
    label: string;
    emoji: string;
    route: string;
    enabled: boolean;
    tone: 'primary' | 'secondary' | 'tertiary' | 'error';
}

const QuickActionCard: React.FC<{
    item: QuickActionItem;
    onPress: () => void;
}> = ({ item, onPress }) => {
    const theme = useTheme();

    const bgColor = (() => {
        switch (item.tone) {
            case 'secondary': return theme.colors.secondaryContainer;
            case 'tertiary': return theme.colors.tertiaryContainer;
            case 'error': return theme.colors.errorContainer;
            default: return theme.colors.primaryContainer;
        }
    })();

    const iconColor = (() => {
        switch (item.tone) {
            case 'secondary': return theme.colors.onSecondaryContainer;
            case 'tertiary': return theme.colors.onTertiaryContainer;
            case 'error': return theme.colors.onErrorContainer;
            default: return theme.colors.onPrimaryContainer;
        }
    })();

    return (
        <Pressable
            onPress={onPress}
            style={[
                styles.quickActionCard,
                {
                    backgroundColor: theme.colors.surface,
                    borderColor: theme.colors.outlineVariant,
                },
            ]}
            android_ripple={{ color: theme.colors.primaryContainer }}
        >
            <View style={[styles.quickActionIcon, { backgroundColor: bgColor }]}>
                <Text style={{ fontSize: 22 }}>{item.emoji}</Text>
            </View>
            <Text
                variant="labelMedium"
                style={[styles.quickActionLabel, { color: theme.colors.onSurface }]}
                numberOfLines={1}
            >
                {item.label}
            </Text>
        </Pressable>
    );
};

// ─── Main Screen ───────────────────────────────────────────────────────────────

export const DashboardScreen = () => {
    const { user } = useAuth();
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const isWide = width >= 768;
    const {
        canViewDashboard,
        canOpenBilling,
        canCreateSale,
        canCreatePurchase,
        canViewReports,
        canAccessAccounting,
        canManageInventory,
        canManageParties,
    } = useOrganizationAccess();

    // Data
    const { bills, loading: billsLoading, fetchBills } = useBills(canViewReports, { limit: 20 });
    const { accounts } = useAccounts();

    const [refreshing, setRefreshing] = useState(false);

    const activeCurrency = normalizeCurrencyCode(user?.currency ?? 'INR');
    const bottomSpacing = getTabAwareBottomSpacing(insets.bottom, 80);

    // ── Derived financial stats ────────────────────────────────────────────────

    const todayBills = useMemo(() => {
        const today = new Date().toDateString();
        return bills.filter((b) => new Date(b.createdAt).toDateString() === today);
    }, [bills]);

    const todaySales = useMemo(
        () => todayBills.filter((b) => b.type === 'SALE').reduce((sum, b) => sum + b.total, 0),
        [todayBills]
    );

    const todayPurchases = useMemo(
        () => todayBills.filter((b) => b.type === 'PURCHASE').reduce((sum, b) => sum + b.total, 0),
        [todayBills]
    );

    const totalCash = useMemo(
        () => accounts.filter((a) => a.type === 'CASH').reduce((sum, a) => sum + (a.balance ?? 0), 0),
        [accounts]
    );

    const totalBank = useMemo(
        () => accounts.filter((a) => a.type === 'BANK').reduce((sum, a) => sum + (a.balance ?? 0), 0),
        [accounts]
    );

    const netCash = totalCash + totalBank;

    const recentBills = useMemo(() => bills.slice(0, 10), [bills]);

    // ── Quick actions ─────────────────────────────────────────────────────────

    const quickActions = useMemo<QuickActionItem[]>(() => [
        {
            icon: 'calculator',
            label: 'New Bill',
            emoji: '🧾',
            route: '/(main)/(tabs)/billing',
            enabled: canOpenBilling && (canCreateSale || canCreatePurchase),
            tone: 'primary' as const,
        },
        {
            icon: 'package-variant',
            label: 'Inventory',
            emoji: '📦',
            route: '/(main)/(tabs)/stock',
            enabled: canManageInventory,
            tone: 'secondary' as const,
        },
        {
            icon: 'account-group',
            label: 'Parties',
            emoji: '🤝',
            route: '/party',
            enabled: canManageParties,
            tone: 'tertiary' as const,
        },
        {
            icon: 'chart-box',
            label: 'Reports',
            emoji: '📊',
            route: '/(main)/(tabs)/reports',
            enabled: canViewReports,
            tone: 'secondary' as const,
        },
        {
            icon: 'book-open-variant',
            label: 'Accounting',
            emoji: '📒',
            route: '/(main)/accounting',
            enabled: canAccessAccounting,
            tone: 'primary' as const,
        },
        {
            icon: 'swap-horizontal',
            label: 'Settlements',
            emoji: '💳',
            route: '/transaction/settlements',
            enabled: canOpenBilling,
            tone: 'tertiary' as const,
        },
    ].filter((a) => a.enabled), [
        canOpenBilling, canCreateSale, canCreatePurchase,
        canManageInventory, canManageParties, canViewReports, canAccessAccounting,
    ]);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchBills();
        setRefreshing(false);
    }, [fetchBills]);

    useFocusRefresh(
        () => { void fetchBills(); },
        { enabled: canViewDashboard }
    );

    if (!canViewDashboard) return null;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <ScreenWrapper>
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingBottom: bottomSpacing }]}
                refreshControl={
                    <AppRefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        tintColor={theme.colors.primary}
                        colors={[theme.colors.primary]}
                    />
                }
            >
                {/* ── Greeting Row ─────────────────────────────────────── */}
                <View style={styles.greetingRow}>
                    <View>
                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Good {getTimeGreeting()},
                        </Text>
                        <Text variant="titleLarge" style={[styles.bold, { color: theme.colors.onSurface }]}>
                            {user?.displayName?.split(' ')[0] ?? 'there'} 👋
                        </Text>
                    </View>
                </View>

                {/* ── Summary Cards Row ────────────────────────────────── */}
                {billsLoading && !refreshing ? (
                    <SkeletonCardRow columns={isWide ? 4 : 2} style={styles.section} />
                ) : (
                    <View style={[styles.section, isWide ? styles.summaryRowWide : styles.summaryRow]}>
                        <SummaryCard
                            label="Today Sales"
                            value={formatCurrency(todaySales, activeCurrency)}
                            icon="💰"
                            tone="positive"
                            style={styles.summaryCard}
                        />
                            <SummaryCard
                                label="Today Purchases"
                                value={formatCurrency(todayPurchases, activeCurrency)}
                                icon="🛒"
                                tone="negative"
                                style={styles.summaryCard}
                        />
                            <SummaryCard
                                label="Cash in Hand"
                                value={formatCurrency(totalCash, activeCurrency)}
                                icon="💵"
                                tone="neutral"
                                style={styles.summaryCard}
                        />
                            <SummaryCard
                                label="Net Balance"
                                value={formatCurrency(netCash, activeCurrency)}
                                icon="🏦"
                                tone={netCash >= 0 ? 'positive' : 'negative'}
                                style={styles.summaryCard}
                        />
                    </View>
                )}

                {/* ── Quick Actions ────────────────────────────────────── */}
                {quickActions.length > 0 && (
                    <View style={styles.section}>
                        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            Quick Actions
                        </Text>
                        <View style={styles.quickActionsGrid}>
                            {quickActions.map((action) => (
                                <QuickActionCard
                                    key={action.icon}
                                    item={action}
                                    onPress={() => router.push(action.route as never)}
                                />
                            ))}
                        </View>
                    </View>
                )}

                {/* ── Recent Transactions ──────────────────────────────── */}
                <View style={styles.section}>
                    <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                        Recent Transactions
                    </Text>

                    {billsLoading && !refreshing ? (
                        <View
                            style={[
                                styles.listCard,
                                {
                                    backgroundColor: theme.colors.surface,
                                    borderColor: theme.colors.outlineVariant,
                                },
                            ]}
                        >
                            <SkeletonList count={5} />
                        </View>
                    ) : recentBills.length === 0 ? (
                        <EmptyState
                            emoji="🧾"
                            title="No transactions yet"
                            subtitle="Your recent bills will appear here."
                        />
                    ) : (
                        <View
                            style={[
                                styles.listCard,
                                {
                                    backgroundColor: theme.colors.surface,
                                    borderColor: theme.colors.outlineVariant,
                                },
                            ]}
                        >
                            {recentBills.map((bill, index) => (
                                <React.Fragment key={bill.id}>
                                    <Pressable
                                        style={styles.txRow}
                                        onPress={() =>
                                            router.push({
                                                pathname: '/transaction/[id]',
                                                params: { id: bill.id },
                                            } as never)
                                        }
                                        android_ripple={{ color: theme.colors.surfaceVariant }}
                                    >
                                        {/* Left: type icon */}
                                        <View
                                            style={[
                                                styles.txIcon,
                                                {
                                                    backgroundColor:
                                                        bill.type === 'SALE'
                                                            ? theme.colors.secondaryContainer
                                                            : theme.colors.tertiaryContainer,
                                                },
                                            ]}
                                        >
                                            <Text style={{ fontSize: 18 }}>
                                                {bill.type === 'SALE' ? '📤' : '📥'}
                                            </Text>
                                        </View>

                                        {/* Middle: party + bill number */}
                                        <View style={styles.txMid}>
                                            <Text
                                                variant="bodyMedium"
                                                style={[styles.bold, { color: theme.colors.onSurface }]}
                                                numberOfLines={1}
                                            >
                                                {bill.customerName ?? 'Walk-in'}
                                            </Text>
                                            <Text
                                                variant="bodySmall"
                                                style={{ color: theme.colors.onSurfaceVariant }}
                                                numberOfLines={1}
                                            >
                                                {bill.billNumber} · {formatDate(bill.createdAt)}
                                            </Text>
                                        </View>

                                        {/* Right: amount + status */}
                                        <View style={styles.txRight}>
                                            <Text
                                                variant="bodyMedium"
                                                style={[
                                                    styles.bold,
                                                    {
                                                        color:
                                                            bill.type === 'SALE'
                                                                ? theme.colors.secondary
                                                                : theme.colors.error,
                                                    },
                                                ]}
                                            >
                                                {bill.type === 'SALE' ? '+' : '-'}
                                                {formatCurrency(bill.total, activeCurrency)}
                                            </Text>
                                            <StatusBadge
                                                status={(() => {
                                                    const ps = getBillPaymentStatus(bill);
                                                    if (ps === 'PAID') return 'paid' as const;
                                                    if (ps === 'PARTIAL') return 'partial' as const;
                                                    return 'pending' as const;
                                                })()}
                                                compact
                                            />
                                        </View>
                                    </Pressable>

                                    {index < recentBills.length - 1 && (
                                        <View
                                            style={[
                                                styles.separator,
                                                { backgroundColor: theme.colors.outlineVariant },
                                            ]}
                                        />
                                    )}
                                </React.Fragment>
                            ))}
                        </View>
                    )}
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getTimeGreeting(): string {
    const h = new Date().getHours();
    if (h < 12) return 'morning';
    if (h < 17) return 'afternoon';
    return 'evening';
}

function formatDate(iso: string | Date | number): string {
    return new Date(iso).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
    });
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    scroll: {
        gap: 0,
    },
    greetingRow: {
        paddingHorizontal: DesignSystem.spacing.md,
        paddingTop: DesignSystem.spacing.sm,
        paddingBottom: DesignSystem.spacing.md,
    },
    bold: {
        fontWeight: '700',
    },
    section: {
        paddingHorizontal: DesignSystem.spacing.md,
        marginBottom: DesignSystem.spacing.lg,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.sm,
        letterSpacing: 0.2,
    },
    summaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.sm,
    },
    summaryRowWide: {
        flexDirection: 'row',
        gap: DesignSystem.spacing.sm,
    },
    summaryCard: {
        minWidth: '47%',
    },
    quickActionsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.sm,
    },
    quickActionCard: {
        width: '30%',
        flexGrow: 1,
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        padding: DesignSystem.spacing.md,
        alignItems: 'center',
        gap: DesignSystem.spacing.xs,
        ...DesignSystem.shadow.card,
    },
    quickActionIcon: {
        width: 48,
        height: 48,
        borderRadius: DesignSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    quickActionLabel: {
        fontWeight: '600',
        textAlign: 'center',
    },
    listCard: {
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        overflow: 'hidden',
        ...DesignSystem.shadow.card,
    },
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: DesignSystem.spacing.md,
        paddingVertical: DesignSystem.spacing.sm + 2,
        gap: DesignSystem.spacing.sm,
    },
    txIcon: {
        width: 40,
        height: 40,
        borderRadius: DesignSystem.radius.sm,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txMid: {
        flex: 1,
        gap: 2,
    },
    txRight: {
        alignItems: 'flex-end',
        gap: 4,
    },
    separator: {
        height: StyleSheet.hairlineWidth,
        marginLeft: 56,
    },
});
