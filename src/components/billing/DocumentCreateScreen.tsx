import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
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
import { invoiceApi, type InvoiceCreateInput } from '../../api/endpoints';
import { getColors, Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { InvoiceType, PaymentMode } from '../../constants/enums';
import { useAuthStore } from '../../store/authStore';
import { useInvoiceBuilderStore, useInvoiceTotals } from '../../store/invoiceBuilderStore';
import type { InvoiceLineItem } from '../../types/domain';
import { useSmartBack } from '../../hooks/useSmartBack';
import { toUserMessage } from '../../api/client';
import { canPerformAction } from '../../utils/accessControl';

export type BillingDocumentConfig = {
    title: string;
    invoiceType: InvoiceType;
    transactionType?: 'SALE' | 'PURCHASE' | 'RETURN_INWARD' | 'RETURN_OUTWARD';
    documentKind?: string;
    billMode?: 'GST' | 'ESTIMATE';
    partyPlaceholder?: string;
    helperText?: string;
};

type LineItemRowProps = {
    line: InvoiceLineItem;
    onUpdate: (key: string, updates: Partial<InvoiceLineItem>) => void;
    onRemove: (key: string) => void;
    colors: ColorPalette;
    gstEnabled: boolean;
};

const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string) => value.slice(0, 10);

const generateBillNumber = (seed: string) => {
    const date = new Date();
    const yy = String(date.getFullYear()).slice(-2);
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 900 + 100);
    return `${seed}-${yy}${mm}${dd}-${random}`;
};

const withNoGst = (line: InvoiceLineItem): InvoiceLineItem => {
    const discountAmount = Math.round((line.rate * line.quantity * line.discountPercent)) / 100;
    const taxableValue = Math.round((line.rate * line.quantity - discountAmount) * 100) / 100;
    return {
        ...line,
        gstRate: 0,
        cgstRate: 0,
        cgstAmount: 0,
        sgstRate: 0,
        sgstAmount: 0,
        igstRate: 0,
        igstAmount: 0,
        taxableValue,
        total: taxableValue,
    };
};

export function DocumentCreateScreen({ config }: { config: BillingDocumentConfig }) {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const queryClient = useQueryClient();
    const smartBack = useSmartBack('/(main)/billing');
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const canCreateBilling = canPerformAction(role, 'billing.create', subscription);
    const preferredPartyType = config.transactionType === 'PURCHASE' || config.transactionType === 'RETURN_INWARD'
        ? 'supplier'
        : 'customer';

    const {
        init,
        state,
        addLine,
        removeLine,
        updateLine,
        setNotes,
        setInvoiceNumber,
        setInvoiceDate,
        setDueDate,
        setPlaceOfSupply,
        setReverseCharge,
        setPaymentMode,
        setPaidAmount,
        applyInterState,
    } = useInvoiceBuilderStore();
    const totals = useInvoiceTotals();

    const [gstEnabled, setGstEnabled] = useState(config.invoiceType !== InvoiceType.BILL_OF_SUPPLY);
    const [eWayBillNumber, setEWayBillNumber] = useState('');

    useEffect(() => {
        init((config.invoiceType as InvoiceType) ?? InvoiceType.TAX_INVOICE);
        setInvoiceNumber(generateBillNumber(config.documentKind?.slice(0, 3) ?? 'INV'));
        setInvoiceDate(formatDate(new Date().toISOString()));
        setGstEnabled(config.invoiceType !== InvoiceType.BILL_OF_SUPPLY);
        setEWayBillNumber('');
    }, [config.documentKind, config.invoiceType, init, setInvoiceDate, setInvoiceNumber]);

    const totalForPayment = useMemo(
        () => (gstEnabled ? totals.totalInvoiceValue : totals.totalTaxable),
        [gstEnabled, totals.totalInvoiceValue, totals.totalTaxable]
    );

    const setPaymentPreset = (mode: 'PAID' | 'PARTIAL' | 'CREDIT') => {
        if (mode === 'PAID') {
            setPaidAmount(totalForPayment);
            return;
        }
        if (mode === 'PARTIAL') {
            setPaidAmount(Math.max(0, Math.round(totalForPayment / 2)));
            return;
        }
        setPaidAmount(0);
    };

    const toggleGst = (enabled: boolean) => {
        setGstEnabled(enabled);
        if (!enabled) {
            applyInterState(false);
            state.items.forEach((line) => {
                updateLine(line._key, { gstRate: 0, isInterState: false });
            });
        }
    };

    const { mutate: submit, isPending } = useMutation({
        mutationFn: () => {
            if (!canCreateBilling) {
                throw new Error('Your role does not have permission to create billing transactions.');
            }
            const normalizedItems = gstEnabled ? state.items : state.items.map(withNoGst);
            const payload: InvoiceCreateInput = {
                ...state,
                items: normalizedItems,
                invoiceType: gstEnabled
                    ? config.invoiceType
                    : config.transactionType === 'PURCHASE'
                        ? config.invoiceType
                        : InvoiceType.BILL_OF_SUPPLY,
                transactionType: config.transactionType,
                documentKind: config.documentKind,
                billMode: config.billMode,
                reverseCharge: gstEnabled ? state.reverseCharge : false,
                eWayBillNumber: gstEnabled ? (eWayBillNumber.trim() || null) : null,
            };
            return invoiceApi.create(payload);
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            if (res.data?.id) {
                router.replace(`/(main)/billing/${res.data.id}` as Parameters<typeof router.replace>[0]);
                return;
            }
            smartBack();
        },
        onError: (error) => {
            Alert.alert('Save failed', toUserMessage(error, 'Could not save transaction.'));
        },
    });

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <View style={s.header}>
                <Pressable onPress={smartBack} style={s.backBtn}>
                    <Text style={[s.backText, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={[s.headerTitle, { color: colors.text }]}>{config.title}</Text>
                <Pressable
                    style={[s.saveBtn, { backgroundColor: isPending || !canCreateBilling ? colors.border : colors.primary }]}
                    onPress={() => {
                        if (!canCreateBilling) {
                            Alert.alert('Access denied', 'Your role cannot create billing transactions.');
                            return;
                        }
                        submit();
                    }}
                    disabled={isPending || !canCreateBilling}
                >
                    {isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
                </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scrollContent}>
                {config.helperText ? (
                    <View style={[s.helperCard, { backgroundColor: colors.surfaceVariant }]}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{config.helperText}</Text>
                    </View>
                ) : null}

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <View style={s.rowBetween}>
                        <Text style={s.fieldTitle}>Document Details</Text>
                        <View style={s.toggleRow}>
                            <Text style={[s.smallLabel, { color: colors.textSecondary }]}>GST</Text>
                            <Switch value={gstEnabled} onValueChange={toggleGst} trackColor={{ true: colors.primary }} />
                        </View>
                    </View>

                    <Text style={s.inputLabel}>Bill Number</Text>
                    <View style={s.row}>
                        <TextInput
                            style={[s.input, s.flex1, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
                            value={state.invoiceNumber}
                            onChangeText={setInvoiceNumber}
                            placeholder="Invoice number"
                            placeholderTextColor={colors.textSecondary}
                        />
                        <Pressable
                            style={[s.secondaryBtn, { borderColor: colors.border }]}
                            onPress={() => setInvoiceNumber(generateBillNumber(config.documentKind?.slice(0, 3) ?? 'INV'))}
                        >
                            <Text style={[s.secondaryBtnText, { color: colors.primary }]}>Random</Text>
                        </Pressable>
                    </View>

                    <Text style={s.inputLabel}>Invoice Date (YYYY-MM-DD)</Text>
                    <TextInput
                        style={[s.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
                        value={state.invoiceDate}
                        onChangeText={setInvoiceDate}
                        placeholder="2026-03-04"
                        placeholderTextColor={colors.textSecondary}
                    />

                    <Text style={s.inputLabel}>Due Date (optional)</Text>
                    <TextInput
                        style={[s.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
                        value={state.dueDate ?? ''}
                        onChangeText={(value) => setDueDate(value.trim() ? value : null)}
                        placeholder="2026-03-11"
                        placeholderTextColor={colors.textSecondary}
                    />

                    {gstEnabled ? (
                        <>
                            <Text style={s.inputLabel}>Place Of Supply</Text>
                            <TextInput
                                style={[s.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
                                value={state.placeOfSupply}
                                onChangeText={setPlaceOfSupply}
                                placeholder="State / UT"
                                placeholderTextColor={colors.textSecondary}
                            />

                            <Text style={s.inputLabel}>E-Way Bill Number (optional)</Text>
                            <TextInput
                                style={[s.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
                                value={eWayBillNumber}
                                onChangeText={setEWayBillNumber}
                                placeholder="Enter e-way bill number"
                                placeholderTextColor={colors.textSecondary}
                            />

                            <View style={s.toggleRow}>
                                <Text style={s.inputLabel}>Reverse Charge</Text>
                                <Switch
                                    value={state.reverseCharge}
                                    onValueChange={setReverseCharge}
                                    trackColor={{ true: colors.primary }}
                                />
                            </View>
                        </>
                    ) : null}
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <View style={s.rowBetween}>
                        <Text style={s.fieldTitle}>Party</Text>
                        <Pressable
                            style={[s.secondaryBtn, { borderColor: colors.border }]}
                            onPress={() => router.push({
                                pathname: '/(main)/parties/add',
                                params: {
                                    type: preferredPartyType === 'supplier' ? 'SUPPLIER' : 'CUSTOMER',
                                },
                            })}
                        >
                            <Text style={[s.secondaryBtnText, { color: colors.primary }]}>Create</Text>
                        </Pressable>
                    </View>
                    <Pressable
                        style={[s.partySelector, { backgroundColor: colors.surfaceVariant }]}
                        onPress={() =>
                            router.push({
                                pathname: '/(main)/billing/party-select',
                                params: { partyType: preferredPartyType },
                            })
                        }
                    >
                        {state.partySnapshot ? (
                            <Text style={[s.partyName, { color: colors.text }]}>{state.partySnapshot.name ?? 'Party'}</Text>
                        ) : (
                            <Text style={[s.partyPlaceholder, { color: colors.textSecondary }]}>
                                {config.partyPlaceholder ?? '+ Select Party (optional)'}
                            </Text>
                        )}
                    </Pressable>
                </View>

                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>ITEMS</Text>
                    {state.items.map((line) => (
                        <LineItemRow
                            key={line._key}
                            line={line}
                            onUpdate={updateLine}
                            onRemove={removeLine}
                            colors={colors}
                            gstEnabled={gstEnabled}
                        />
                    ))}
                    <Pressable style={[s.addLineBtn, { borderColor: colors.primary }]} onPress={addLine}>
                        <Text style={[s.addLineBtnText, { color: colors.primary }]}>+ Add Item</Text>
                    </Pressable>
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <Text style={s.fieldTitle}>Payment</Text>
                    <View style={s.row}>
                        <Pressable style={[s.chip, { borderColor: colors.border }]} onPress={() => setPaymentMode(PaymentMode.CASH)}>
                            <Text style={[s.chipText, { color: colors.text }]}>Cash</Text>
                        </Pressable>
                        <Pressable style={[s.chip, { borderColor: colors.border }]} onPress={() => setPaymentMode(PaymentMode.UPI)}>
                            <Text style={[s.chipText, { color: colors.text }]}>UPI</Text>
                        </Pressable>
                        <Pressable style={[s.chip, { borderColor: colors.border }]} onPress={() => setPaymentMode(PaymentMode.BANK)}>
                            <Text style={[s.chipText, { color: colors.text }]}>Bank</Text>
                        </Pressable>
                    </View>
                    <View style={s.row}>
                        <Pressable style={[s.chip, { borderColor: colors.border }]} onPress={() => setPaymentPreset('PAID')}>
                            <Text style={[s.chipText, { color: colors.text }]}>Paid</Text>
                        </Pressable>
                        <Pressable style={[s.chip, { borderColor: colors.border }]} onPress={() => setPaymentPreset('PARTIAL')}>
                            <Text style={[s.chipText, { color: colors.text }]}>Partial</Text>
                        </Pressable>
                        <Pressable style={[s.chip, { borderColor: colors.border }]} onPress={() => setPaymentPreset('CREDIT')}>
                            <Text style={[s.chipText, { color: colors.text }]}>Credit</Text>
                        </Pressable>
                    </View>
                    <Text style={s.inputLabel}>Paid Amount</Text>
                    <TextInput
                        style={[s.input, { backgroundColor: colors.surfaceVariant, borderColor: colors.border, color: colors.text }]}
                        value={String(state.paidAmount)}
                        onChangeText={(value) => setPaidAmount(toNumber(value))}
                        keyboardType="numeric"
                        placeholder="0"
                        placeholderTextColor={colors.textSecondary}
                    />
                </View>

                <View style={[s.totalsCard, { backgroundColor: colors.card }]}>
                    <TotalRow label="Subtotal" value={totals.subtotal} colors={colors} />
                    {totals.totalDiscount > 0 ? <TotalRow label="Item Discount" value={-totals.totalDiscount} colors={colors} isNeg /> : null}
                    {gstEnabled && totals.totalCgst > 0 ? <TotalRow label="CGST" value={totals.totalCgst} colors={colors} /> : null}
                    {gstEnabled && totals.totalSgst > 0 ? <TotalRow label="SGST" value={totals.totalSgst} colors={colors} /> : null}
                    {gstEnabled && totals.totalIgst > 0 ? <TotalRow label="IGST" value={totals.totalIgst} colors={colors} /> : null}
                    <View style={[s.divider, { backgroundColor: colors.border }]} />
                    <TotalRow label="Total" value={totalForPayment} colors={colors} bold />
                </View>

                <View style={[s.card, { backgroundColor: colors.card }]}>
                    <Text style={s.fieldTitle}>Notes</Text>
                    <TextInput
                        style={[s.notesInput, { backgroundColor: colors.surfaceVariant, color: colors.text, borderColor: colors.border }]}
                        placeholder="Add notes or terms..."
                        placeholderTextColor={colors.textSecondary}
                        value={state.notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                    />
                </View>
            </ScrollView>
        </SafeAreaView>
    );
}

function LineItemRow({ line, onUpdate, onRemove, colors, gstEnabled }: LineItemRowProps) {
    return (
        <View style={[lineStyles.card, { backgroundColor: colors.surfaceVariant }]}>
            <View style={lineStyles.row1}>
                <TextInput
                    style={[lineStyles.desc, { color: colors.text, flex: 1 }]}
                    value={line.description}
                    onChangeText={(value) => onUpdate(line._key, { description: value })}
                    placeholder="Item description"
                    placeholderTextColor={colors.textSecondary}
                />
                <Pressable onPress={() => onRemove(line._key)}>
                    <Text style={{ color: colors.error, fontSize: 18, paddingHorizontal: 4 }}>x</Text>
                </Pressable>
            </View>
            <View style={lineStyles.row2}>
                <View style={lineStyles.field}>
                    <Text style={[lineStyles.label, { color: colors.textSecondary }]}>Qty</Text>
                    <TextInput
                        style={[lineStyles.input, { color: colors.text, borderColor: colors.border }]}
                        value={String(line.quantity)}
                        onChangeText={(value) => onUpdate(line._key, { quantity: toNumber(value) })}
                        keyboardType="numeric"
                    />
                </View>
                <View style={lineStyles.field}>
                    <Text style={[lineStyles.label, { color: colors.textSecondary }]}>Rate</Text>
                    <TextInput
                        style={[lineStyles.input, { color: colors.text, borderColor: colors.border }]}
                        value={String(line.rate)}
                        onChangeText={(value) => onUpdate(line._key, { rate: toNumber(value) })}
                        keyboardType="numeric"
                    />
                </View>
                {gstEnabled ? (
                    <View style={lineStyles.field}>
                        <Text style={[lineStyles.label, { color: colors.textSecondary }]}>GST%</Text>
                        <TextInput
                            style={[lineStyles.input, { color: colors.text, borderColor: colors.border }]}
                            value={String(line.gstRate)}
                            onChangeText={(value) => onUpdate(line._key, { gstRate: toNumber(value) })}
                            keyboardType="numeric"
                        />
                    </View>
                ) : null}
                <View style={lineStyles.field}>
                    <Text style={[lineStyles.label, { color: colors.textSecondary }]}>Total</Text>
                    <Text style={[lineStyles.total, { color: colors.text }]}>
                        Rs {line.total.toLocaleString('en-IN', { maximumFractionDigits: 2 })}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function TotalRow({
    label,
    value,
    bold,
    isNeg,
    colors,
}: {
    label: string;
    value: number;
    bold?: boolean;
    isNeg?: boolean;
    colors: ColorPalette;
}) {
    return (
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text style={{ color: colors.textSecondary, fontWeight: bold ? '700' : '400' }}>{label}</Text>
            <Text style={{ color: isNeg ? colors.error : bold ? colors.text : colors.textSecondary, fontWeight: bold ? '700' : '400' }}>
                {isNeg ? '-' : ''}Rs {Math.abs(value).toLocaleString('en-IN', { maximumFractionDigits: 2 })}
            </Text>
        </View>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            gap: Spacing.sm,
        },
        backBtn: { paddingRight: Spacing.sm },
        backText: { fontSize: 14, fontWeight: '600' },
        headerTitle: { flex: 1, fontWeight: '700', fontSize: Typography.title.size, textAlign: 'center' },
        saveBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            minWidth: 64,
            alignItems: 'center',
        },
        saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
        scrollContent: { paddingBottom: 120, gap: Spacing.sm },
        helperCard: {
            marginHorizontal: Spacing.lg,
            borderRadius: Radius.card,
            padding: Spacing.md,
            marginBottom: Spacing.xs,
        },
        card: {
            marginHorizontal: Spacing.lg,
            borderRadius: Radius.card,
            padding: Spacing.md,
            gap: Spacing.xs,
        },
        fieldTitle: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
        inputLabel: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            fontWeight: '600',
            marginTop: 2,
        },
        input: {
            borderWidth: 1,
            borderRadius: Radius.md,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            fontSize: 14,
        },
        row: {
            flexDirection: 'row',
            gap: Spacing.sm,
            alignItems: 'center',
        },
        rowBetween: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: Spacing.sm,
        },
        flex1: { flex: 1 },
        secondaryBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            minHeight: 38,
            paddingHorizontal: Spacing.md,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surface,
        },
        secondaryBtnText: {
            fontSize: Typography.caption.size,
            fontWeight: '700',
        },
        toggleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.xs,
        },
        smallLabel: {
            fontSize: Typography.caption.size,
            fontWeight: '600',
        },
        partySelector: {
            borderRadius: Radius.md,
            padding: Spacing.md,
        },
        partyName: { fontWeight: '600', fontSize: 14 },
        partyPlaceholder: { fontSize: 14 },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
        addLineBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
        addLineBtnText: { fontWeight: '600', fontSize: 13 },
        chip: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: 8,
            backgroundColor: colors.surface,
        },
        chipText: {
            fontWeight: '600',
            fontSize: Typography.caption.size,
        },
        totalsCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md, backgroundColor: colors.card },
        divider: { height: 1, marginVertical: Spacing.sm },
        notesInput: { borderWidth: 1, borderRadius: Radius.md, padding: Spacing.md, minHeight: 80, textAlignVertical: 'top' },
    });

const lineStyles = StyleSheet.create({
    card: { borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
    row1: { flexDirection: 'row', alignItems: 'center', marginBottom: Spacing.xs },
    desc: { fontSize: 14, fontWeight: '500' },
    row2: { flexDirection: 'row', gap: Spacing.xs },
    field: { flex: 1 },
    label: { fontSize: 10, marginBottom: 2 },
    input: { borderWidth: 1, borderRadius: 4, paddingHorizontal: Spacing.xs, paddingVertical: 4, fontSize: 13 },
    total: { fontWeight: '700', fontSize: 12, paddingTop: 4 },
});
