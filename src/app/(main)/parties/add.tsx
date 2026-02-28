// @ts-nocheck
import { useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { partyApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import {
    COUNTRY_DIAL_CODES,
    DEFAULT_COUNTRY_DIAL_CODE,
    DEFAULT_COUNTRY_ISO2,
    findCountryByDialCode,
    findCountryByIso2,
    type CountryDialCode,
} from '../../../constants/countryDialCodes';
import { buildE164PhoneNumber, sanitizePhoneLocal } from '../../../utils/phone';

const partySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.enum(['CUSTOMER', 'SUPPLIER']),
    countryIso2: z.string().default(DEFAULT_COUNTRY_ISO2),
    dialCode: z.string().default(DEFAULT_COUNTRY_DIAL_CODE),
    phone: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    gstin: z.string().max(15).optional(),
    billingAddress: z.string().optional(),
    creditLimit: z.coerce.number().nonnegative().default(0),
    openingBalance: z.coerce.number().default(0),
});
type PartyForm = z.infer<typeof partySchema>;

export default function AddPartyScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const { type: defaultType, id: editId } = useLocalSearchParams<{ type?: string; id?: string }>();
    const qc = useQueryClient();
    const s = styles(colors);

    const [countryPickerVisible, setCountryPickerVisible] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');

    const {
        control,
        handleSubmit,
        formState: { errors },
        watch,
        setValue,
    } = useForm<PartyForm>({
        resolver: zodResolver(partySchema),
        defaultValues: {
            type: (defaultType as 'CUSTOMER' | 'SUPPLIER') ?? 'CUSTOMER',
            name: '',
            countryIso2: DEFAULT_COUNTRY_ISO2,
            dialCode: DEFAULT_COUNTRY_DIAL_CODE,
            creditLimit: 0,
            openingBalance: 0,
        },
    });

    const selectedIso2 = watch('countryIso2');
    const selectedDialCode = watch('dialCode');
    const partyType = watch('type');

    const selectedCountry = useMemo(
        () => findCountryByIso2(selectedIso2 ?? '') ?? findCountryByDialCode(selectedDialCode ?? DEFAULT_COUNTRY_DIAL_CODE),
        [selectedIso2, selectedDialCode],
    );

    const filteredCountries = useMemo(() => {
        const needle = countrySearch.trim().toLowerCase();
        if (!needle) return COUNTRY_DIAL_CODES;

        return COUNTRY_DIAL_CODES.filter(
            (entry) =>
                entry.iso2.toLowerCase().includes(needle) ||
                entry.name.toLowerCase().includes(needle) ||
                entry.dialCode.includes(needle),
        );
    }, [countrySearch]);

    const { mutate, isPending } = useMutation({
        mutationFn: (data: PartyForm) => {
            const normalizedPhone = data.phone?.trim()
                ? buildE164PhoneNumber(data.dialCode ?? DEFAULT_COUNTRY_DIAL_CODE, data.phone)
                : null;

            return partyApi.create({
                type: data.type,
                name: data.name.trim(),
                phone: normalizedPhone || null,
                email: data.email?.trim() || null,
                gstin: data.gstin?.trim().toUpperCase() || null,
                billingAddress: data.billingAddress?.trim() || null,
                shippingAddress: null,
                openingBalance: data.openingBalance,
                creditLimit: data.creditLimit,
                isActive: true,
            });
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['parties'] });
            router.back();
        },
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save party'),
    });

    const onCountrySelect = (entry: CountryDialCode) => {
        setValue('countryIso2', entry.iso2);
        setValue('dialCode', entry.dialCode);
        setCountryPickerVisible(false);
        setCountrySearch('');
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>{editId ? 'Edit Party' : 'Add Party'}</Text>
                <Pressable onPress={handleSubmit((d) => mutate(d))} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1 }}>
                <View style={s.typeRow}>
                    {(['CUSTOMER', 'SUPPLIER'] as const).map((t) => (
                        <Pressable
                            key={t}
                            style={[s.typeChip, partyType === t && { backgroundColor: colors.primary }]}
                            onPress={() => setValue('type', t)}
                        >
                            <Text style={[s.typeText, { color: partyType === t ? '#fff' : colors.textSecondary }]}>
                                {t === 'CUSTOMER' ? 'Customer' : 'Supplier'}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                <View style={s.form}>
                    <FormField label="Name *" error={errors.name?.message} colors={colors}>
                        <Controller
                            control={control}
                            name="name"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[s.input, { color: colors.text, borderColor: errors.name ? colors.error : colors.border }]}
                                    value={value}
                                    onChangeText={onChange}
                                    placeholder="Party name"
                                    placeholderTextColor={colors.textSecondary}
                                />
                            )}
                        />
                    </FormField>

                    <FormField label="Phone" colors={colors}>
                        <View style={s.phoneRow}>
                            <Pressable
                                style={[s.dialCodeButton, { borderColor: colors.border, backgroundColor: colors.surfaceVariant }]}
                                onPress={() => setCountryPickerVisible(true)}
                            >
                                <Text style={[s.dialCodeIso, { color: colors.textSecondary }]}>{selectedCountry?.iso2 ?? 'CC'}</Text>
                                <Text style={[s.dialCodeValue, { color: colors.text }]}>{selectedDialCode || DEFAULT_COUNTRY_DIAL_CODE}</Text>
                            </Pressable>

                            <Controller
                                control={control}
                                name="phone"
                                render={({ field: { onChange, value } }) => (
                                    <TextInput
                                        style={[s.input, s.phoneInput, { color: colors.text, borderColor: colors.border }]}
                                        value={value}
                                        onChangeText={(text) => onChange(sanitizePhoneLocal(text))}
                                        placeholder="Mobile number"
                                        placeholderTextColor={colors.textSecondary}
                                        keyboardType="phone-pad"
                                    />
                                )}
                            />
                        </View>
                    </FormField>

                    <FormField label="Email" colors={colors}>
                        <Controller
                            control={control}
                            name="email"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[s.input, { color: colors.text, borderColor: colors.border }]}
                                    value={value}
                                    onChangeText={onChange}
                                    placeholder="email@example.com"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                />
                            )}
                        />
                    </FormField>

                    <FormField label="GSTIN" colors={colors}>
                        <Controller
                            control={control}
                            name="gstin"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[s.input, { color: colors.text, borderColor: colors.border }]}
                                    value={value}
                                    onChangeText={onChange}
                                    placeholder="22AAAAA0000A1Z5"
                                    placeholderTextColor={colors.textSecondary}
                                    autoCapitalize="characters"
                                    maxLength={15}
                                />
                            )}
                        />
                    </FormField>

                    <FormField label="Billing Address" colors={colors}>
                        <Controller
                            control={control}
                            name="billingAddress"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[s.input, s.multiline, { color: colors.text, borderColor: colors.border }]}
                                    value={value}
                                    onChangeText={onChange}
                                    placeholder="Full address"
                                    placeholderTextColor={colors.textSecondary}
                                    multiline
                                    numberOfLines={3}
                                    textAlignVertical="top"
                                />
                            )}
                        />
                    </FormField>

                    <FormField label="Opening Balance (INR)" colors={colors}>
                        <Controller
                            control={control}
                            name="openingBalance"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[s.input, { color: colors.text, borderColor: colors.border }]}
                                    value={String(value)}
                                    onChangeText={onChange}
                                    placeholder="0"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="numeric"
                                />
                            )}
                        />
                    </FormField>

                    <FormField label="Credit Limit (INR)" colors={colors}>
                        <Controller
                            control={control}
                            name="creditLimit"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={[s.input, { color: colors.text, borderColor: colors.border }]}
                                    value={String(value)}
                                    onChangeText={onChange}
                                    placeholder="0"
                                    placeholderTextColor={colors.textSecondary}
                                    keyboardType="numeric"
                                />
                            )}
                        />
                    </FormField>
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>

            <Modal visible={countryPickerVisible} animationType="slide" transparent onRequestClose={() => setCountryPickerVisible(false)}>
                <Pressable style={s.modalOverlay} onPress={() => setCountryPickerVisible(false)}>
                    <Pressable style={[s.modalCard, { backgroundColor: colors.surface }]} onPress={() => null}>
                        <Text style={[s.modalTitle, { color: colors.text }]}>Select Country Code</Text>
                        <TextInput
                            style={[s.input, { color: colors.text, borderColor: colors.border, marginBottom: Spacing.sm }]}
                            value={countrySearch}
                            onChangeText={setCountrySearch}
                            placeholder="Search country or code"
                            placeholderTextColor={colors.textSecondary}
                        />
                        <FlatList
                            data={filteredCountries}
                            keyExtractor={(item) => `${item.iso2}-${item.dialCode}`}
                            keyboardShouldPersistTaps="handled"
                            style={s.countryList}
                            renderItem={({ item }) => {
                                const isSelected = item.iso2 === selectedCountry?.iso2 && item.dialCode === selectedDialCode;
                                return (
                                    <Pressable
                                        style={[s.countryItem, { borderBottomColor: colors.border }]}
                                        onPress={() => onCountrySelect(item)}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <Text style={[s.countryName, { color: colors.text }]}>{item.name}</Text>
                                            <Text style={[s.countryMeta, { color: colors.textSecondary }]}>{item.iso2}</Text>
                                        </View>
                                        <Text style={[s.countryDial, { color: colors.text }]}>{item.dialCode}</Text>
                                        {isSelected ? <Text style={[s.countryCheck, { color: colors.primary }]}>Selected</Text> : null}
                                    </Pressable>
                                );
                            }}
                        />
                    </Pressable>
                </Pressable>
            </Modal>
        </SafeAreaView>
    );
}

function FormField({ label, children, error, colors }: { label: string; children: React.ReactNode; error?: string; colors: ColorPalette }) {
    return (
        <View style={{ marginBottom: Spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
            {children}
            {error ? <Text style={{ color: colors.error, fontSize: 11, marginTop: 2 }}>{error}</Text> : null}
        </View>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
        },
        back: { fontWeight: '600', fontSize: 14 },
        title: { fontWeight: '700', fontSize: 17, flex: 1, textAlign: 'center' },
        save: { fontWeight: '700', fontSize: 15 },
        typeRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        typeChip: {
            flex: 1,
            backgroundColor: colors.surfaceVariant,
            borderRadius: Radius.pill,
            paddingVertical: Spacing.sm,
            alignItems: 'center',
        },
        typeText: { fontWeight: '600', fontSize: 14 },
        form: { paddingHorizontal: Spacing.lg },
        input: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, fontSize: 14 },
        multiline: { minHeight: 80 },
        phoneRow: { flexDirection: 'row', gap: Spacing.sm },
        dialCodeButton: {
            minWidth: 92,
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.sm,
            paddingVertical: Spacing.sm,
            justifyContent: 'center',
        },
        dialCodeIso: { fontSize: 11, fontWeight: '600' },
        dialCodeValue: { fontSize: 14, fontWeight: '700' },
        phoneInput: { flex: 1 },
        modalOverlay: {
            flex: 1,
            backgroundColor: '#00000066',
            justifyContent: 'flex-end',
        },
        modalCard: {
            maxHeight: '80%',
            borderTopLeftRadius: Radius.lg,
            borderTopRightRadius: Radius.lg,
            padding: Spacing.lg,
        },
        modalTitle: {
            fontSize: 16,
            fontWeight: '700',
            marginBottom: Spacing.sm,
        },
        countryList: { flexGrow: 0 },
        countryItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            paddingVertical: Spacing.sm,
            borderBottomWidth: 1,
        },
        countryName: { fontSize: 14, fontWeight: '600' },
        countryMeta: { fontSize: 12 },
        countryDial: { fontSize: 14, fontWeight: '700' },
        countryCheck: { fontSize: 12, fontWeight: '600' },
    });
