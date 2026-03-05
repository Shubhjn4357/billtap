import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { godownApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import type { Godown } from '../../../types/domain';
import { useAppDialog } from '@/components/providers/DialogProvider';

export default function GodownsScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const queryClient = useQueryClient();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['godowns'],
        queryFn: () => godownApi.list(),
        staleTime: 60_000,
    });

    const { mutate: deleteGodown } = useMutation({
        mutationFn: (id: string) => godownApi.delete(id),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['godowns'] }),
        onError: (error) => dialog.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete godown.'),
    });

    const godowns = (data?.data ?? []) as Godown[];

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Godowns"
                subtitle="Warehouse and stock location control"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable
                        style={[s.addBtn, { backgroundColor: colors.primary }]}
                        onPress={() => router.push('/(main)/more/godowns/add')}
                    >
                        <MaterialCommunityIcons name="plus" size={16} color={colors.onPrimary} />
                        <Text style={s.addBtnText}>Add</Text>
                    </Pressable>
                )}
            />

            {isLoading ? (
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            ) : godowns.length === 0 ? (
                <View style={s.centered}>
                    <MaterialCommunityIcons name="warehouse" size={52} color={colors.textSecondary} />
                    <Text style={[s.emptyTitle, { color: colors.text }]}>No godowns configured</Text>
                    <Text style={[s.emptyMeta, { color: colors.textSecondary }]}>Add warehouses to track stock location and transfers.</Text>
                    <Pressable
                        style={[s.emptyBtn, { backgroundColor: colors.primary }]}
                        onPress={() => router.push('/(main)/more/godowns/add')}
                    >
                        <MaterialCommunityIcons name="plus" size={16} color={colors.onPrimary} />
                        <Text style={s.emptyBtnText}>Add Godown</Text>
                    </Pressable>
                </View>
            ) : (
                <FlatList
                    data={godowns}
                    keyExtractor={(item) => item.id}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                    contentContainerStyle={{ paddingBottom: 120 }}
                    renderItem={({ item }) => (
                        <Pressable
                            style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}
                            onPress={() => router.push(`/(main)/more/godowns/${item.id}`)}
                            onLongPress={() => dialog.alert('Delete Godown', `Delete "${item.name}"?`, [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Delete', style: 'destructive', onPress: () => deleteGodown(item.id) },
                            ])}
                        >
                            <View style={[s.iconWrap, { backgroundColor: withAlpha(colors.primary, '20') }]}>
                                <MaterialCommunityIcons name="warehouse" size={20} color={colors.primary} />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={[s.rowTitle, { color: colors.text }]}>{item.name}</Text>
                                {item.address ? (
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                                        {item.address}
                                    </Text>
                                ) : null}
                                {item.managerName ? (
                                    <Text style={[s.rowMeta, { color: colors.textSecondary }]} numberOfLines={1}>
                                        Manager: {item.managerName}
                                    </Text>
                                ) : null}
                            </View>
                            <MaterialCommunityIcons name="chevron-right" size={20} color={colors.textSecondary} />
                        </Pressable>
                    )}
                />
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.lg,
            gap: Spacing.sm,
        },
        addBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
        },
        addBtnText: { color: colors.onPrimary, fontSize: Typography.caption.size, fontWeight: '700' },
        emptyTitle: { fontSize: Typography.title.size, fontWeight: '700' },
        emptyMeta: { fontSize: Typography.body.size, textAlign: 'center' },
        emptyBtn: {
            marginTop: Spacing.sm,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6,
        },
        emptyBtnText: { color: colors.onPrimary, fontSize: Typography.body.size, fontWeight: '700' },
        row: {
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.sm,
            borderRadius: Radius.card,
            borderWidth: 1,
            padding: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        iconWrap: {
            width: 40,
            height: 40,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
        },
        rowTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        rowMeta: { fontSize: Typography.caption.size, marginTop: 2 },
    });
