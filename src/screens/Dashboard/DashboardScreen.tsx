import React, { useCallback, useMemo, useRef, useState, ComponentProps } from 'react';
import { ScrollView, StyleSheet, View, RefreshControl, useWindowDimensions, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, useTheme, FAB, Surface, Icon } from 'react-native-paper';
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

const LineChart: any = React.lazy(() => import('react-native-gifted-charts').then(mod => ({ default: mod.LineChart as any })));
const BarChart: any = React.lazy(() => import('react-native-gifted-charts').then(mod => ({ default: mod.BarChart as any })));

export const DashboardScreen = () => {
    const { user } = useAuth();
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const {
        canViewDashboard,
        canOpenBilling,
        canViewReports,
    } = useOrganizationAccess();

    // Data Hooks
    const { bills, loading: billsLoading, fetchBills } = useBills(canViewReports, { limit: 20 });
    const { accounts } = useAccounts();

    const activeCurrency = normalizeCurrencyCode(user?.currency ?? 'INR');
    const bottomSpacing = getTabAwareBottomSpacing(insets.bottom, 80);

    const [activeTab, setActiveTab] = useState(0);
    const scrollRef = useRef<ScrollView>(null);

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

    const chartData = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayStr = d.toLocaleDateString('en-US', { weekday: 'short' });
            const dayBills = bills.filter(b => new Date(b.createdAt).toDateString() === d.toDateString() && b.type === 'SALE');
            const total = dayBills.reduce((sum, b) => sum + b.total, 0);
            data.push({ value: total, label: dayStr });
        }
        return data;
    }, [bills]);

    const maxValue = Math.max(...chartData.map(d => d.value), 1000);

    if (!canViewDashboard) return null;

    const handleTabChange = (index: number) => {
        setActiveTab(index);
        scrollRef.current?.scrollTo({ x: width * index, animated: true });
    };

    const handleScroll = (event: any) => {
        const scrollX = event.nativeEvent.contentOffset.x;
        const index = Math.round(scrollX / width);
        if (index !== activeTab && index >= 0 && index <= 1) {
            setActiveTab(index);
        }
    };

    return (
        <ScreenWrapper>
            <View style={{ paddingTop: insets.top + 50 }} />

            {/* Material 3 swipeable tabs indicator */}
            <View style={[styles.tabsContainer, { borderBottomColor: theme.colors.surfaceVariant }]}>
                {['Overview', 'Analytics'].map((tab, idx) => {
                    const isActive = activeTab === idx;
                    return (
                        <Pressable key={tab} style={styles.tab} onPress={() => handleTabChange(idx)}>
                            <Text variant="labelLarge" style={[{ color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant }, isActive && styles.tabTextActive]}>
                                {tab}
                            </Text>
                            {isActive && <View style={[styles.activeTabIndicator, { backgroundColor: theme.colors.primary }]} />}
                        </Pressable>
                    );
                })}
            </View>

            <ScrollView
                ref={scrollRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={handleScroll}
                scrollEventThrottle={16}
            >
                {/* PAGE 1: OVERVIEW */}
                <ScrollView
                    style={{ width }}
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
                        <Pressable key={bill.id} onPress={() => router.push({ pathname: '/transaction', params: { id: bill.id } })}>
                            <Surface style={styles.transactionCard} elevation={0}>
                                <View style={styles.transIcon}>
                                    <Icon source="arrow-bottom-left" size={24} color={theme.colors.primary} />
                                </View>
                                <View style={{ flex: 1, marginLeft: 12 }}>
                                    <Text variant="titleSmall" style={{ fontWeight: 'bold' }}>{bill.customerName || 'Walk-in'}</Text>
                                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>{bill.billNumber}</Text>
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text variant="titleSmall" style={{ fontWeight: 'bold', color: bill.type === 'SALE' ? theme.colors.primary : theme.colors.error }}>
                                        {bill.type === 'SALE' ? '+' : '-'}{formatCurrency(bill.total, activeCurrency)}
                                    </Text>
                                    <Text variant="labelSmall" style={{ color: theme.colors.outline }}>
                                        {new Date(bill.createdAt).toLocaleDateString()}
                                    </Text>
                                </View>
                            </Surface>
                        </Pressable>
                    ))}
                </ScrollView>

                {/* PAGE 2: ANALYTICS */}
                <ScrollView
                    style={{ width }}
                    contentContainerStyle={[styles.content, { paddingBottom: bottomSpacing }]}
                    showsVerticalScrollIndicator={false}
                >
                    <Text variant="titleMedium" style={styles.sectionTitle}>Sales Activity (Last 7 Days)</Text>
                    <Surface style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                        <React.Suspense fallback={<Text variant="bodySmall" style={{ color: theme.colors.outline, padding: 20 }}>Loading chart...</Text>}>
                            {/* @ts-ignore - dynamic imports from react-native-gifted-charts lose type bindings for some props */}
                            <LineChart
                                data={chartData}
                                width={width - 80}
                                height={220}
                                spacing={45}
                                initialSpacing={15}
                                color={theme.colors.primary}
                                thickness={3}
                                startFillColor={theme.colors.primary}
                                endFillColor={theme.colors.primary}
                                startOpacity={0.4}
                                endOpacity={0.05}
                                yAxisColor={theme.colors.outline}
                                xAxisColor={theme.colors.outline}
                                yAxisTextStyle={{ color: theme.colors.onSurfaceVariant }}
                                xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                                maxValue={maxValue * 1.2}
                                noOfSections={4}
                                formatYLabel={(val: string) => {
                                    const num = parseInt(val);
                                    return num >= 1000 ? `${(num / 1000).toFixed(1)}k` : num.toString();
                                }}
                                pointerConfig={{
                                    pointerStripHeight: 160,
                                    pointerStripColor: theme.colors.outlineVariant,
                                    pointerStripWidth: 2,
                                    pointerColor: theme.colors.outlineVariant,
                                    radius: 6,
                                    pointerLabelWidth: 80,
                                    pointerLabelHeight: 30,
                                    activatePointersOnLongPress: true,
                                    autoAdjustPointerLabelPosition: true,
                                    pointerLabelComponent: (items: any) => {
                                        return (
                                            <Surface style={{ height: 30, width: 80, justifyContent: 'center', alignItems: 'center', borderRadius: 4, backgroundColor: theme.colors.elevation.level3 }}>
                                                <Text variant="labelSmall" style={{ color: theme.colors.onSurface }}>{items[0].value}</Text>
                                            </Surface>
                                        );
                                    },
                                }}
                            />
                        </React.Suspense>
                    </Surface>

                    <Text variant="titleMedium" style={[styles.sectionTitle, { marginTop: DesignSystem.spacing.xl }]}>Weekly Breakdown</Text>
                    <Surface style={[styles.chartCard, { backgroundColor: theme.colors.surface }]} elevation={1}>
                        <React.Suspense fallback={<Text variant="bodySmall" style={{ color: theme.colors.outline, padding: 20 }}>Loading chart...</Text>}>
                            {/* @ts-ignore - dynamic imports from react-native-gifted-charts lose type bindings for some props */}
                            <BarChart
                                data={chartData}
                                width={width - 80}
                                height={220}
                                spacing={45}
                                initialSpacing={15}
                                frontColor={theme.colors.secondary}
                                barWidth={22}
                                barBorderRadius={4}
                                yAxisColor={theme.colors.outline}
                                xAxisColor={theme.colors.outline}
                                yAxisTextStyle={{ color: theme.colors.onSurfaceVariant }}
                                xAxisLabelTextStyle={{ color: theme.colors.onSurfaceVariant, fontSize: 10 }}
                                maxValue={maxValue * 1.2}
                                noOfSections={4}
                            />
                        </React.Suspense>
                    </Surface>

                </ScrollView>
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

type QuickActionProps = {
    icon: ComponentProps<typeof Icon>['source'];
    label: string;
    color: string;
    onPress: () => void;
};

const QuickAction = ({ icon, label, color, onPress }: QuickActionProps) => (
    <Surface style={styles.actionCard} elevation={1} onTouchEnd={onPress}>
        <View style={[styles.actionIconCircle, { backgroundColor: color + '20' }]}>
            <Icon source={icon} size={28} color={color} />
        </View>
        <Text variant="labelMedium" style={{ marginTop: 8 }}>{label}</Text>
    </Surface>
);

const styles = StyleSheet.create({

    tabsContainer: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        marginBottom: DesignSystem.spacing.xs,
    },
    tab: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: DesignSystem.spacing.md,
        position: 'relative',
    },
    tabTextActive: {
        fontWeight: 'bold',
    },
    activeTabIndicator: {
        position: 'absolute',
        bottom: -1,
        left: '20%',
        right: '20%',
        height: 3,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
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
        gap: DesignSystem.spacing.md,
        marginBottom: DesignSystem.spacing.xl,
    },
    heroCard: {
        flex: 1,
        padding: DesignSystem.spacing.md,
        borderRadius: DesignSystem.radius.lg,
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
        borderWidth: 1,
    },
    transIcon: {
        width: 40,
        height: 40,
        borderRadius: DesignSystem.radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chartCard: {
        padding: DesignSystem.spacing.md,
        borderRadius: DesignSystem.radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: DesignSystem.spacing.md,
    },
    fab: {
        position: 'absolute',
        right: DesignSystem.spacing.xl,
    },
});
