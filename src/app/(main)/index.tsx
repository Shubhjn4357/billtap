import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { endOfMonth, format, startOfMonth } from 'date-fns';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useAuthStore } from '../../store/authStore';
import { getColors, Spacing, Radius, Typography, type ColorPalette } from '../../constants/theme';
import { reportApi } from '../../api/endpoints';
import { canAccessModule, canUsePos, type AppModule } from '../../utils/accessControl';
import { AppTopBar } from '../../components/ui/AppTopBar';
import { useHaptics } from '../../hooks/useHaptics';

const TODAY = new Date();
const MONTH_START = format(startOfMonth(TODAY), 'yyyy-MM-dd');
const MONTH_END = format(endOfMonth(TODAY), 'yyyy-MM-dd');

type QuickAction = {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    route: string;
    module: AppModule;
    requiresPos?: boolean;
};

const QUICK_ACTIONS: QuickAction[] = [
    { icon: 'file-document-plus-outline', label: 'Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', module: 'billing' },
    { icon: 'point-of-sale', label: 'POS', route: '/(main)/billing/pos', module: 'billing', requiresPos: true },
    { icon: 'cart-plus', label: 'Purchase', route: '/(main)/billing/create?type=PURCHASE_BILL', module: 'billing' },
    { icon: 'file-document-edit-outline', label: 'Estimate', route: '/(main)/billing/create?type=ESTIMATE', module: 'billing' },
    { icon: 'cash-minus', label: 'Expense', route: '/(main)/accounts/expenses/add', module: 'accounts' },
    { icon: 'package-variant-plus', label: 'Add Item', route: '/(main)/inventory/add-item', module: 'inventory' },
];

export default function HomeScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const user = useAuthStore((state) => state.user);
    const business = useAuthStore((state) => state.business);
    const tier = useAuthStore((state) => state.subscription?.tier ?? 'FREE');
    const subscription = useAuthStore((state) => state.subscription);
    const role = useAuthStore((state) => state.organizationRole);
    const { selection } = useHaptics();

    const { data: summary, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['report-summary', MONTH_START, MONTH_END],
        queryFn: () => reportApi.getSummary({ from: MONTH_START, to: MONTH_END }),
        staleTime: 5 * 60 * 1000,
    });

    const stats = summary?.data as Record<string, number> | undefined;
    const quickActions = QUICK_ACTIONS.filter((action) => {
        if (action.requiresPos && !canUsePos(subscription)) return false;
        return canAccessModule(role, action.module, subscription);
    });

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <AppTopBar
                title={business?.name ?? 'Dashboard'}
                subtitle={`Hello, ${user?.name?.split(' ')[0] ?? 'there'}`}
                rightAction={(
                    <Pressable style={s.tierBadge} onPress={() => router.push('/(main)/more')}>
                        <Text style={s.tierText}>{tier}</Text>
                    </Pressable>
                )}
            />
            <ScrollView
                style={s.scroll}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        refreshing={isRefetching && !isLoading}
                        onRefresh={() => {
                            void refetch();
                        }}
                        tintColor={colors.primary}
                    />
                )}
            >
                <View style={s.section}>
                    <Text style={s.sectionTitle}>This Month</Text>
                    <View style={s.statsGrid}>
                        <StatCard label="Sales" value={stats?.totalSales} prefix="Rs " loading={isLoading} color={colors.success} />
                        <StatCard label="Purchases" value={stats?.totalPurchases} prefix="Rs " loading={isLoading} color={colors.warning} />
                        <StatCard label="Expenses" value={stats?.totalExpenses} prefix="Rs " loading={isLoading} color={colors.error} />
                        <StatCard label="Net Profit" value={stats?.netProfit} prefix="Rs " loading={isLoading} color={colors.primary} />
                    </View>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>Outstanding</Text>
                    <View style={s.row}>
                        <OutstandingCard
                            label="Receivables"
                            value={stats?.outstandingReceivables}
                            loading={isLoading}
                            color={colors.success}
                            onPress={() => router.push('/(main)/parties?tab=customer')}
                        />
                        <OutstandingCard
                            label="Payables"
                            value={stats?.outstandingPayables}
                            loading={isLoading}
                            color={colors.error}
                            onPress={() => router.push('/(main)/parties?tab=supplier')}
                        />
                    </View>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>Quick Create</Text>
                    <View style={s.quickGrid}>
                        {quickActions.map((qa) => (
                            <Pressable
                                key={qa.label}
                                style={({ pressed }) => [s.quickCard, pressed && { opacity: 0.7 }]}
                                onPress={() => {
                                    void selection();
                                    router.push(qa.route as Parameters<typeof router.push>[0]);
                                }}
                                accessibilityRole="button"
                                accessibilityLabel={qa.label}
                            >
                                <MaterialCommunityIcons name={qa.icon} size={18} color={colors.primary} />
                                <Text style={s.quickLabel}>{qa.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                    <Pressable
                        style={({ pressed }) => [
                            s.directoryButton,
                            { backgroundColor: colors.card, borderColor: colors.border },
                            pressed && { opacity: 0.85 },
                        ]}
                        onPress={() => router.push('/(main)/more/screen-directory' as Parameters<typeof router.push>[0])}
                    >
                        <Text style={[s.directoryButtonTitle, { color: colors.text }]}>Open Screen Directory</Text>
                        <Text style={[s.directoryButtonSub, { color: colors.textSecondary }]}>
                            Jump to billing, inventory, reports, settings, legal, and utilities.
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function StatCard({
    label,
    value,
    prefix = '',
    loading,
    color,
}: {
    label: string;
    value?: number;
    prefix?: string;
    loading: boolean;
    color: string;
}) {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);

    return (
        <View style={[statCardStyles.card, { backgroundColor: colors.card }]}>
            <Text style={[statCardStyles.label, { color: colors.textSecondary }]}>{label}</Text>
            {loading ? (
                <View style={[statCardStyles.skeletonVal, { backgroundColor: colors.skeleton }]} />
            ) : (
                <Text style={[statCardStyles.value, { color }]}>
                    {prefix}
                    {(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
            )}
        </View>
    );
}

function OutstandingCard({
    label,
    value,
    loading,
    color,
    onPress,
}: {
    label: string;
    value?: number;
    loading: boolean;
    color: string;
    onPress: () => void;
}) {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);

    return (
        <Pressable style={({ pressed }) => [outStyles.card, { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]} onPress={onPress}>
            <Text style={[outStyles.label, { color: colors.textSecondary }]}>{label}</Text>
            {loading ? (
                <View style={[outStyles.skeleton, { backgroundColor: colors.skeleton }]} />
            ) : (
                <Text style={[outStyles.value, { color }]}>
                    Rs {(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
            )}
        </Pressable>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        scroll: { flex: 1 },
        header: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.lg,
            paddingBottom: Spacing.md,
        },
        greeting: { fontSize: 13, color: colors.textSecondary },
        bizName: { fontSize: 20, fontWeight: '700', color: colors.text },
        tierBadge: {
            backgroundColor: colors.primary,
            paddingHorizontal: Spacing.md,
            paddingVertical: 4,
            borderRadius: Radius.pill,
        },
        tierText: { color: colors.onPrimary, fontWeight: '600', fontSize: 12 },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
        sectionTitle: {
            fontSize: Typography.label.size,
            fontWeight: '600',
            color: colors.textSecondary,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            marginBottom: Spacing.sm,
        },
        statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
        row: { flexDirection: 'row', gap: Spacing.sm },
        quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
        quickCard: {
            backgroundColor: colors.card,
            borderRadius: Radius.card,
            padding: Spacing.md,
            alignItems: 'center',
            width: '30%',
            gap: Spacing.xs,
        },
        quickLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
        directoryButton: {
            borderWidth: 1,
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
            marginTop: Spacing.sm,
        },
        directoryButtonTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        directoryButtonSub: { fontSize: Typography.caption.size, marginTop: 2 },
    });

const statCardStyles = StyleSheet.create({
    card: { borderRadius: Radius.card, padding: Spacing.md, width: '47%', minHeight: 72 },
    label: { fontSize: 12, marginBottom: 4 },
    value: { fontSize: 20, fontWeight: '700' },
    skeletonVal: { height: 24, borderRadius: 4, marginTop: 4 },
});

const outStyles = StyleSheet.create({
    card: { borderRadius: Radius.card, padding: Spacing.md, flex: 1, minHeight: 72 },
    label: { fontSize: 12, marginBottom: 4 },
    value: { fontSize: 20, fontWeight: '700' },
    skeleton: { height: 24, borderRadius: 4, marginTop: 4 },
});
