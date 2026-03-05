import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../../hooks/useSmartBack';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { godownApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../../../constants/theme';
import { AppTopBar } from '../../../../components/ui/AppTopBar';
import { AppInput } from '../../../../components/ui/AppInput';
import { useAppDialog } from '@/components/providers/DialogProvider';

export default function AddGodownScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');
    const queryClient = useQueryClient();

    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [isDefault, setIsDefault] = useState(false);

    const { mutateAsync: createGodown, isPending } = useMutation({
        mutationFn: () => godownApi.create({ name: name.trim(), address: address.trim() || undefined, isDefault }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['godowns'] }),
    });

    const onSave = async () => {
        if (!name.trim()) {
            dialog.alert('Validation', 'Godown name is required.');
            return;
        }

        try {
            await createGodown();
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

            <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
            </View>
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
        card: {
            marginHorizontal: Spacing.lg,
            marginTop: Spacing.sm,
            borderRadius: Radius.card,
            borderWidth: 1,
            padding: Spacing.md,
            gap: Spacing.md,
        },
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
