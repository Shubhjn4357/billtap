import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DESIGN_SPACING } from '../../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette } from '../../../../constants/theme';
import { useAppColors } from '../../../../hooks/useAppColors';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../components/ui/AppInput';
import { FormHero, FormSectionCard } from '../../../../components/ui/FormBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useInvoiceBuilderStore } from '../../../../store/invoiceBuilderStore';
import { useGodownMutations } from '../../../../hooks/useGodownMutations';

export default function AddGodownScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const { returnContext } = useLocalSearchParams<{ returnContext?: string }>();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');

    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [isDefault, setIsDefault] = useState(false);
    const setDefaultGodownId = useInvoiceBuilderStore((state) => state.setDefaultGodownId);

    const { saveGodown: createGodown, isSavingGodown: isPending } = useGodownMutations();

    const onSave = async () => {
        if (!name.trim()) {
            dialog.alert('Validation', 'Godown name is required.');
            return;
        }

        try {
            const result = await createGodown({ name: name.trim(), address: address.trim() || undefined, isDefault });
            if (returnContext === 'invoice' && result.data?.id) {
                setDefaultGodownId(result.data.id);
            }
            router.back();
        } catch (error) {
            dialog.alert('Create failed', error instanceof Error ? error.message : 'Unable to create godown.');
        }
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Add Godown"
                subtitle="Create a warehouse location"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={() => void onSave()} disabled={isPending}>
                        {isPending ? (
                            <ActivityIndicator size="small" color={colors.onPrimary} />
                        ) : (
                            <MaterialCommunityIcons name="content-save-outline" size={16} color={colors.onPrimary} />
                        )}
                    </Pressable>
                )}
            />

            <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
                <View style={s.heroWrap}>
                    <FormHero
                        title="Create Godown"
                        subtitle="Add a warehouse or stock location and optionally set it as the default for new stock entries."
                        icon="warehouse"
                        tone="info"
                    />
                </View>

                <FormSectionCard
                    title="Location Details"
                    description="Define the godown name, address, and whether it should become the default location."
                    tone="info"
                >
                    <AppInput
                        label="Godown Name"
                        inputType="name"
                        value={name}
                        onChangeText={setName}
                        placeholder="Main warehouse"
                    />

                    <AppInput
                        label="Address"
                        inputType="text"
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Address (optional)"
                        multiline
                        numberOfLines={3}
                        style={s.multilineInput}
                    />

                    <View style={s.switchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={[s.switchTitle, { color: colors.text }]}>Set As Default</Text>
                            <Text style={[s.switchMeta, { color: colors.textSecondary }]}>Used as the default stock location for new entries.</Text>
                        </View>
                        <Switch
                            value={isDefault}
                            onValueChange={setIsDefault}
                            trackColor={{ true: colors.primary, false: colors.border }}
                        />
                    </View>
                </FormSectionCard>
                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        saveBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 7,
            alignItems: 'center',
            minWidth: 44,
            justifyContent: 'center',
        },
        content: { paddingHorizontal: DESIGN_SPACING.screenX, paddingTop: Spacing.sm, gap: DESIGN_SPACING.cardGap },
        heroWrap: { marginBottom: Spacing.xs },
        multilineInput: { minHeight: 72, textAlignVertical: 'top' },
        switchRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.md,
        },
        switchTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        switchMeta: { fontSize: Typography.caption.size, marginTop: 2 },
    });
