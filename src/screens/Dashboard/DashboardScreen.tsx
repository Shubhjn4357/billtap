import React, { useCallback, useMemo, useState } from 'react';
import {
    ScrollView,
    StyleSheet,
    View,
    Pressable,
    useWindowDimensions,
} from 'react-native';
import { AppPullToRefresh } from '../../components/common/AppPullToRefresh';
import { useRouter } from 'expo-router';
import { Text, useTheme } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { SummaryCard } from '../../components/common/SummaryCard';
import { StatusBadge } from '../../components/common/StatusBadge';
import { EmptyState } from '../../components/common/EmptyState';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { SkeletonCardRow, SkeletonList } from '../../components/common/SkeletonList';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useAccounts } from '../../hooks/useAccounts';
import { useStock } from '../../hooks/useStock';
import { useParties } from '../../hooks/useParties';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';
import type { CachedBill } from '../../api/billService';

// ─── Helpers ───────────────────────────────────────────────────────────────────

/** Derive StatusBadge status from a CachedBill — fully typed, no runtime cast. */
const getPaymentStatus = (bill: CachedBill): 'paid' | 'partial' | 'pending' => {
    if (bill.paymentStatus === 'PAID') return 'paid';
    if (bill.paymentStatus === 'PARTIAL') return 'partial';
    return 'pending';
};

const getBillType = (bill: CachedBill): 'SALE' | 'PURCHASE' => (
    bill.type === 'PURCHASE' ? 'PURCHASE' : 'SALE'
);

const getBillPartyName = (bill: CachedBill): string => {
    const partyName = bill.customerName?.trim() || bill.partyName?.trim();
    return partyName && partyName.length > 0 ? partyName : 'Walk-in';
};

const toDateSafe = (value: unknown): Date | null => {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(value as string | number);
    return Number.isNaN(date.getTime()) ? null : date;
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

interface HighlightCard {
    key: string;
    title: string;
    subtitle: string;
    value: string;
    valueLabel: string;
    meta: string;
    route?: string;
    tone: 'primary' | 'secondary' | 'tertiary';
}

interface CategoryMetric {
    key: string;
    name: string;
    itemCount: number;
    stockUnits: number;
    stockValue: number;
}

interface TopItemMetric {
    key: string;
    name: string;
    quantity: number;
    revenue: number;
}

interface CollectionMetric {
    key: string;
    name: string;
    due: number;
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
    const { bills, loading: billsLoading, fetchBills } = useBills(canViewDashboard, { limit: 120 });

    const { accounts, loading: accountsLoading } = useAccounts();
    const { allItems, loading: stockLoading, fetchItems } = useStock();
    const { parties, loading: partiesLoading, fetchParties } = useParties();

    const [refreshing, setRefreshing] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(0);

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

    const pendingSaleAmount = useMemo(() => (
        bills.reduce((sum, bill) => {
            if (getBillType(bill) !== 'SALE') return sum;
            return sum + Math.max(0, bill.total - (bill.paidAmount ?? 0));
        }, 0)
    ), [bills]);

    const pendingPurchaseAmount = useMemo(() => (
        bills.reduce((sum, bill) => {
            if (getBillType(bill) !== 'PURCHASE') return sum;
            return sum + Math.max(0, bill.total - (bill.paidAmount ?? 0));
        }, 0)
    ), [bills]);

    const pendingBillsCount = useMemo(
        () => bills.filter((bill) => getPaymentStatus(bill) !== 'paid').length,
        [bills]
    );

    const paidBillsCount = useMemo(
        () => bills.filter((bill) => getPaymentStatus(bill) === 'paid').length,
        [bills]
    );

    const inventoryValue = useMemo(() => (
        allItems.reduce((sum, item) => {
            const units = Math.max(0, Number(item.stock ?? 0));
            const unitCost = Number(item.purchasePrice ?? item.price ?? 0);
            return sum + (units * unitCost);
        }, 0)
    ), [allItems]);

    const lowStockItems = useMemo(() => (
        allItems.filter((item) => {
            const threshold = Number(item.minimumStock ?? item.lowStockThreshold ?? 0);
            return threshold > 0 && Number(item.stock ?? 0) <= threshold;
        })
    ), [allItems]);

    const recentWindowStart = useMemo(() => {
        const date = new Date();
        date.setDate(date.getDate() - 29);
        date.setHours(0, 0, 0, 0);
        return date;
    }, []);

    const billsInRecentWindow = useMemo(() => (
        bills.filter((bill) => {
            const createdAt = toDateSafe(bill.createdAt);
            return !!createdAt && createdAt >= recentWindowStart;
        })
    ), [bills, recentWindowStart]);

    const categoryMetrics = useMemo<CategoryMetric[]>(() => {
        const map = new Map<string, CategoryMetric>();

        allItems.forEach((item) => {
            const name = item.category?.trim() || 'Uncategorized';
            const key = name.toLowerCase();
            const units = Math.max(0, Number(item.stock ?? 0));
            const unitCost = Number(item.purchasePrice ?? item.price ?? 0);

            const current = map.get(key) ?? {
                key,
                name,
                itemCount: 0,
                stockUnits: 0,
                stockValue: 0,
            };
            current.itemCount += 1;
            current.stockUnits += units;
            current.stockValue += units * unitCost;
            map.set(key, current);
        });

        return Array.from(map.values()).sort((a, b) => b.stockValue - a.stockValue);
    }, [allItems]);

    const monthStart = useMemo(() => {
        const now = new Date();
        return new Date(now.getFullYear(), now.getMonth(), 1);
    }, []);

    const demographicStats = useMemo(() => {
        const customerActivity = new Map<string, number>();
        const supplierActivity = new Map<string, number>();
        let walkInSales = 0;

        billsInRecentWindow.forEach((bill) => {
            const billType = getBillType(bill);
            const partyName = getBillPartyName(bill);
            const isWalkIn = partyName.toLowerCase().includes('walk');

            if (billType === 'SALE') {
                if (isWalkIn) {
                    walkInSales += 1;
                } else {
                    customerActivity.set(partyName, (customerActivity.get(partyName) ?? 0) + 1);
                }
                return;
            }

            supplierActivity.set(partyName, (supplierActivity.get(partyName) ?? 0) + 1);
        });

        const repeatCustomers = Array.from(customerActivity.values()).filter((count) => count > 1).length;
        const newParties = parties.filter((party) => {
            const createdAt = toDateSafe(party.createdAt);
            return !!createdAt && createdAt >= monthStart;
        }).length;

        return {
            activeCustomers: customerActivity.size,
            activeSuppliers: supplierActivity.size,
            repeatCustomers,
            walkInSales,
            newParties,
        };
    }, [billsInRecentWindow, monthStart, parties]);

    const topMovingItems = useMemo<TopItemMetric[]>(() => {
        const map = new Map<string, TopItemMetric>();

        billsInRecentWindow.forEach((bill) => {
            if (getBillType(bill) !== 'SALE') return;

            bill.items.forEach((line) => {
                const key = (line.id || line.name || '').trim();
                if (!key) return;
                const quantity = Math.max(0, Number(line.quantity ?? 0));
                const revenue = quantity * Number(line.price ?? 0);
                const current = map.get(key) ?? {
                    key,
                    name: line.name || key,
                    quantity: 0,
                    revenue: 0,
                };
                current.quantity += quantity;
                current.revenue += revenue;
                map.set(key, current);
            });
        });

        return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
    }, [billsInRecentWindow]);

    const collectionWatchlist = useMemo<CollectionMetric[]>(() => {
        const map = new Map<string, CollectionMetric>();

        bills.forEach((bill) => {
            if (getBillType(bill) !== 'SALE') return;
            const due = Math.max(0, bill.total - (bill.paidAmount ?? 0));
            if (due <= 0) return;

            const partyName = getBillPartyName(bill);
            const key = partyName.toLowerCase();
            const current = map.get(key) ?? {
                key,
                name: partyName,
                due: 0,
            };
            current.due += due;
            map.set(key, current);
        });

        return Array.from(map.values()).sort((a, b) => b.due - a.due).slice(0, 5);
    }, [bills]);

    const totalCustomers = useMemo(
        () => parties.filter((party) => party.type === 'customer').length,
        [parties]
    );
    const totalSuppliers = useMemo(
        () => parties.filter((party) => party.type === 'supplier').length,
        [parties]
    );

    const highlightCards = useMemo<HighlightCard[]>(() => ([
        {
            key: 'business',
            title: user?.businessName?.trim() || 'Business Profile',
            subtitle: user?.address?.trim() || 'Add business address in profile setup',
            value: formatCurrency(todaySales - todayPurchases, activeCurrency),
            valueLabel: 'Today Net',
            meta: `${billsInRecentWindow.length} bills in last 30 days`,
            route: '/(main)/profile',
            tone: 'primary',
        },
        {
            key: 'collections',
            title: 'Collection Pulse',
            subtitle: `${pendingBillsCount} pending | ${paidBillsCount} paid`,
            value: formatCurrency(pendingSaleAmount, activeCurrency),
            valueLabel: 'Receivable',
            meta: `Payables ${formatCurrency(pendingPurchaseAmount, activeCurrency)}`,
            route: '/(main)/(tabs)/reports',
            tone: 'secondary',
        },
        {
            key: 'inventory',
            title: 'Inventory Pulse',
            subtitle: `${allItems.length} items | ${lowStockItems.length} low stock`,
            value: formatCurrency(inventoryValue, activeCurrency),
            valueLabel: 'Stock Value',
            meta: `${totalCustomers} customers | ${totalSuppliers} suppliers`,
            route: '/(main)/(tabs)/stock',
            tone: 'tertiary',
        },
    ]), [
        activeCurrency,
        allItems.length,
        billsInRecentWindow.length,
        inventoryValue,
        lowStockItems.length,
        paidBillsCount,
        pendingBillsCount,
        pendingPurchaseAmount,
        pendingSaleAmount,
        todayPurchases,
        todaySales,
        totalCustomers,
        totalSuppliers,
        user?.address,
        user?.businessName,
    ]);

    const highlightCardWidth = useMemo(() => (
        Math.max(280, Math.min(isWide ? 560 : width - (DesignSystem.spacing.md * 4), 560))
    ), [isWide, width]);

    const highlightSnapInterval = useMemo(
        () => highlightCardWidth + DesignSystem.spacing.sm,
        [highlightCardWidth]
    );

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

    const handleHighlightSnap = useCallback((offsetX: number) => {
        const nextIndex = Math.round(offsetX / highlightSnapInterval);
        setHighlightIndex((previous) => {
            const bounded = Math.max(0, Math.min(nextIndex, highlightCards.length - 1));
            return previous === bounded ? previous : bounded;
        });
    }, [highlightCards.length, highlightSnapInterval]);

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.allSettled([fetchBills(), fetchItems(), fetchParties()]);
        } finally {
            setRefreshing(false);
        }
    }, [fetchBills, fetchItems, fetchParties]);

    useFocusRefresh(
        () => { void Promise.allSettled([fetchBills(), fetchItems(), fetchParties()]); },
        { enabled: canViewDashboard }
    );

    const isInitialLoading = (
        (billsLoading && bills.length === 0)
        || (accountsLoading && accounts.length === 0)
        || (stockLoading && allItems.length === 0)
        || (partiesLoading && parties.length === 0)
    );

    if (!canViewDashboard) return null;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <ScreenWrapper>
            <AppPullToRefresh
                refreshing={refreshing}
                onRefresh={handleRefresh}
            >
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[styles.scroll, { paddingBottom: bottomSpacing }]}
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
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            Business Snapshot
                        </Text>
                    </View>
                    {isInitialLoading ? (
                        <SkeletonCardRow columns={1} />
                    ) : (
                        <>
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                snapToInterval={highlightSnapInterval}
                                decelerationRate="fast"
                                onMomentumScrollEnd={(event) => handleHighlightSnap(event.nativeEvent.contentOffset.x)}
                                contentContainerStyle={styles.highlightScrollContent}
                            >
                                {highlightCards.map((card) => {
                                    const backgroundColor = card.tone === 'secondary'
                                        ? theme.colors.secondaryContainer
                                        : card.tone === 'tertiary'
                                            ? theme.colors.tertiaryContainer
                                            : theme.colors.primaryContainer;
                                    const borderColor = card.tone === 'secondary'
                                        ? theme.colors.secondary
                                        : card.tone === 'tertiary'
                                            ? theme.colors.tertiary
                                            : theme.colors.primary;
                                    const textColor = card.tone === 'secondary'
                                        ? theme.colors.onSecondaryContainer
                                        : card.tone === 'tertiary'
                                            ? theme.colors.onTertiaryContainer
                                            : theme.colors.onPrimaryContainer;

                                    return (
                                        <Pressable
                                            key={card.key}
                                            onPress={card.route ? () => router.push(card.route as never) : undefined}
                                            disabled={!card.route}
                                            style={[
                                                styles.highlightCard,
                                                {
                                                    width: highlightCardWidth,
                                                    backgroundColor,
                                                    borderColor,
                                                },
                                            ]}
                                            android_ripple={{ color: theme.colors.surface }}
                                        >
                                            <View style={styles.highlightTopRow}>
                                                <Text variant="titleMedium" style={[styles.bold, { color: textColor, flex: 1 }]} numberOfLines={1}>
                                                    {card.title}
                                                </Text>
                                                <Text variant="labelSmall" style={[styles.highlightChip, { color: theme.colors.onSurface, backgroundColor: theme.colors.surface }]}>
                                                    {card.valueLabel}
                                                </Text>
                                            </View>
                                            <Text variant="bodySmall" style={{ color: textColor }} numberOfLines={2}>
                                                {card.subtitle}
                                            </Text>
                                            <Text variant="headlineSmall" style={[styles.highlightValue, { color: textColor }]}>
                                                {card.value}
                                            </Text>
                                            <Text variant="labelSmall" style={{ color: textColor }} numberOfLines={1}>
                                                {card.meta}
                                            </Text>
                                        </Pressable>
                                    );
                                })}
                            </ScrollView>
                            <View style={styles.dotRow}>
                                {highlightCards.map((card, index) => (
                                    <View
                                        key={card.key}
                                        style={[
                                            styles.dot,
                                            {
                                                backgroundColor:
                                                    index === highlightIndex
                                                        ? theme.colors.primary
                                                        : theme.colors.outlineVariant,
                                            },
                                        ]}
                                    />
                                ))}
                            </View>
                        </>
                    )}
                </View>
                {isInitialLoading ? (
                    <View style={styles.section}>
                        <PageHeaderCard title="Dashboard" />
                        <View style={styles.sectionHeader}>
                            <Text style={styles.sectionTitle}>Recent Activities</Text>
                        </View>
                        <SkeletonCardRow columns={isWide ? 4 : 2} style={{ marginVertical: DesignSystem.spacing.xs }} />
                        <SkeletonList count={8} />
                    </View>
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
                    <View style={styles.sectionHeader}>
                        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            Categories
                        </Text>
                        <Pressable onPress={() => router.push('/(main)/categories' as never)}>
                            <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                                Manage
                            </Text>
                        </Pressable>
                    </View>
                    {categoryMetrics.length === 0 ? (
                        <EmptyState
                            title="No categories found"
                            subtitle="Create stock items with categories to unlock category analytics."
                        />
                    ) : (
                        <View style={styles.categoryGrid}>
                            {categoryMetrics.slice(0, 6).map((category) => (
                                <Pressable
                                    key={category.key}
                                    style={[
                                        styles.categoryCard,
                                        {
                                            backgroundColor: theme.colors.surface,
                                            borderColor: theme.colors.outlineVariant,
                                        },
                                    ]}
                                    onPress={() => router.push('/(main)/(tabs)/stock' as never)}
                                    android_ripple={{ color: theme.colors.surfaceVariant }}
                                >
                                    <Text variant="titleSmall" numberOfLines={1} style={[styles.bold, { color: theme.colors.onSurface }]}>
                                        {category.name}
                                    </Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                        {category.itemCount} items | {category.stockUnits} units
                                    </Text>
                                    <Text variant="labelLarge" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                                        {formatCurrency(category.stockValue, activeCurrency)}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    )}
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            Recent Demographics
                        </Text>
                        <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                            Last 30 days
                        </Text>
                    </View>
                    <View style={styles.demographicGrid}>
                        <View style={[styles.demographicCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Active Customers</Text>
                            <Text variant="headlineSmall" style={[styles.bold, { color: theme.colors.onSurface }]}>{demographicStats.activeCustomers}</Text>
                        </View>
                        <View style={[styles.demographicCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Repeat Buyers</Text>
                            <Text variant="headlineSmall" style={[styles.bold, { color: theme.colors.onSurface }]}>{demographicStats.repeatCustomers}</Text>
                        </View>
                        <View style={[styles.demographicCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>Walk-in Sales</Text>
                            <Text variant="headlineSmall" style={[styles.bold, { color: theme.colors.onSurface }]}>{demographicStats.walkInSales}</Text>
                        </View>
                        <View style={[styles.demographicCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                            <Text variant="labelMedium" style={{ color: theme.colors.onSurfaceVariant }}>New Parties</Text>
                            <Text variant="headlineSmall" style={[styles.bold, { color: theme.colors.onSurface }]}>{demographicStats.newParties}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={[styles.insightsGrid, isWide && styles.insightsGridWide]}>
                        <View style={[styles.insightCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                            <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                                Top Moving Items
                            </Text>
                            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                Last 30 days
                            </Text>
                            {topMovingItems.length === 0 ? (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 10 }}>
                                    No sales movement data available.
                                </Text>
                            ) : (
                                <View style={styles.insightRows}>
                                    {topMovingItems.map((item, index) => (
                                        <View key={item.key} style={styles.insightRow}>
                                            <Text variant="bodySmall" style={[styles.insightIndex, { color: theme.colors.onSurfaceVariant }]}>
                                                {index + 1}
                                            </Text>
                                            <View style={{ flex: 1 }}>
                                                <Text variant="bodyMedium" numberOfLines={1} style={[styles.bold, { color: theme.colors.onSurface }]}>
                                                    {item.name}
                                                </Text>
                                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                                    {item.quantity} qty
                                                </Text>
                                            </View>
                                            <Text variant="labelMedium" style={{ color: theme.colors.primary, fontWeight: '700' }}>
                                                {formatCurrency(item.revenue, activeCurrency)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>

                        <View style={[styles.insightCard, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outlineVariant }]}>
                            <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                                Collection Watchlist
                            </Text>
                            <Text variant="labelSmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                Outstanding receivables
                            </Text>
                            {collectionWatchlist.length === 0 ? (
                                <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 10 }}>
                                    No pending receivables.
                                </Text>
                            ) : (
                                <View style={styles.insightRows}>
                                    {collectionWatchlist.map((entry, index) => (
                                        <View key={entry.key} style={styles.insightRow}>
                                            <Text variant="bodySmall" style={[styles.insightIndex, { color: theme.colors.onSurfaceVariant }]}>
                                                {index + 1}
                                            </Text>
                                            <View style={{ flex: 1 }}>
                                                <Text variant="bodyMedium" numberOfLines={1} style={[styles.bold, { color: theme.colors.onSurface }]}>
                                                    {entry.name}
                                                </Text>
                                            </View>
                                            <Text variant="labelMedium" style={{ color: theme.colors.error, fontWeight: '700' }}>
                                                {formatCurrency(entry.due, activeCurrency)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            )}
                        </View>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text variant="titleSmall" style={[styles.sectionTitle, { color: theme.colors.onSurface }]}>
                            Recent Transactions
                        </Text>
                    </View>

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
                                                pathname: '/bill/[id]',
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
                                                        getBillType(bill) === 'SALE'
                                                            ? theme.colors.secondaryContainer
                                                            : theme.colors.tertiaryContainer,
                                                },
                                            ]}
                                        >
                                            <Text style={{ fontSize: 18 }}>
                                                {getBillType(bill) === 'SALE' ? '📤' : '📥'}
                                            </Text>
                                        </View>

                                        {/* Middle: party + bill number */}
                                        <View style={styles.txMid}>
                                            <Text
                                                variant="bodyMedium"
                                                style={[styles.bold, { color: theme.colors.onSurface }]}
                                                numberOfLines={1}
                                            >
                                                {getBillPartyName(bill)}
                                            </Text>
                                            <Text
                                                variant="bodySmall"
                                                style={{ color: theme.colors.onSurfaceVariant }}
                                                numberOfLines={1}
                                            >
                                                {bill.billNumber || bill.id.slice(0, 8).toUpperCase()} · {formatDate(bill.createdAt)}
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
                                                            getBillType(bill) === 'SALE'
                                                                ? theme.colors.secondary
                                                                : theme.colors.error,
                                                    },
                                                ]}
                                            >
                                                {getBillType(bill) === 'SALE' ? '+' : '-'}
                                                {formatCurrency(bill.total, activeCurrency)}
                                            </Text>
                                            <StatusBadge
                                                status={getPaymentStatus(bill)}
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
            </AppPullToRefresh>
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
        marginVertical: DesignSystem.spacing.sm,
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DesignSystem.spacing.sm,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.sm,
        letterSpacing: 0.2,
    },
    highlightScrollContent: {
        paddingRight: DesignSystem.spacing.md,
        gap: DesignSystem.spacing.sm,
    },
    highlightCard: {
        borderRadius: DesignSystem.radius.lg,
        borderWidth: 1,
        padding: DesignSystem.spacing.md,
        gap: DesignSystem.spacing.xs,
        ...DesignSystem.shadow.card,
    },
    highlightTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: DesignSystem.spacing.sm,
    },
    highlightChip: {
        paddingHorizontal: DesignSystem.spacing.sm,
        paddingVertical: DesignSystem.spacing.xs,
        borderRadius: DesignSystem.radius.pill,
        overflow: 'hidden',
    },
    highlightValue: {
        fontWeight: '800',
        marginTop: DesignSystem.spacing.xs,
    },
    dotRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 6,
        marginTop: DesignSystem.spacing.sm,
    },
    dot: {
        width: 8,
        height: 8,
        borderRadius: DesignSystem.radius.pill,
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
    categoryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.sm,
    },
    categoryCard: {
        width: '48%',
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        padding: DesignSystem.spacing.md,
        gap: 4,
        ...DesignSystem.shadow.card,
    },
    demographicGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.sm,
    },
    demographicCard: {
        width: '48%',
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        padding: DesignSystem.spacing.md,
        gap: DesignSystem.spacing.xs,
    },
    insightsGrid: {
        gap: DesignSystem.spacing.sm,
    },
    insightsGridWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    insightCard: {
        flex: 1,
        minWidth: 0,
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        padding: DesignSystem.spacing.md,
    },
    insightRows: {
        marginTop: DesignSystem.spacing.sm,
        gap: DesignSystem.spacing.sm,
    },
    insightRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DesignSystem.spacing.sm,
    },
    insightIndex: {
        width: 14,
        textAlign: 'center',
        fontWeight: '700',
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
