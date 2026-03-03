import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { godownApi } from '../../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../../constants/theme';

export default function AddGodownScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);
    const qc = useQueryClient();

    const [name, setName] = useState('');
    const [address, setAddress] = useState('');
    const [isDefault, setIsDefault] = useState(false);

    const { mutateAsync: createGodown, isPending } = useMutation({
        mutationFn: () => godownApi.create({ name: name.trim(), address: address.trim() || undefined, isDefault }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['godowns'] }),
    });

    const onSave = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            Alert.alert('Validation', 'Godown name is required.');
            return;
        }

        try {
            await createGodown();
            router.back();
        } catch (error) {
            Alert.alert('Create failed', error instanceof Error ? error.message : 'Unable to create godown.');
        }
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>{'< Back'}</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>Add Godown</Text>
                <View style={{ width: 58 }} />
            </View>

            <View style={[s.card, { backgroundColor: colors.card }]}> 
                <Text style={[s.label, { color: colors.text }]}>Godown Name</Text>
                <TextInput
                    style={[s.input, { borderColor: colors.border, color: colors.text }]}
                    value={name}
                    onChangeText={setName}
                    placeholder="Main warehouse"
                    placeholderTextColor={colors.textSecondary}
                />

                <Text style={[s.label, { color: colors.text }]}>Address</Text>
                <TextInput
                    style={[s.input, s.addressInput, { borderColor: colors.border, color: colors.text }]}
                    value={address}
                    onChangeText={setAddress}
                    placeholder="Address (optional)"
                    placeholderTextColor={colors.textSecondary}
                    multiline
                />

                <View style={s.switchRow}>
                    <Text style={[s.label, { color: colors.text }]}>Set as default</Text>
                    <Switch value={isDefault} onValueChange={setIsDefault} trackColor={{ true: colors.primary, false: colors.border }} />
                </View>

                <Pressable style={[s.saveBtn, { backgroundColor: colors.primary }]} onPress={onSave} disabled={isPending}>
                    {isPending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.saveBtnText}>Save Godown</Text>}
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        back: { width: 58, fontWeight: '600', fontSize: 14 },
        title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 16 },
        card: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md },
        label: { fontWeight: '600', fontSize: 13, marginBottom: 6 },
        input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14, marginBottom: Spacing.md },
        addressInput: { minHeight: 72, textAlignVertical: 'top' },
        switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
        saveBtn: { borderRadius: Radius.pill, alignItems: 'center', paddingVertical: Spacing.sm },
        saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
    });
