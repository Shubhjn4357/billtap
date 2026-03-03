import { useEffect } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet, useColorScheme, Alert, ActivityIndicator, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import { GST_SLABS } from '../../../constants/gstRates';

const GST_RATES = [...GST_SLABS];

const itemSchema = z.object({
    name: z.string().min(1, 'Name is required'),
    sku: z.string().optional(),
    barcode: z.string().optional(),
    hsnCode: z.string().optional(),
    category: z.string().optional(),
    unit: z.string().default('pcs'),
    salePrice: z.coerce.number().nonnegative(),
    purchasePrice: z.coerce.number().nonnegative().default(0),
    mrp: z.coerce.number().nonnegative().default(0),
    gstRate: z.coerce.number().default(18),
    stock: z.coerce.number().default(0),
    reorderLevel: z.coerce.number().default(5),
    isSalesPriceInclusiveGst: z.boolean().default(false),
    description: z.string().optional(),
    location: z.string().optional(),
});
type ItemFormInput = z.input<typeof itemSchema>;
type ItemForm = z.output<typeof itemSchema>;

export default function AddItemScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const params = useLocalSearchParams<{
        id?: string;
        barcode?: string | string[];
        scanned?: string | string[];
        scanAt?: string | string[];
        scanField?: string | string[];
    }>();
    const editId = params.id;
    const qc = useQueryClient();
    const s = styles(colors);

    const { control, handleSubmit, watch, setValue, formState: { errors } } = useForm<ItemFormInput, unknown, ItemForm>({
        resolver: zodResolver(itemSchema),
        defaultValues: { unit: 'pcs', gstRate: 18, stock: 0, reorderLevel: 5, salePrice: 0, purchasePrice: 0, mrp: 0, isSalesPriceInclusiveGst: false },
    });

    const { data: editItemData, isLoading: editItemLoading } = useQuery({
        queryKey: ['item', editId],
        queryFn: () => itemApi.get(editId!),
        enabled: Boolean(editId),
    });

    const { mutate, isPending } = useMutation({
        mutationFn: (data: ItemForm) => {
            const payload = {
                name: data.name,
                sku: data.sku ?? null,
                barcode: data.barcode ?? null,
                hsnCode: data.hsnCode ?? null,
                category: data.category ?? null,
                unit: data.unit,
                salePrice: data.salePrice,
                purchasePrice: data.purchasePrice,
                mrp: data.mrp || data.salePrice,
                gstRate: data.gstRate,
                openingStock: data.stock,
                stock: data.stock,
                reorderLevel: data.reorderLevel,
                imageUrl: null,
                expiresAt: null,
                autoDeleteAt: null,
                autoDeleteEnabled: false,
                isSalesPriceInclusiveGst: data.isSalesPriceInclusiveGst,
                description: data.description ?? null,
                location: data.location ?? null,
                trackStock: true,
                isActive: true,
            };
            if (editId) {
                return itemApi.update(editId, payload);
            }
            return itemApi.create(payload);
        },
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['items'] }); router.back(); },
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Failed to save item'),
    });

    const gstRate = watch('gstRate');

    const UNITS = ['pcs', 'kg', 'g', 'L', 'mL', 'box', 'm', 'ft', 'dozen', 'pack'];

    useEffect(() => {
        const item = editItemData?.item;
        if (!item) return;
        setValue('name', item.name ?? '');
        setValue('sku', item.sku ?? '');
        setValue('barcode', item.barcode ?? '');
        setValue('hsnCode', item.hsnCode ?? '');
        setValue('category', item.category ?? '');
        setValue('unit', item.unit ?? 'pcs');
        setValue('salePrice', Number(item.salePrice ?? 0));
        setValue('purchasePrice', Number(item.purchasePrice ?? 0));
        setValue('mrp', Number(item.mrp ?? 0));
        setValue('gstRate', Number(item.gstRate ?? 0));
        setValue('stock', Number(item.stock ?? 0));
        setValue('reorderLevel', Number(item.reorderLevel ?? 0));
        setValue('isSalesPriceInclusiveGst', Boolean(item.isSalesPriceInclusiveGst));
        setValue('description', item.description ?? '');
        setValue('location', item.location ?? '');
    }, [editItemData?.item, setValue]);

    useEffect(() => {
        const scannedFlag = Array.isArray(params.scanned) ? params.scanned[0] : params.scanned;
        const code = Array.isArray(params.barcode) ? params.barcode[0] : params.barcode;
        const scanField = Array.isArray(params.scanField) ? params.scanField[0] : params.scanField;
        if (code && scannedFlag === 'true') {
            if (scanField === 'hsn') {
                setValue('hsnCode', code);
            } else {
                setValue('barcode', code);
            }
        }
    }, [params.barcode, params.scanned, params.scanAt, params.scanField, setValue]);

    if (editId && editItemLoading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Cancel</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>{editId ? 'Edit Item' : 'Add Item'}</Text>
                <Pressable onPress={handleSubmit((d) => mutate(d))} disabled={isPending}>
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
                <View style={s.section}>
                    <Text style={s.sectionTitle}>BASIC INFO</Text>

                    <Field label="Item Name *" error={errors.name?.message} colors={colors}>
                        <Controller control={control} name="name" render={({ field: { onChange, value } }) => (
                            <TextInput style={inp(colors)} value={value} onChangeText={onChange} placeholder="Product/service name" placeholderTextColor={colors.textSecondary} />
                        )} />
                    </Field>

                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Field label="SKU / Code" colors={colors}>
                                <Controller control={control} name="sku" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={value} onChangeText={onChange} placeholder="Item code" placeholderTextColor={colors.textSecondary} />
                                )} />
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Barcode" colors={colors}>
                                <Controller control={control} name="barcode" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={value} onChangeText={onChange} placeholder="EAN / QR" placeholderTextColor={colors.textSecondary} />
                                )} />
                                <Pressable
                                    style={s.scanInlineAction}
                                    onPress={() => router.push({
                                        pathname: '/scan',
                                        params: {
                                            target: 'item_detail',
                                            returnPath: editId ? `/(main)/inventory/add-item?id=${editId}` : '/(main)/inventory/add-item',
                                            scanField: 'barcode',
                                        },
                                    })}
                                >
                                    <Text style={[s.scanInlineText, { color: colors.primary }]}>Scan Barcode</Text>
                                </Pressable>
                            </Field>
                        </View>
                    </View>

                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Field label="HSN Code" colors={colors}>
                                <Controller control={control} name="hsnCode" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={value} onChangeText={onChange} placeholder="GST HSN" placeholderTextColor={colors.textSecondary} />
                                )} />
                                <Pressable
                                    style={s.scanInlineAction}
                                    onPress={() => router.push({
                                        pathname: '/scan',
                                        params: {
                                            target: 'item_detail',
                                            returnPath: editId ? `/(main)/inventory/add-item?id=${editId}` : '/(main)/inventory/add-item',
                                            scanField: 'hsn',
                                        },
                                    })}
                                >
                                    <Text style={[s.scanInlineText, { color: colors.primary }]}>Scan HSN</Text>
                                </Pressable>
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Category" colors={colors}>
                                <Controller control={control} name="category" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={value} onChangeText={onChange} placeholder="Electronics…" placeholderTextColor={colors.textSecondary} />
                                )} />
                            </Field>
                        </View>
                    </View>

                    <Field label="Unit" colors={colors}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                                {UNITS.map((u) => {
                                    const unit = watch('unit');
                                    return (
                                        <Pressable key={u} style={[s.unitChip, { backgroundColor: unit === u ? colors.primary : colors.surfaceVariant }]} onPress={() => setValue('unit', u)}>
                                            <Text style={{ color: unit === u ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>{u}</Text>
                                        </Pressable>
                                    );
                                })}
                            </View>
                        </ScrollView>
                    </Field>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>PRICING</Text>

                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Field label="Sale Price (₹) *" error={errors.salePrice?.message} colors={colors}>
                                <Controller control={control} name="salePrice" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={String(value)} onChangeText={onChange} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textSecondary} />
                                )} />
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="MRP (₹)" colors={colors}>
                                <Controller control={control} name="mrp" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={String(value)} onChangeText={onChange} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textSecondary} />
                                )} />
                            </Field>
                        </View>
                    </View>

                    <Field label="Purchase Price (₹)" colors={colors}>
                        <Controller control={control} name="purchasePrice" render={({ field: { onChange, value } }) => (
                            <TextInput style={inp(colors)} value={String(value)} onChangeText={onChange} keyboardType="numeric" placeholder="0.00" placeholderTextColor={colors.textSecondary} />
                        )} />
                    </Field>

                    <Field label="GST Rate %" colors={colors}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
                                {GST_RATES.map((r) => (
                                    <Pressable key={r} style={[s.unitChip, { backgroundColor: gstRate === r ? colors.primary : colors.surfaceVariant }]} onPress={() => setValue('gstRate', r)}>
                                        <Text style={{ color: gstRate === r ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>{r}%</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>
                    </Field>

                    <View style={s.toggleRow}>
                        <Text style={{ color: colors.text, flex: 1 }}>Sale price inclusive of GST</Text>
                        <Controller control={control} name="isSalesPriceInclusiveGst" render={({ field: { onChange, value } }) => (
                            <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
                        )} />
                    </View>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>STOCK</Text>
                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Field label="Opening Stock" colors={colors}>
                                <Controller control={control} name="stock" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={String(value)} onChangeText={onChange} keyboardType="numeric" placeholder="0" placeholderTextColor={colors.textSecondary} />
                                )} />
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Reorder Level" colors={colors}>
                                <Controller control={control} name="reorderLevel" render={({ field: { onChange, value } }) => (
                                    <TextInput style={inp(colors)} value={String(value)} onChangeText={onChange} keyboardType="numeric" placeholder="5" placeholderTextColor={colors.textSecondary} />
                                )} />
                            </Field>
                        </View>
                    </View>
                    <Field label="Storage Location" colors={colors}>
                        <Controller control={control} name="location" render={({ field: { onChange, value } }) => (
                            <TextInput style={inp(colors)} value={value} onChangeText={onChange} placeholder="Shelf A3, Rack 2…" placeholderTextColor={colors.textSecondary} />
                        )} />
                    </Field>
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function Field({ label, children, error, colors }: { label: string; children: React.ReactNode; error?: string; colors: ColorPalette }) {
    return (
        <View style={{ marginBottom: Spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
            {children}
            {error && <Text style={{ color: colors.error, fontSize: 11, marginTop: 2 }}>{error}</Text>}
        </View>
    );
}

const inp = (colors: ColorPalette) => ({
    borderWidth: 1, borderColor: colors.border, borderRadius: Radius.md, padding: Spacing.md, color: colors.text, fontSize: 14,
});

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { fontWeight: '700', fontSize: 17, flex: 1, textAlign: 'center' },
    save: { fontWeight: '700', fontSize: 15 },
    section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    sectionTitle: { color: colors.textSecondary, fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
    row: { flexDirection: 'row', gap: Spacing.sm },
    unitChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
    toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
    scanInlineAction: { marginTop: 6 },
    scanInlineText: { fontSize: 12, fontWeight: '700' },
});



