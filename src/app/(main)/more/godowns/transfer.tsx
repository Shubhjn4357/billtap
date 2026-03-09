import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { toUserMessage } from '../../../../api/client';
import { DESIGN_SPACING } from '../../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { FormHero, FormSectionCard } from '../../../../components/ui/FormBlocks';
import { SelectField, type SelectOption } from '../../../../components/ui/SelectField';
import { AppInput } from '../../../../components/ui/AppInput';
import { useGodowns } from '../../../../hooks/useGodowns';
import { useItemCatalog } from '../../../../hooks/useInventory';
import { useGodownMutations } from '../../../../hooks/useGodownMutations';
import { useAppDialog } from '@/components/providers/DialogProvider';

export default function GodownTransferScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const params = useLocalSearchParams<{
        fromGodownId?: string;
        toGodownId?: string;
        itemId?: string;
    }>();
    const smartBack = useSmartBack('/(main)/more/godowns');
    const [fromGodownId, setFromGodownId] = useState<string | null>(null);
    const [toGodownId, setToGodownId] = useState<string | null>(null);
    const [itemId, setItemId] = useState<string | null>(null);
    const [quantity, setQuantity] = useState('1');
    const [notes, setNotes] = useState('');

    const {
        godowns,
        isLoading: godownsLoading,
        isRefetching: godownsRefetching,
        refetch: refetchGodowns,
    } = useGodowns();
    const {
        items,
        isLoading: itemsLoading,
        isRefetching: itemsRefetching,
        refetch: refetchItems,
    } = useItemCatalog({ limit: 400 });
    const { transferGodownStock, isTransferringGodownStock } = useGodownMutations();

    const normalizedFromParam = Array.isArray(params.fromGodownId) ? params.fromGodownId[0] : params.fromGodownId;
    const normalizedToParam = Array.isArray(params.toGodownId) ? params.toGodownId[0] : params.toGodownId;
    const normalizedItemParam = Array.isArray(params.itemId) ? params.itemId[0] : params.itemId;

    useEffect(() => {
        if (fromGodownId || godowns.length === 0) return;
        if (normalizedFromParam) {
            setFromGodownId(normalizedFromParam);
            return;
        }
        const defaultGodown = godowns.find((entry) => entry.isDefault) ?? godowns[0];
        setFromGodownId(defaultGodown?.id ?? null);
    }, [fromGodownId, godowns, normalizedFromParam]);

    useEffect(() => {
        if (itemId || !normalizedItemParam) return;
        setItemId(normalizedItemParam);
    }, [itemId, normalizedItemParam]);

    useEffect(() => {
        if (toGodownId || godowns.length < 2) return;
        if (normalizedToParam) {
            setToGodownId(normalizedToParam);
            return;
        }
        const nextGodown = godowns.find((entry) => entry.id !== fromGodownId) ?? null;
        setToGodownId(nextGodown?.id ?? null);
    }, [fromGodownId, godowns, normalizedToParam, toGodownId]);

    const godownOptions = useMemo<SelectOption[]>(
        () =>
            godowns.map((godown) => ({
                label: godown.name,
                value: godown.id,
                description: godown.isDefault ? 'Default godown' : godown.address ?? 'Stock location',
            })),
        [godowns]
    );
    const itemOptions = useMemo<SelectOption[]>(
        () =>
            items.map((item) => ({
                label: item.name,
                value: item.id,
                description: `${item.stock} ${item.unit ?? 'units'} available`,
            })),
        [items]
    );

    const isLoading = godownsLoading || itemsLoading;
    const isRefreshing = godownsRefetching || itemsRefetching;

    if (isLoading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Transfer Stock"
                subtitle="Move item quantity between godowns"
                onBackPress={smartBack}
            />

            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            void Promise.all([refetchGodowns(), refetchItems()]);
                        }}
                    />
                )}
            >
                <View style={s.heroWrap}>
                    <FormHero
                        title="Transfer Stock"
                        subtitle="Move item quantities between godowns without leaving the stock workflow."
                        icon="swap-horizontal"
                        tone="info"
                    />
                </View>

                <FormSectionCard
                    title="Transfer Details"
                    description="Choose source and destination godowns, then move the selected item quantity."
                    tone="info"
                >
                        <SelectField
                            value={fromGodownId}
                            onChange={(value) => {
                                setFromGodownId(value);
                                if (value && value === toGodownId) {
                                    const alternative = godowns.find((entry) => entry.id !== value);
                                    setToGodownId(alternative?.id ?? null);
                                }
                            }}
                            options={godownOptions}
                            title="From Godown"
                            placeholder="Select source godown"
                        />

                        <SelectField
                            value={toGodownId}
                            onChange={setToGodownId}
                            options={godownOptions.filter((entry) => entry.value !== fromGodownId)}
                            title="To Godown"
                            placeholder="Select destination godown"
                        />

                        <SelectField
                            value={itemId}
                            onChange={setItemId}
                            options={itemOptions}
                            title="Item"
                            placeholder="Select item to transfer"
                        />

                        <AppInput
                            inputType="decimal"
                            value={quantity}
                            onChangeText={setQuantity}
                            placeholder="Quantity"
                        />

                        <AppInput
                            inputType="text"
                            value={notes}
                            onChangeText={setNotes}
                            placeholder="Notes (optional)"
                        />

                        <Pressable
                            style={[s.submitBtn, { backgroundColor: colors.primary }]}
                            disabled={isTransferringGodownStock}
                            onPress={() => {
                                const qty = Number(quantity);
                                if (!fromGodownId || !toGodownId || !itemId) {
                                    dialog.alert('Validation', 'Select source, destination, and item first.');
                                    return;
                                }
                                if (fromGodownId === toGodownId) {
                                    dialog.alert('Validation', 'Source and destination godowns must differ.');
                                    return;
                                }
                                if (!Number.isFinite(qty) || qty <= 0) {
                                    dialog.alert('Validation', 'Enter a valid quantity greater than zero.');
                                    return;
                                }

                                void transferGodownStock({
                                    fromGodownId,
                                    toGodownId,
                                    itemId,
                                    quantity: qty,
                                    notes: notes.trim() || undefined,
                                })
                                    .then(() => {
                                        dialog.alert('Transfer queued', 'Stock transfer saved locally. Sync pending.', [
                                            {
                                                text: 'OK',
                                                onPress: () => {
                                                    router.back();
                                                },
                                            },
                                        ]);
                                    })
                                    .catch((error) => {
                                        dialog.alert('Transfer failed', toUserMessage(error, 'Unable to transfer stock.'));
                                    });
                            }}
                        >
                            {isTransferringGodownStock ? (
                                <ActivityIndicator color={colors.onPrimary} size="small" />
                            ) : (
                                <>
                                    <MaterialCommunityIcons name="swap-horizontal" size={16} color={colors.onPrimary} />
                                    <Text style={s.submitText}>Save Transfer</Text>
                                </>
                            )}
                        </Pressable>
                </FormSectionCard>
            </ScrollView>
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
        },
        content: {
            paddingHorizontal: DESIGN_SPACING.screenX,
            paddingTop: Spacing.sm,
            paddingBottom: Spacing.xl,
            gap: DESIGN_SPACING.cardGap,
        },
        heroWrap: { marginBottom: Spacing.xs },
        submitBtn: {
            marginTop: Spacing.sm,
            borderRadius: Radius.pill,
            paddingVertical: Spacing.sm,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: 6,
        },
        submitText: {
            color: colors.onPrimary,
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
    });
