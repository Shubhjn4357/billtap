// @ts-nocheck
import { View, Text, ScrollView, StyleSheet, Pressable, useColorScheme } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../store/authStore';
import { getColors, Spacing, Radius, Typography, type ColorPalette } from '../../constants/theme';
import { reportApi } from '../../api/endpoints';
import { format } from 'date-fns';

const TODAY = new Date();
const MONTH_START = format(startOfMonth(TODAY), 'yyyy-MM-dd');
const MONTH_END = format(endOfMonth(TODAY), 'yyyy-MM-dd');

export default function HomeScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    const user = useAuthStore((s) => s.user);
    const business = useAuthStore((s) => s.business);
    const tier = useAuthStore((s) => s.subscription?.tier ?? 'FREE');

    const { data: summary, isLoading } = useQuery({
        queryKey: ['report-summary', MONTH_START, MONTH_END],
        queryFn: () => reportApi.getSummary({ from: MONTH_START, to: MONTH_END }),
        staleTime: 5 * 60 * 1000,
    });

    const s = styles(colors);
    const stats = summary?.data as Record<string, number> | undefined;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <ScrollView style={s.scroll} showsVerticalScrollIndicator={false}>
                {/* Header */}
                <View style={s.header}>
                    <View>
                        <Text style={s.greeting}>Hey, {user?.name?.split(' ')[0] ?? 'there'} 👋</Text>
                        <Text style={s.bizName}>{business?.name ?? 'My Business'}</Text>
                    </View>
                    <Pressable style={s.tierBadge} onPress={() => router.push('/(main)/more')}>
                        <Text style={s.tierText}>{tier}</Text>
                    </Pressable>
                </View>

                {/* This month summary */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>This Month</Text>
                    <View style={s.statsGrid}>
                        <StatCard label="Sales" value={stats?.totalSales} prefix="₹" loading={isLoading} color={colors.success} />
                        <StatCard label="Purchases" value={stats?.totalPurchases} prefix="₹" loading={isLoading} color={colors.warning} />
                        <StatCard label="Expenses" value={stats?.totalExpenses} prefix="₹" loading={isLoading} color={colors.error} />
                        <StatCard label="Net Profit" value={stats?.netProfit} prefix="₹" loading={isLoading} color={colors.primary} />
                    </View>
                </View>

                {/* Outstanding */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Outstanding</Text>
                    <View style={s.row}>
                        <OutstandingCard label="Receivables" value={stats?.outstandingReceivables} loading={isLoading} color={colors.success} onPress={() => router.push('/(main)/parties?tab=customer')} />
                        <OutstandingCard label="Payables" value={stats?.outstandingPayables} loading={isLoading} color={colors.error} onPress={() => router.push('/(main)/parties?tab=supplier')} />
                    </View>
                </View>

                {/* Quick Actions */}
                <View style={s.section}>
                    <Text style={s.sectionTitle}>Quick Create</Text>
                    <View style={s.quickGrid}>
                        {QUICK_ACTIONS.map((qa) => (
                            <Pressable
                                key={qa.label}
                                style={({ pressed }) => [s.quickCard, pressed && { opacity: 0.7 }]}
                                onPress={() => router.push(qa.route as Parameters<typeof router.push>[0])}
                                accessibilityRole="button"
                                accessibilityLabel={qa.label}
                            >
                                <Text style={s.quickIcon}>{qa.icon}</Text>
                                <Text style={s.quickLabel}>{qa.label}</Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function StatCard({ label, value, prefix = '', loading, color }: { label: string; value?: number; prefix?: string; loading: boolean; color: string }) {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    return (
        <View style={[statCardStyles.card, { backgroundColor: colors.card }]}>
            <Text style={[statCardStyles.label, { color: colors.textSecondary }]}>{label}</Text>
            {loading ? (
                <View style={[statCardStyles.skeletonVal, { backgroundColor: colors.skeleton }]} />
            ) : (
                <Text style={[statCardStyles.value, { color }]}>
                    {prefix}{(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
            )}
        </View>
    );
}

function OutstandingCard({ label, value, loading, color, onPress }: { label: string; value?: number; loading: boolean; color: string; onPress: () => void }) {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme];
    return (
        <Pressable style={({ pressed }) => [outStyles.card, { backgroundColor: colors.card, opacity: pressed ? 0.8 : 1 }]} onPress={onPress}>
            <Text style={[outStyles.label, { color: colors.textSecondary }]}>{label}</Text>
            {loading ? (
                <View style={[outStyles.skeleton, { backgroundColor: colors.skeleton }]} />
            ) : (
                <Text style={[outStyles.value, { color }]}>
                    ₹{(value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                </Text>
            )}
        </Pressable>
    );
}

const QUICK_ACTIONS = [
    { icon: '🧾', label: 'Invoice', route: '/(main)/billing?type=TAX_INVOICE' },
    { icon: '🛒', label: 'Sale', route: '/(main)/billing?type=TAX_INVOICE' },
    { icon: '🏪', label: 'POS', route: '/(main)/billing/pos' },
    { icon: '📥', label: 'Purchase', route: '/(main)/billing?type=PURCHASE_BILL' },
    { icon: '📝', label: 'Estimate', route: '/(main)/billing?type=ESTIMATE' },
    { icon: '💸', label: 'Expense', route: '/(main)/accounts/expense-add' },
];

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    scroll: { flex: 1 },
    header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingTop: Spacing.lg, paddingBottom: Spacing.md },
    greeting: { fontSize: 13, color: colors.textSecondary },
    bizName: { fontSize: 20, fontWeight: '700', color: colors.text },
    tierBadge: { backgroundColor: colors.primary, paddingHorizontal: Spacing.md, paddingVertical: 4, borderRadius: Radius.pill },
    tierText: { color: '#fff', fontWeight: '600', fontSize: 12 },
    section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.xl },
    sectionTitle: { fontSize: Typography.label.size, fontWeight: '600', color: colors.textSecondary, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: Spacing.sm },
    statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    row: { flexDirection: 'row', gap: Spacing.sm },
    quickGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
    quickCard: { backgroundColor: colors.card, borderRadius: Radius.card, padding: Spacing.md, alignItems: 'center', width: '30%', gap: Spacing.xs },
    quickIcon: { fontSize: 26 },
    quickLabel: { fontSize: 11, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
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


