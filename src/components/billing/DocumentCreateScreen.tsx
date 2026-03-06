import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, View
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { invoiceApi, itemApi, type InvoiceCreateInput } from '../../api/endpoints';
import { Radius, Spacing, Typography, type ColorPalette } from '../../constants/theme';
import { useAppColors } from '../../hooks/useAppColors';
import { GST_SLABS, INDIAN_STATE_LIST } from '../../constants/gstRates';
import { InvoiceType, PaymentMode } from '../../constants/enums';
import { useAuthStore } from '../../store/authStore';
import { useInvoiceBuilderStore, useInvoiceTotals } from '../../store/invoiceBuilderStore';
import type { InvoiceLineItem, Item } from '../../types/domain';
import { useSmartBack } from '../../hooks/useSmartBack';
import { toUserMessage } from '../../api/client';
import { canPerformAction } from '../../utils/accessControl';
import { SelectField, type SelectOption } from '../ui/SelectField';
import { DateField } from '../ui/DateField';
import { AppTopBar } from '../ui/AppTopBar';
import { AppInput } from '../ui/AppInput';
import { useAppDialog } from '@/components/providers/DialogProvider';

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
    transactionType?: BillingDocumentConfig['transactionType'];
    itemOptions: SelectOption[];
    itemById: Record<string, Item>;
    colors: ColorPalette;
    gstEnabled: boolean;
};

const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const formatDate = (value: string) => value.slice(0, 10);

const normalizeGstRate = (value: number) => {
    if (GST_SLABS.includes(value as (typeof GST_SLABS)[number])) {
        return value;
    }
    const nearest = GST_SLABS.reduce((best, slab) => {
        if (Math.abs(slab - value) < Math.abs(best - value)) {
            return slab;
        }
        return best;
    }, GST_SLABS[0]);
    return nearest;
};

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
    const dialog = useAppDialog();
    const colors = useAppColors();
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

    const { data: itemCatalogResponse } = useQuery({
        queryKey: ['billing-item-catalog'],
        queryFn: () => itemApi.list({ limit: 400 }),
        staleTime: 5 * 60_000,
    });
    const itemCatalog = useMemo(() => itemCatalogResponse?.items ?? [], [itemCatalogResponse?.items]);
    const itemOptions: SelectOption[] = useMemo(
        () =>
            itemCatalog.map((item) => ({
                label: item.name,
                value: item.id,
                description: `Stock ${item.stock} ${item.unit ?? 'pcs'} | GST ${item.gstRate}%`,
            })),
        [itemCatalog]
    );
    const stateOptions: SelectOption[] = useMemo(
        () => INDIAN_STATE_LIST.map((entry) => ({ label: entry.name, value: entry.name, description: entry.label })),
        []
    );
    const itemById = useMemo(() => {
        const map: Record<string, Item> = {};
        itemCatalog.forEach((item) => {
            map[item.id] = item;
        });
        return map;
    }, [itemCatalog]);

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
            dialog.alert('Save failed', toUserMessage(error, 'Could not save transaction.'));
        },
    });

    const handleSave = () => {
        if (!canCreateBilling) {
            dialog.alert('Access denied', 'Your role cannot create billing transactions.');
            return;
        }
        submit();
    };

    return (
        <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
            <AppTopBar
                title={config.title}
                subtitle={config.billMode === 'ESTIMATE' ? 'Non-posting document' : 'Posting document'}
                onBackPress={smartBack}
                rightAction={(
                <Pressable
                    style={[s.saveBtn, { backgroundColor: isPending || !canCreateBilling ? colors.border : colors.primary }]}
                    onPress={handleSave}
                    disabled={isPending || !canCreateBilling}
                >
                    {isPending ? (
                        <ActivityIndicator color={colors.onPrimary} size="small" />
                    ) : (
                        <MaterialCommunityIcons name="content-save-outline" color={colors.onPrimary} size={18} />
                    )}
                </Pressable>
            )}
            />

            <KeyboardAvoidingView
                style={s.flex}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView style={s.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={s.scrollContent}>
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
                        <AppInput
                            inputType="text"
                            containerStyle={s.flex1}
                            value={state.invoiceNumber}
                            onChangeText={setInvoiceNumber}
                            placeholder="Invoice number"
                        />
                        <Pressable
                            style={[s.secondaryBtn, { borderColor: colors.border }]}
                            onPress={() => setInvoiceNumber(generateBillNumber(config.documentKind?.slice(0, 3) ?? 'INV'))}
                        >
                            <Text style={[s.secondaryBtnText, { color: colors.primary }]}>Random</Text>
                        </Pressable>
                    </View>

                    <Text style={s.inputLabel}>Invoice Date</Text>
                    <DateField
                        value={state.invoiceDate}
                        onChange={(value) => setInvoiceDate(value ?? formatDate(new Date().toISOString()))}
                        placeholder="Select invoice date"
                        title="Invoice Date"
                        allowClear={false}
                    />

                    <Text style={s.inputLabel}>Due Date (optional)</Text>
                    <DateField
                        value={state.dueDate}
                        onChange={setDueDate}
                        placeholder="Select due date"
                        title="Due Date"
                    />

                    {gstEnabled ? (
                        <>
                            <Text style={s.inputLabel}>Place Of Supply</Text>
                            <SelectField
                                value={state.placeOfSupply || null}
                                onChange={setPlaceOfSupply}
                                options={stateOptions}
                                placeholder="Select state / UT"
                                title="Place Of Supply"
                                searchable
                                allowClear
                                onClear={() => setPlaceOfSupply('')}
                            />

                            <Text style={s.inputLabel}>E-Way Bill Number (optional)</Text>
                            <AppInput
                                inputType="text"
                                value={eWayBillNumber}
                                onChangeText={setEWayBillNumber}
                                placeholder="Enter e-way bill number"
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
                            transactionType={config.transactionType}
                            itemOptions={itemOptions}
                            itemById={itemById}
                            colors={colors}
                            gstEnabled={gstEnabled}
                        />
                    ))}
                        <View style={s.addItemRow}>
                            <Pressable style={[s.addLineBtn, { borderColor: colors.primary, flex: 1 }]} onPress={addLine}>
                                <Text style={[s.addLineBtnText, { color: colors.primary }]}>+ Add Line</Text>
                            </Pressable>
                            <Pressable
                                style={[s.addLineBtn, { borderColor: colors.border, flex: 1 }]}
                                onPress={() => router.push({
                                    pathname: '/(main)/inventory/add-item',
                                    params: { returnContext: 'invoice' },
                                })}
                            >
                                <Text style={[s.addLineBtnText, { color: colors.textSecondary }]}>+ Create Item</Text>
                            </Pressable>
                        </View>
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
                    <AppInput
                        inputType="decimal"
                        value={String(state.paidAmount)}
                        onChangeText={(value) => setPaidAmount(toNumber(value))}
                        placeholder="0"
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
                    <AppInput
                        inputType="text"
                        containerStyle={s.notesInputWrap}
                        style={[s.notesInput, { color: colors.text }]}
                        placeholder="Add notes or terms..."
                        value={state.notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                    />
                </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

function LineItemRow({
    line,
    onUpdate,
    onRemove,
    transactionType,
    itemOptions,
    itemById,
    colors,
    gstEnabled,
}: LineItemRowProps) {
    const selectedItem = line.itemId ? itemById[line.itemId] : undefined;
    const resolveRateFromItem = (item: Item) => {
        if (transactionType === 'PURCHASE' || transactionType === 'RETURN_INWARD') {
            return item.purchasePrice > 0 ? item.purchasePrice : item.salePrice;
        }
        return item.salePrice;
    };

    return (
        <View style={[lineStyles.card, { backgroundColor: colors.surfaceVariant }]}>
            <SelectField
                value={line.itemId}
                onChange={(itemId) => {
                    const selected = itemById[itemId];
                    if (!selected) return;
                    onUpdate(line._key, {
                        itemId: selected.id,
                        description: selected.name,
                        unit: selected.unit ?? line.unit ?? 'pcs',
                        rate: resolveRateFromItem(selected),
                        gstRate: normalizeGstRate(Number(selected.gstRate ?? 0)),
                    });
                }}
                title="Select Inventory Item"
                options={itemOptions}
                placeholder="Select item from inventory"
                allowClear
                onClear={() =>
                    onUpdate(line._key, {
                        itemId: null,
                    })
                }
            />
            {selectedItem ? (
                <Text style={[lineStyles.stockHint, { color: selectedItem.stock <= 0 ? colors.error : colors.textSecondary }]}>
                    Available stock: {selectedItem.stock} {selectedItem.unit ?? 'pcs'}
                </Text>
            ) : null}
            <View style={lineStyles.row1}>
                <AppInput
                    inputType="text"
                    containerStyle={lineStyles.flex1}
                    value={line.description}
                    onChangeText={(value) => onUpdate(line._key, { description: value })}
                    placeholder="Item description"
                />
                <Pressable style={lineStyles.removeBtn} onPress={() => onRemove(line._key)}>
                    <MaterialCommunityIcons name="close-circle-outline" color={colors.error} size={22} />
                </Pressable>
            </View>
            <View style={lineStyles.row2}>
                <AppInput
                    label="Qty"
                    inputType="decimal"
                    containerStyle={lineStyles.field}
                    value={String(line.quantity)}
                    onChangeText={(value) => onUpdate(line._key, { quantity: toNumber(value) })}
                />
                <AppInput
                    label="Rate"
                    inputType="decimal"
                    containerStyle={lineStyles.field}
                    value={String(line.rate)}
                    onChangeText={(value) => onUpdate(line._key, { rate: toNumber(value) })}
                />
                {gstEnabled ? (
                    <AppInput
                        label="GST%"
                        inputType="decimal"
                        containerStyle={lineStyles.field}
                        value={String(line.gstRate)}
                        onChangeText={(value) => onUpdate(line._key, { gstRate: toNumber(value) })}
                    />
                ) : null}
                <View style={lineStyles.field}>
                    <Text style={[lineStyles.totalLabel, { color: colors.textSecondary }]}>Total</Text>
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
        flex: { flex: 1 },
        saveBtn: {
            width: 38,
            height: 38,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
        },
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
        row: {
            flexDirection: 'row',
            gap: Spacing.sm,
            alignItems: 'flex-end',
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
        addItemRow: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
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
        notesInputWrap: { marginTop: Spacing.xs },
        notesInput: { minHeight: 72, textAlignVertical: 'top' },
    });

const lineStyles = StyleSheet.create({
    card: { borderRadius: Radius.md, padding: Spacing.sm, marginBottom: Spacing.sm },
    stockHint: { fontSize: 11, fontWeight: '500', marginBottom: Spacing.xs },
    row1: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.xs, marginBottom: Spacing.xs },
    flex1: { flex: 1 },
    removeBtn: { marginBottom: 6 },
    row2: { flexDirection: 'row', gap: Spacing.xs, alignItems: 'flex-start' },
    field: { flex: 1 },
    totalLabel: { fontSize: 11, fontWeight: '700', marginBottom: 6 },
    total: { fontWeight: '700', fontSize: 12, paddingTop: 12 },
});
