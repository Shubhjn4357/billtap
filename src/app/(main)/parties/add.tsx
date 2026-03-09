import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { toUserMessage } from '../../../api/client';
import { Spacing, Radius, type ColorPalette, withAlpha } from '../../../constants/theme';
import { PartyType } from '../../../constants/enums';
import { PARTY_TYPE_OPTIONS } from '../../../constants/formOptions';
import { useAppColors } from '../../../hooks/useAppColors';
import { useAuthStore } from '../../../store/authStore';
import { canPerformAction } from '../../../utils/accessControl';
import {
    COUNTRY_DIAL_CODES,
    DEFAULT_COUNTRY_DIAL_CODE,
    DEFAULT_COUNTRY_ISO2,
    findCountryByDialCode,
    findCountryByIso2,
    type CountryDialCode,
} from '../../../constants/countryDialCodes';
import { buildE164PhoneNumber, sanitizePhoneLocal, splitPhoneNumber } from '../../../utils/phone';
import { AppInput } from '../../../components/ui/AppInput';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { FormHero, FormSectionCard } from '../../../components/ui/FormBlocks';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useInvoiceBuilderStore } from '../../../store/invoiceBuilderStore';
import { usePartyDetails } from '../../../hooks/usePartyDetails';
import { usePartyMutations } from '../../../hooks/usePartyMutations';

const partySchema = z.object({
    name: z.string().min(1, 'Name is required'),
    type: z.enum([PartyType.CUSTOMER, PartyType.SUPPLIER]),
    countryIso2: z.string().default(DEFAULT_COUNTRY_ISO2),
    dialCode: z.string().default(DEFAULT_COUNTRY_DIAL_CODE),
    phone: z.string().optional(),
    email: z.string().email('Invalid email').optional().or(z.literal('')),
    gstin: z.string().max(15).optional(),
    billingAddress: z.string().optional(),
    creditLimit: z.coerce.number().nonnegative().default(0),
    openingBalance: z.coerce.number().default(0),
});
type PartyFormInput = z.input<typeof partySchema>;
type PartyForm = z.output<typeof partySchema>;

export default function AddPartyScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const { type: defaultType, id: editId, returnContext } = useLocalSearchParams<{
        type?: string;
        id?: string;
        returnContext?: string;
    }>();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/parties');
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const canSaveParty = canPerformAction(role, editId ? 'party.update' : 'party.create', subscription);
    const { selection } = useHaptics();
    const setInvoiceParty = useInvoiceBuilderStore((state) => state.setParty);
    const { party: existingParty, isLoading: existingPartyLoading } = usePartyDetails(editId, {
        enabled: Boolean(editId),
        staleTime: 30_000,
    });
    const { saveParty, isSavingParty: isPending } = usePartyMutations();

    const [countryPickerVisible, setCountryPickerVisible] = useState(false);
    const [countrySearch, setCountrySearch] = useState('');

    const {
        control,
        handleSubmit,
        formState: { errors },
        watch,
        setValue,
    } = useForm<PartyFormInput, unknown, PartyForm>({
        resolver: zodResolver(partySchema),
        defaultValues: {
            type: (defaultType as typeof PartyType[keyof typeof PartyType]) ?? PartyType.CUSTOMER,
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

    useEffect(() => {
        if (!existingParty) return;
        const splitPhone = splitPhoneNumber(existingParty.phone ?? '');
        setValue('type', existingParty.type);
        setValue('name', existingParty.name);
        setValue('countryIso2', findCountryByDialCode(splitPhone.dialCode)?.iso2 ?? DEFAULT_COUNTRY_ISO2);
        setValue('dialCode', splitPhone.dialCode);
        setValue('phone', splitPhone.localNumber);
        setValue('email', existingParty.email ?? '');
        setValue('gstin', existingParty.gstin ?? '');
        setValue('billingAddress', existingParty.billingAddress ?? '');
        setValue('creditLimit', Number(existingParty.creditLimit ?? 0));
        setValue('openingBalance', Number(existingParty.openingBalance ?? 0));
    }, [existingParty, setValue]);

    const onCountrySelect = (entry: CountryDialCode) => {
        setValue('countryIso2', entry.iso2);
        setValue('dialCode', entry.dialCode);
        setCountryPickerVisible(false);
        setCountrySearch('');
    };

    const onSave = async (data: PartyForm) => {
        if (!canSaveParty) {
            throw new Error(`Your role does not have permission to ${editId ? 'update' : 'create'} parties.`);
        }
        const normalizedPhone = data.phone?.trim()
            ? buildE164PhoneNumber(data.dialCode ?? DEFAULT_COUNTRY_DIAL_CODE, data.phone)
            : null;

        return saveParty({
            ...(editId ? { id: editId } : {}),
            data: {
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
            },
        });
    };

    if (editId && existingPartyLoading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.loadingWrap}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={editId ? 'Edit Party' : 'Add Party'}
                subtitle={partyType === 'CUSTOMER' ? 'Customer details' : 'Supplier details'}
                onBackPress={smartBack}
                rightAction={(
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={editId ? 'Save party changes' : 'Save party'}
                        onPress={handleSubmit((data) => {
                            if (!canSaveParty) {
                                dialog.alert('Access denied', `Your role cannot ${editId ? 'update' : 'create'} parties.`);
                                return;
                            }
                            void selection();
                            void onSave(data)
                                .then((result) => {
                                    if (returnContext === 'invoice' && result.data) {
                                        setInvoiceParty(result.data.id, {
                                            id: result.data.id,
                                            type: result.data.type,
                                            name: result.data.name,
                                            phone: result.data.phone ?? null,
                                            email: result.data.email ?? null,
                                            gstin: result.data.gstin ?? null,
                                            billingAddress: result.data.billingAddress ?? null,
                                            shippingAddress: result.data.shippingAddress ?? null,
                                        });
                                    }
                                    router.back();
                                })
                                .catch((error) => dialog.alert('Error', toUserMessage(error, 'Failed to save party.')));
                        })}
                        disabled={isPending || !canSaveParty}
                    >
                        {isPending ? <ActivityIndicator color={colors.primary} /> : <MaterialCommunityIcons name="content-save-outline" size={20} color={colors.primary} />}
                    </Pressable>
                )}
            />

            <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <ScrollView keyboardShouldPersistTaps="handled" style={s.flex}>
                    <View style={s.heroWrap}>
                        <FormHero
                            title={editId ? 'Edit Party' : 'Create Party'}
                            subtitle={partyType === 'CUSTOMER'
                                ? 'Capture customer details, credit terms, and contact information.'
                                : 'Capture supplier details, payable tracking, and business contact information.'}
                            icon={partyType === 'CUSTOMER' ? 'account-plus-outline' : 'truck-delivery-outline'}
                            tone={partyType === 'CUSTOMER' ? 'success' : 'warning'}
                        />
                    </View>

                    <View style={s.typeRow}>
                        {PARTY_TYPE_OPTIONS.map((entry) => (
                            <ChipButton
                                key={entry.value}
                                label={entry.label}
                                selected={partyType === entry.value}
                                tone={entry.value === PartyType.CUSTOMER ? 'success' : 'warning'}
                                onPress={() => setValue('type', entry.value)}
                            />
                        ))}
                    </View>

                    <View style={s.form}>
                        <FormSectionCard title="Contact Details" description="Identity, phone, email, and GST registration.">
                            <FormField label="Name *" error={errors.name?.message} colors={colors}>
                            <Controller
                                control={control}
                                name="name"
                                render={({ field: { onChange, value } }) => (
                                    <AppInput
                                        value={value}
                                        onChangeText={onChange}
                                        inputType="name"
                                        placeholder="Party name"
                                        containerStyle={s.inputWrap}
                                        error={errors.name?.message}
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
                                            <AppInput
                                                containerStyle={[s.inputWrap, s.phoneInput]}
                                                value={value}
                                                onChangeText={(text) => onChange(sanitizePhoneLocal(text))}
                                                inputType="phone"
                                                placeholder="Mobile number"
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
                                    <AppInput
                                        value={value}
                                        onChangeText={onChange}
                                        inputType="email"
                                        placeholder="email@example.com"
                                        containerStyle={s.inputWrap}
                                    />
                                )}
                            />
                            </FormField>

                            <FormField label="GSTIN" colors={colors}>
                            <Controller
                                control={control}
                                name="gstin"
                                render={({ field: { onChange, value } }) => (
                                    <AppInput
                                        value={value}
                                        onChangeText={onChange}
                                        inputType="text"
                                        placeholder="22AAAAA0000A1Z5"
                                        containerStyle={s.inputWrap}
                                        autoCapitalize="characters"
                                        maxLength={15}
                                    />
                                )}
                            />
                            </FormField>
                        </FormSectionCard>

                        <FormSectionCard title="Commercial Details" description="Billing address, opening balance, and credit limit.">
                            <FormField label="Billing Address" colors={colors}>
                            <Controller
                                control={control}
                                name="billingAddress"
                                render={({ field: { onChange, value } }) => (
                                    <AppInput
                                        containerStyle={s.inputWrap}
                                        style={s.multiline}
                                        value={value}
                                        onChangeText={onChange}
                                        inputType="text"
                                        placeholder="Full address"
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
                                    <AppInput
                                        value={String(value)}
                                        onChangeText={onChange}
                                        inputType="decimal"
                                        placeholder="0"
                                        containerStyle={s.inputWrap}
                                    />
                                )}
                            />
                            </FormField>

                            <FormField label="Credit Limit (INR)" colors={colors}>
                            <Controller
                                control={control}
                                name="creditLimit"
                                render={({ field: { onChange, value } }) => (
                                    <AppInput
                                        value={String(value)}
                                        onChangeText={onChange}
                                        inputType="decimal"
                                        placeholder="0"
                                        containerStyle={s.inputWrap}
                                    />
                                )}
                            />
                            </FormField>
                        </FormSectionCard>
                    </View>
                    <View style={{ height: 80 }} />
                </ScrollView>
            </KeyboardAvoidingView>

            <Modal visible={countryPickerVisible} animationType="slide" transparent onRequestClose={() => setCountryPickerVisible(false)}>
                <Pressable style={s.modalOverlay} onPress={() => setCountryPickerVisible(false)}>
                    <Pressable style={[s.modalCard, { backgroundColor: colors.surface }]} onPress={() => null}>
                        <Text style={[s.modalTitle, { color: colors.text }]}>Select Country Code</Text>
                        <AppInput
                            containerStyle={s.inputWrap}
                            value={countrySearch}
                            onChangeText={setCountrySearch}
                            inputType="search"
                            placeholder="Search country or code"
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
        flex: { flex: 1 },
        loadingWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        heroWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        typeRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        form: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
        inputWrap: { marginBottom: Spacing.xs },
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
            backgroundColor: withAlpha(colors.text, '66'),
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
