import { useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    ScrollView,
    Pressable,
    StyleSheet,
    useColorScheme,
    Alert,
    ActivityIndicator,
    Switch,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toUserMessage } from '../../../api/client';
import { itemApi, settingsApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import { GST_SLABS } from '../../../constants/gstRates';
import { useScannerMode } from '../../../hooks/useScannerMode';
import { useAuthStore } from '../../../store/authStore';
import { canPerformAction } from '../../../utils/accessControl';
import { getItemCategoryOptions, getItemUnitOptions } from '../../../utils/itemMasters';

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
    const scanner = useScannerMode();
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);

    const {
        control,
        handleSubmit,
        watch,
        setValue,
        formState: { errors },
    } = useForm<ItemFormInput, unknown, ItemForm>({
        resolver: zodResolver(itemSchema),
        defaultValues: {
            unit: 'pcs',
            gstRate: 18,
            stock: 0,
            reorderLevel: 5,
            salePrice: 0,
            purchasePrice: 0,
            mrp: 0,
            isSalesPriceInclusiveGst: false,
        },
    });

    const { data: editItemData, isLoading: editItemLoading } = useQuery({
        queryKey: ['item', editId],
        queryFn: () => itemApi.get(editId!),
        enabled: Boolean(editId),
    });

    const { data: itemSettingsRes } = useQuery({
        queryKey: ['settings-section', 'ITEM_SETTINGS'],
        queryFn: () => settingsApi.get('ITEM_SETTINGS'),
    });

    const itemSettings = (itemSettingsRes?.data ?? {}) as Record<string, unknown>;
    const unitOptions = getItemUnitOptions(itemSettings);
    const categoryOptions = getItemCategoryOptions(itemSettings);
    const canSaveItem = canPerformAction(role, editId ? 'inventory.update' : 'inventory.create', subscription);

    const selectedUnit = watch('unit');
    const selectedCategory = watch('category');
    const gstRate = watch('gstRate');

    const { mutate, isPending } = useMutation({
        mutationFn: (data: ItemForm) => {
            if (!canSaveItem) {
                throw new Error('Your role does not have permission to save inventory items.');
            }

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
        onSuccess: async () => {
            await qc.invalidateQueries({ queryKey: ['items'] });
            router.back();
        },
        onError: (error) => Alert.alert('Error', toUserMessage(error, 'Failed to save item.')),
    });

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
        if (editId) return;

        const defaultUnit = typeof itemSettings.default_unit === 'string'
            ? itemSettings.default_unit.trim()
            : '';

        if (!defaultUnit) return;
        setValue('unit', defaultUnit);
    }, [editId, itemSettings.default_unit, setValue]);

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

    const handleScanField = (field: 'barcode' | 'hsn') => {
        if (scanner.canUseCameraScanner) {
            router.push({
                pathname: '/scan',
                params: {
                    target: 'item_detail',
                    returnPath: editId ? `/(main)/inventory/add-item?id=${editId}` : '/(main)/inventory/add-item',
                    scanField: field,
                },
            });
            return;
        }

        if (!scanner.barcodeEnabled) {
            Alert.alert('Scanner disabled', 'Enable barcode scanning in Settings > Item Settings.');
            return;
        }

        Alert.alert('USB scanner mode', `Use a connected USB scanner and scan directly into the ${field === 'barcode' ? 'Barcode' : 'HSN'} field.`);
    };

    if (editId && editItemLoading) {
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
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Cancel</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>{editId ? 'Edit Item' : 'Add Item'}</Text>
                <Pressable
                    onPress={handleSubmit((data) => {
                        if (!canSaveItem) {
                            Alert.alert('Access denied', 'Your role cannot save inventory items.');
                            return;
                        }
                        mutate(data);
                    })}
                    disabled={isPending || !canSaveItem}
                >
                    {isPending ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: colors.primary }]}>Save</Text>}
                </Pressable>
            </View>

            {!canSaveItem ? (
                <View style={s.permissionHintWrap}>
                    <Text style={[s.permissionHint, { color: colors.textSecondary }]}>
                        Your role has read-only inventory access.
                    </Text>
                </View>
            ) : null}

            <ScrollView keyboardShouldPersistTaps="handled">
                {scanner.isUsbScannerMode ? (
                    <View style={s.helperWrap}>
                        <Text style={{ color: colors.textSecondary, fontSize: 11 }}>
                            USB scanner mode active. Place cursor in Barcode/HSN fields and scan from hardware scanner.
                        </Text>
                    </View>
                ) : null}

                <View style={s.section}>
                    <Text style={s.sectionTitle}>BASIC INFO</Text>

                    <Field label="Item Name *" error={errors.name?.message} colors={colors}>
                        <Controller
                            control={control}
                            name="name"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={inp(colors)}
                                    value={value}
                                    onChangeText={onChange}
                                    placeholder="Product/service name"
                                    placeholderTextColor={colors.textSecondary}
                                />
                            )}
                        />
                    </Field>

                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Field label="SKU / Code" colors={colors}>
                                <Controller
                                    control={control}
                                    name="sku"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={inp(colors)}
                                            value={value}
                                            onChangeText={onChange}
                                            placeholder="Item code"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    )}
                                />
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Barcode" colors={colors}>
                                <Controller
                                    control={control}
                                    name="barcode"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={inp(colors)}
                                            value={value}
                                            onChangeText={onChange}
                                            placeholder="EAN / QR"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    )}
                                />
                                <Pressable style={s.scanInlineAction} onPress={() => handleScanField('barcode')}>
                                    <Text style={[s.scanInlineText, { color: colors.primary }]}>
                                        {scanner.canUseCameraScanner ? 'Scan Barcode' : scanner.isUsbScannerMode ? 'Use USB Scanner' : 'Scanner Off'}
                                    </Text>
                                </Pressable>
                            </Field>
                        </View>
                    </View>

                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Field label="HSN Code" colors={colors}>
                                <Controller
                                    control={control}
                                    name="hsnCode"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={inp(colors)}
                                            value={value}
                                            onChangeText={onChange}
                                            placeholder="GST HSN"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    )}
                                />
                                <Pressable style={s.scanInlineAction} onPress={() => handleScanField('hsn')}>
                                    <Text style={[s.scanInlineText, { color: colors.primary }]}>
                                        {scanner.canUseCameraScanner ? 'Scan HSN' : scanner.isUsbScannerMode ? 'Use USB Scanner' : 'Scanner Off'}
                                    </Text>
                                </Pressable>
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Category" colors={colors}>
                                <Controller
                                    control={control}
                                    name="category"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={inp(colors)}
                                            value={value}
                                            onChangeText={onChange}
                                            placeholder="Electronics..."
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    )}
                                />
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.suggestionList}>
                                    <View style={s.suggestionRow}>
                                        {categoryOptions.map((entry) => {
                                            const selected = (selectedCategory ?? '').toLowerCase() === entry.toLowerCase();
                                            return (
                                                <Pressable
                                                    key={entry}
                                                    style={[s.suggestionChip, { backgroundColor: selected ? colors.primary : colors.surfaceVariant }]}
                                                    onPress={() => setValue('category', entry)}
                                                >
                                                    <Text style={{ color: selected ? '#fff' : colors.text, fontWeight: '600', fontSize: 12 }}>
                                                        {entry}
                                                    </Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </ScrollView>
                                <Pressable
                                    style={s.scanInlineAction}
                                    onPress={() => router.push('/(main)/more/item-masters?focus=categories' as Parameters<typeof router.push>[0])}
                                >
                                    <Text style={[s.scanInlineText, { color: colors.primary }]}>Manage Categories</Text>
                                </Pressable>
                            </Field>
                        </View>
                    </View>

                    <Field label="Unit" colors={colors}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={s.suggestionRow}>
                                {unitOptions.map((entry) => (
                                    <Pressable
                                        key={entry}
                                        style={[s.unitChip, { backgroundColor: selectedUnit === entry ? colors.primary : colors.surfaceVariant }]}
                                        onPress={() => setValue('unit', entry)}
                                    >
                                        <Text style={{ color: selectedUnit === entry ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                                            {entry}
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>
                        <Pressable
                            style={s.scanInlineAction}
                            onPress={() => router.push('/(main)/more/item-masters?focus=units' as Parameters<typeof router.push>[0])}
                        >
                            <Text style={[s.scanInlineText, { color: colors.primary }]}>Manage Units</Text>
                        </Pressable>
                    </Field>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>PRICING</Text>

                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Field label="Sale Price (Rs) *" error={errors.salePrice?.message} colors={colors}>
                                <Controller
                                    control={control}
                                    name="salePrice"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={inp(colors)}
                                            value={String(value)}
                                            onChangeText={onChange}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    )}
                                />
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="MRP (Rs)" colors={colors}>
                                <Controller
                                    control={control}
                                    name="mrp"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={inp(colors)}
                                            value={String(value)}
                                            onChangeText={onChange}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    )}
                                />
                            </Field>
                        </View>
                    </View>

                    <Field label="Purchase Price (Rs)" colors={colors}>
                        <Controller
                            control={control}
                            name="purchasePrice"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={inp(colors)}
                                    value={String(value)}
                                    onChangeText={onChange}
                                    keyboardType="numeric"
                                    placeholder="0.00"
                                    placeholderTextColor={colors.textSecondary}
                                />
                            )}
                        />
                    </Field>

                    <Field label="GST Rate %" colors={colors}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            <View style={s.suggestionRow}>
                                {GST_RATES.map((entry) => (
                                    <Pressable
                                        key={entry}
                                        style={[s.unitChip, { backgroundColor: gstRate === entry ? colors.primary : colors.surfaceVariant }]}
                                        onPress={() => setValue('gstRate', entry)}
                                    >
                                        <Text style={{ color: gstRate === entry ? '#fff' : colors.text, fontWeight: '600', fontSize: 13 }}>
                                            {entry}%
                                        </Text>
                                    </Pressable>
                                ))}
                            </View>
                        </ScrollView>
                    </Field>

                    <View style={s.toggleRow}>
                        <Text style={{ color: colors.text, flex: 1 }}>Sale price inclusive of GST</Text>
                        <Controller
                            control={control}
                            name="isSalesPriceInclusiveGst"
                            render={({ field: { onChange, value } }) => (
                                <Switch value={value} onValueChange={onChange} trackColor={{ true: colors.primary }} />
                            )}
                        />
                    </View>
                </View>

                <View style={s.section}>
                    <Text style={s.sectionTitle}>STOCK</Text>
                    <View style={s.row}>
                        <View style={{ flex: 1 }}>
                            <Field label="Opening Stock" colors={colors}>
                                <Controller
                                    control={control}
                                    name="stock"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={inp(colors)}
                                            value={String(value)}
                                            onChangeText={onChange}
                                            keyboardType="numeric"
                                            placeholder="0"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    )}
                                />
                            </Field>
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Reorder Level" colors={colors}>
                                <Controller
                                    control={control}
                                    name="reorderLevel"
                                    render={({ field: { onChange, value } }) => (
                                        <TextInput
                                            style={inp(colors)}
                                            value={String(value)}
                                            onChangeText={onChange}
                                            keyboardType="numeric"
                                            placeholder="5"
                                            placeholderTextColor={colors.textSecondary}
                                        />
                                    )}
                                />
                            </Field>
                        </View>
                    </View>
                    <Field label="Storage Location" colors={colors}>
                        <Controller
                            control={control}
                            name="location"
                            render={({ field: { onChange, value } }) => (
                                <TextInput
                                    style={inp(colors)}
                                    value={value}
                                    onChangeText={onChange}
                                    placeholder="Shelf A3, Rack 2..."
                                    placeholderTextColor={colors.textSecondary}
                                />
                            )}
                        />
                    </Field>
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function Field({
    label,
    children,
    error,
    colors,
}: {
    label: string;
    children: React.ReactNode;
    error?: string;
    colors: ColorPalette;
}) {
    return (
        <View style={{ marginBottom: Spacing.md }}>
            <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '600', marginBottom: 4 }}>{label}</Text>
            {children}
            {error && <Text style={{ color: colors.error, fontSize: 11, marginTop: 2 }}>{error}</Text>}
        </View>
    );
}

const inp = (colors: ColorPalette) => ({
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: Radius.md,
    padding: Spacing.md,
    color: colors.text,
    fontSize: 14,
});

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        helperWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        permissionHintWrap: {
            paddingHorizontal: Spacing.lg,
            paddingBottom: Spacing.sm,
        },
        permissionHint: {
            fontSize: 12,
        },
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
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        sectionTitle: {
            color: colors.textSecondary,
            fontSize: 11,
            fontWeight: '700',
            letterSpacing: 0.8,
            marginBottom: Spacing.sm,
        },
        row: { flexDirection: 'row', gap: Spacing.sm },
        suggestionList: { marginTop: Spacing.xs },
        suggestionRow: { flexDirection: 'row', gap: Spacing.sm },
        suggestionChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
        unitChip: { borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 6 },
        toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.sm },
        scanInlineAction: { marginTop: 6 },
        scanInlineText: { fontSize: 12, fontWeight: '700' },
    });
