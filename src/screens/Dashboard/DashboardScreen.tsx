import React, { useCallback, useMemo } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, useTheme, FAB, Surface, Icon, IconButton } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { getTabAwareBottomSpacing } from '../../components/layout/tabBarMetrics';
import { Colors } from '../../constants/Colors';
import { DesignSystem } from '../../constants/DesignSystem';
import { useAuth } from '../../hooks/useAuth';
import { useBills } from '../../hooks/useBills';
import { useFocusRefresh } from '../../hooks/useFocusRefresh';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useAccounts } from '../../hooks/useAccounts';
import { formatCurrency, normalizeCurrencyCode } from '../../utils/formatters';

export const DashboardScreen = () => {
    const { user } = useAuth();
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const {
        canViewDashboard,
        canOpenBilling,
        canViewReports,
    } = useOrganizationAccess();

    // Data Hooks
    const { bills, loading: billsLoading, fetchBills } = useBills(canViewReports, { limit: 10 });
    const { accounts } = useAccounts();

    const activeCurrency = normalizeCurrencyCode(user?.currency ?? 'INR');
    const bottomSpacing = getTabAwareBottomSpacing(insets.bottom, 80);

    // Financial Stats
    const totalCash = useMemo(() =>
        accounts.filter(a => a.type === 'CASH').reduce((sum, a) => sum + (a.balance ?? 0), 0),
        [accounts]
    );

    const totalBank = useMemo(() =>
        accounts.filter(a => a.type === 'BANK').reduce((sum, a) => sum + (a.balance ?? 0), 0),
        [accounts]
    );

    const refreshDashboardData = useCallback(async () => {
        if (!canViewDashboard) return;
        await fetchBills();
    }, [canViewDashboard, fetchBills]);

    useFocusRefresh(refreshDashboardData, { enabled: canViewDashboard });

    if (!canViewDashboard) return null; // Or blocked UI

    return (
        <ScreenWrapper>
            <View style={styles.header}>
                <View>
                    <Text variant="headlineSmall" style={styles.greeting}>Hello, {user?.displayName?.split(' ')[0]}</Text>
                    <Text variant="bodyMedium" style={{ color: theme.colors.onSurfaceVariant }}>
                        {user?.businessName || 'Your Business'} Overview
                    </Text>
                </View>
                <IconButton icon="bell-outline" onPress={() => { }} />
            </View>

            <ScrollView
                contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]}
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={billsLoading} onRefresh={refreshDashboardData} />}
            >
                {/* Hero Cards - Financials */}
                <View style={styles.heroRow}>
                    <Surface style={[styles.heroCard, { backgroundColor: theme.colors.primaryContainer }]} elevation={2}>
                        <View style={styles.cardIconRow}>
                            <Icon source="cash" size={24} color={theme.colors.primary} />
                            <Text variant="labelMedium" style={{ color: theme.colors.primary }}>CASH IN HAND</Text>
                        </View>
                        <Text variant="headlineMedium" style={styles.heroValue}>
                            {formatCurrency(totalCash, activeCurrency)}
                        </Text>
                    </Surface>

                    <Surface style={[styles.heroCard, { backgroundColor: theme.colors.secondaryContainer }]} elevation={2}>
                        <View style={styles.cardIconRow}>
                            <Icon source="bank" size={24} color={theme.colors.secondary} />
                            <Text variant="labelMedium" style={{ color: theme.colors.secondary }}>BANK BALANCE</Text>
                        </View>
                        <Text variant="headlineMedium" style={styles.heroValue}>
                            {formatCurrency(totalBank, activeCurrency)}
                        </Text>
                    </Surface>
                </View>

                {/* Quick Actions */}
                <Text variant="titleMedium" style={styles.sectionTitle}>Quick Actions</Text>
                <View style={styles.actionsRow}>
                    <QuickAction
                        icon="plus-circle"
                        label="New Bill"
                        color={theme.colors.primary}
                        onPress={() => router.push('/(main)/(tabs)/billing')}
                    />
                    <QuickAction
                        icon="cube-outline"
                        label="Stock"
                        color={theme.colors.tertiary}
                        onPress={() => router.push('/(main)/(tabs)/stock')} 
                    />
                    <QuickAction
                        icon="chart-box-outline"
                        label="Reports"
                        color={theme.colors.secondary}
                        onPress={() => router.push('/(main)/(tabs)/reports')}
                    />
                    <QuickAction
                        icon="swap-horizontal"
                        label="Transfer"
                        color={Colors.light.error}
                        onPress={() => { }}
                    />
                </View>

                {/* Recent Activity */}
                <View style={styles.recentHeader}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>Recent Transactions</Text>
                    <Text variant="labelLarge" style={{ color: theme.colors.primary }} onPress={() => router.push('/transaction/settlements' as never)}>See All</Text>
                </View>

                {bills.slice(0, 5).map((bill) => (
                    <Surface key={bill.id} style={styles.transactionCard} elevation={0}>
                        <View style={styles.transIcon}>
                            <Icon source="arrow-bottom-left" size={24} color={theme.colors.primary} />
                        </View>
                        <View style={{ flex: 1, marginLeft: 12 }}>
                            <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{bill.customerName || 'Walk-in'}</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{bill.billNumber}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>
                                +{formatCurrency(bill.total, activeCurrency)}
                            </Text>
                            <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                                {new Date(bill.createdAt).toLocaleDateString()}
                            </Text>
                        </View>
                    </Surface>
                ))}

            </ScrollView>

            {canOpenBilling && (
                <FAB
                    icon="plus"
                    style={[styles.fab, { bottom: bottomSpacing + 20 }]}
                    onPress={() => router.push('/(main)/(tabs)/billing')}
                    label="New Bill"
                />
            )}
        </ScreenWrapper>
    );
};

const QuickAction = ({ icon, label, color, onPress }: any) => (
    <Surface style={styles.actionCard} elevation={1} onTouchEnd={onPress}>
        <View style={[styles.actionIconCircle, { backgroundColor: color + '20' }]}>
            <Icon source={icon} size={28} color={color} />
        </View>
        <Text variant="labelMedium" style={{ marginTop: 8 }}>{label}</Text>
    </Surface>
);

const styles = StyleSheet.create({
    header: {
        paddingHorizontal: DesignSystem.spacing.xl, // 24
        paddingTop: DesignSystem.spacing.sm, // 10
        paddingBottom: DesignSystem.spacing.sm,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    greeting: {
        fontWeight: 'bold',
    },
    content: {
        paddingHorizontal: DesignSystem.spacing.xl,
        paddingTop: DesignSystem.spacing.sm,
    },
    heroRow: {
        flexDirection: 'row',
        gap: DesignSystem.spacing.md, // 14
        marginBottom: DesignSystem.spacing.xl,
    },
    heroCard: {
        flex: 1,
        padding: DesignSystem.spacing.md,
        borderRadius: DesignSystem.radius.lg, // 20
        justifyContent: 'space-between',
    },
    cardIconRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.sm,
    },
    heroValue: {
        fontWeight: '800',
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.sm,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: DesignSystem.spacing.xl,
    },
    actionCard: {
        width: '23%',
        aspectRatio: 1,
        borderRadius: DesignSystem.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'white',
    },
    actionIconCircle: {
        width: 48,
        height: 48,
        borderRadius: DesignSystem.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    recentHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: DesignSystem.spacing.sm,
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: DesignSystem.spacing.sm,
        marginBottom: DesignSystem.spacing.xs,
        borderRadius: DesignSystem.radius.sm,
        backgroundColor: 'white',
        borderWidth: 1,
        borderColor: '#EEE',
    },
    transIcon: {
        width: 40,
        height: 40,
        borderRadius: DesignSystem.radius.pill,
        backgroundColor: '#F0F0F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    fab: {
        position: 'absolute',
        right: DesignSystem.spacing.xl,
    },
});
