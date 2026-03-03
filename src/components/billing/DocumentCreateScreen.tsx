import { useEffect } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
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
import { InvoiceType } from '../../constants/enums';
import { useInvoiceBuilderStore, useInvoiceTotals } from '../../store/invoiceBuilderStore';
import type { InvoiceLineItem } from '../../types/domain';

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
};

const toNumber = (value: string) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

export function DocumentCreateScreen({ config }: { config: BillingDocumentConfig }) {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const queryClient = useQueryClient();

    const { init, state, addLine, removeLine, updateLine, setNotes } = useInvoiceBuilderStore();
    const totals = useInvoiceTotals();

    useEffect(() => {
        init((config.invoiceType as InvoiceType) ?? InvoiceType.TAX_INVOICE);
    }, [config.invoiceType, init]);

    const { mutate: submit, isPending } = useMutation({
        mutationFn: () => {
            const payload: InvoiceCreateInput = {
                ...state,
                invoiceType: config.invoiceType,
                transactionType: config.transactionType,
                documentKind: config.documentKind,
                billMode: config.billMode,
            };
            return invoiceApi.create(payload);
        },
        onSuccess: (res) => {
            queryClient.invalidateQueries({ queryKey: ['invoices'] });
            if (res.data?.id) {
                router.replace(`/(main)/billing/${res.data.id}` as Parameters<typeof router.replace>[0]);
                return;
            }
            router.back();
        },
        onError: (error) => {
            Alert.alert('Save failed', error instanceof Error ? error.message : 'Could not save transaction.');
        },
    });

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()} style={s.backBtn}>
                    <Text style={[s.backText, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={[s.headerTitle, { color: colors.text }]}>{config.title}</Text>
                <Pressable
                    style={[s.saveBtn, { backgroundColor: isPending ? colors.border : colors.primary }]}
                    onPress={() => submit()}
                    disabled={isPending}
                >
                    {isPending ? <ActivityIndicator color="#fff" size="small" /> : <Text style={s.saveBtnText}>Save</Text>}
                </Pressable>
            </View>

            <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled">
                {config.helperText ? (
                    <View style={[s.helperCard, { backgroundColor: colors.surfaceVariant }]}>
                        <Text style={{ color: colors.textSecondary, fontSize: 12 }}>{config.helperText}</Text>
                    </View>
                ) : null}

                <Pressable
                    style={[s.partySelector, { backgroundColor: colors.card }]}
                    onPress={() => router.push('/(main)/billing/party-select' as Parameters<typeof router.push>[0])}
                >
                    {state.partySnapshot ? (
                        <Text style={[s.partyName, { color: colors.text }]}>{state.partySnapshot.name ?? 'Party'}</Text>
                    ) : (
                        <Text style={[s.partyPlaceholder, { color: colors.textSecondary }]}>
                            {config.partyPlaceholder ?? '+ Select Party (optional)'}
                        </Text>
                    )}
                </Pressable>

                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>ITEMS</Text>
                    {state.items.map((line) => (
                        <LineItemRow
                            key={line._key}
                            line={line}
                            onUpdate={updateLine}
                            onRemove={removeLine}
                            colors={colors}
                        />
                    ))}
                    <Pressable style={[s.addLineBtn, { borderColor: colors.primary }]} onPress={addLine}>
                        <Text style={[s.addLineBtnText, { color: colors.primary }]}>+ Add Item</Text>
                    </Pressable>
                </View>

                <View style={[s.totalsCard, { backgroundColor: colors.card }]}>
                    <TotalRow label="Subtotal" value={totals.subtotal} colors={colors} />
                    {totals.totalDiscount > 0 ? <TotalRow label="Item Discount" value={-totals.totalDiscount} colors={colors} isNeg /> : null}
                    {totals.totalCgst > 0 ? <TotalRow label="CGST" value={totals.totalCgst} colors={colors} /> : null}
                    {totals.totalSgst > 0 ? <TotalRow label="SGST" value={totals.totalSgst} colors={colors} /> : null}
                    {totals.totalIgst > 0 ? <TotalRow label="IGST" value={totals.totalIgst} colors={colors} /> : null}
                    {state.discountAmount > 0 ? <TotalRow label="Discount" value={-state.discountAmount} colors={colors} isNeg /> : null}
                    {state.roundOffAmount !== 0 ? <TotalRow label="Round Off" value={state.roundOffAmount} colors={colors} /> : null}
                    <View style={[s.divider, { backgroundColor: colors.border }]} />
                    <TotalRow label="Total" value={totals.totalInvoiceValue} colors={colors} bold />
                </View>

                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>NOTES</Text>
                    <TextInput
                        style={[s.notesInput, { backgroundColor: colors.card, color: colors.text, borderColor: colors.border }]}
                        placeholder="Add notes or terms..."
                        placeholderTextColor={colors.textSecondary}
                        value={state.notes}
                        onChangeText={setNotes}
                        multiline
                        numberOfLines={3}
                    />
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function LineItemRow({ line, onUpdate, onRemove, colors }: LineItemRowProps) {
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
                <View style={lineStyles.field}>
                    <Text style={[lineStyles.label, { color: colors.textSecondary }]}>GST%</Text>
                    <TextInput
                        style={[lineStyles.input, { color: colors.text, borderColor: colors.border }]}
                        value={String(line.gstRate)}
                        onChangeText={(value) => onUpdate(line._key, { gstRate: toNumber(value) })}
                        keyboardType="numeric"
                    />
                </View>
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
        helperCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.md },
        partySelector: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.md },
        partyName: { fontWeight: '600', fontSize: 14 },
        partyPlaceholder: { fontSize: 14 },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
        addLineBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center', marginTop: Spacing.sm },
        addLineBtnText: { fontWeight: '600', fontSize: 13 },
        totalsCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md },
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
