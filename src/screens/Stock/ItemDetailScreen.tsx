
import React, { useState, useEffect } from 'react';
import { Alert, Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme, SegmentedButtons, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { COMMON_TEXT, STOCK_TEXT } from '../../constants/staticText';
import { useStock } from '../../hooks/useStock';
import { Config } from '../../constants/Config';
import { mediaService } from '../../api/mediaService';
import { useOrganizationStore } from '../../store';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { DesignSystem } from '../../constants/DesignSystem';
import { itemSchema } from '../../validation/forms';

export const ItemDetailScreen = () => {
    const params = useLocalSearchParams<{ id?: string | string[]; barcode?: string | string[]; scanned?: string }>();
    const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
    // `/item/new` does not provide `id`, while `/item/[id]` passes `id`.
    const isNew = !itemId || itemId === 'new';
    const { addItem, updateItem, deleteItem, allItems, loading } = useStock();
    const { selectedOrganizationId } = useOrganizationStore();
    const { canManageInventory } = useOrganizationAccess();
    const router = useRouter();
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 980;
    const [uploadingImage, setUploadingImage] = useState(false);

    const [form, setForm] = useState({
        name: '',
        category: '',
        subcategory: '',

        // Pricing
        price: '', // Selling Price
        purchasePrice: '',
        mrp: '',

        // Tax
        hsn: '',
        gstPercentage: 0,

        // Stock
        stock: '',
        minimumStock: '',
        unit: 'pcs',
        location: '',

        barcode: '',
        imageUrl: '',
    });

    useEffect(() => {
        if (!isNew && itemId) {
            const item = allItems.find(i => i.id === itemId);
            if (item) {
                setForm({
                    name: item.name,
                    category: item.category || '',
                    subcategory: item.subcategory || '',
                    price: item.price.toString(),
                    purchasePrice: item.purchasePrice?.toString() || '',
                    mrp: item.mrp?.toString() || '',
                    hsn: item.hsn || '',
                    gstPercentage: item.gstPercentage || 0,
                    stock: item.stock.toString(),
                    minimumStock: item.minimumStock?.toString() || '',
                    unit: item.unit || 'pcs',
                    location: item.location || '',
                    barcode: item.barcode || '',
                    imageUrl: item.imageUrl || '',
                });
            }
        }
    }, [itemId, isNew, allItems]);

    useEffect(() => {
        if (params.barcode && params.scanned === 'true') {
            const code = Array.isArray(params.barcode) ? params.barcode[0] : params.barcode;
            setForm(prev => ({ ...prev, barcode: code }));
        }
    }, [params.barcode, params.scanned]);

    const handlePickAndUploadImage = async () => {
        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert(COMMON_TEXT.alerts.error, 'Media library permission is required.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 1,
            });
            if (result.canceled || result.assets.length === 0) return;

            const source = result.assets[0];
            const optimized = await ImageManipulator.manipulateAsync(
                source.uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );

            setUploadingImage(true);
            const uploaded = await mediaService.uploadFromUri({
                uri: optimized.uri,
                fileName: source.fileName || `item-${Date.now()}.jpg`,
                fileType: 'image/jpeg',
                assetType: 'PRODUCT_IMAGE',
                entityType: 'item',
                entityId: isNew ? undefined : itemId,
                organizationId: selectedOrganizationId ?? undefined,
            });

            setForm((prev) => ({ ...prev, imageUrl: uploaded.fileUrl }));
        } catch (error: unknown) {
            Alert.alert(
                COMMON_TEXT.alerts.error,
                error instanceof Error ? error.message : 'Failed to upload product image.'
            );
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSubmit = async () => {
        if (!form.name || !form.price || !form.stock) {
            return Alert.alert(COMMON_TEXT.alerts.error, STOCK_TEXT.itemDetail.alerts.fillRequired);
        }

        const parsedPrice = Number(form.price);
        const parsedStock = Number(form.stock);

        if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
            return Alert.alert(COMMON_TEXT.alerts.error, STOCK_TEXT.itemDetail.alerts.invalidPrice);
        }
        if (!Number.isInteger(parsedStock) || parsedStock < 0) {
            return Alert.alert(COMMON_TEXT.alerts.error, STOCK_TEXT.itemDetail.alerts.invalidStock);
        }

        const parsedPurchasePrice = form.purchasePrice ? Number(form.purchasePrice) : undefined;
        const parsedMrp = form.mrp ? Number(form.mrp) : undefined;
        const parsedMinimumStock = form.minimumStock ? Number(form.minimumStock) : undefined;
        const validation = itemSchema.safeParse({
            name: form.name,
            price: parsedPrice,
            stock: parsedStock,
            purchasePrice: parsedPurchasePrice,
            mrp: parsedMrp,
            gstPercentage: form.gstPercentage,
            minimumStock: parsedMinimumStock,
            category: form.category,
            subcategory: form.subcategory,
            unit: form.unit,
            location: form.location,
            hsn: form.hsn,
            barcode: form.barcode,
            imageUrl: form.imageUrl,
        });
        if (!validation.success) {
            return Alert.alert(COMMON_TEXT.alerts.error, validation.error.issues[0]?.message || STOCK_TEXT.itemDetail.alerts.saveFailed);
        }
        const values = validation.data;

        const payload = {
            name: values.name.trim(),
            category: values.category?.trim() || undefined,
            subcategory: values.subcategory?.trim() || undefined,
            price: values.price,
            purchasePrice: values.purchasePrice,
            mrp: values.mrp,
            hsn: values.hsn?.trim() || undefined,
            gstPercentage: values.gstPercentage,
            stock: values.stock,
            minimumStock: values.minimumStock,
            unit: values.unit?.trim() || 'pcs',
            location: values.location?.trim() || undefined,
            barcode: values.barcode?.trim() || undefined,
            imageUrl: values.imageUrl?.trim() || undefined,
        };

        try {
            if (isNew) {
                await addItem({ ...payload, openingStock: parsedStock });
                Alert.alert(COMMON_TEXT.alerts.success, STOCK_TEXT.itemDetail.alerts.itemAdded);
                router.back();
            } else {
                if (!itemId) throw new Error(STOCK_TEXT.itemDetail.alerts.invalidItemId);
                await updateItem(itemId, payload);
                Alert.alert(COMMON_TEXT.alerts.success, STOCK_TEXT.itemDetail.alerts.itemUpdated);
                router.back();
            }
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : STOCK_TEXT.itemDetail.alerts.saveFailed);
        }
    };

    const handleDelete = () => {
        if (isNew || !itemId) return;

        Alert.alert(
            STOCK_TEXT.itemDetail.alerts.deleteTitle,
            STOCK_TEXT.itemDetail.alerts.deleteBody,
            [
                { text: COMMON_TEXT.actions.cancel, style: 'cancel' },
                {
                    text: COMMON_TEXT.actions.delete,
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteItem(itemId);
                            Alert.alert(STOCK_TEXT.itemDetail.alerts.deletedTitle, STOCK_TEXT.itemDetail.alerts.deletedBody);
                            router.back();
                        } catch (error: unknown) {
                            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : STOCK_TEXT.itemDetail.alerts.deleteFailed);
                        }
                    },
                },
            ]
        );
    };

    return (
        <ScreenWrapper>
            {!canManageInventory ? (
                <View style={styles.blockedContainer}>
                    <PageHeaderCard
                        title="Inventory access disabled"
                        subtitle="Ask owner/admin to enable inventory permissions."
                    />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title={isNew ? STOCK_TEXT.itemDetail.addTitle : STOCK_TEXT.itemDetail.editTitle}
                            subtitle="Configure pricing, stock controls, tax and identifiers."
                        />

                        <Section title="Basic Details">
                            <AppInput
                                label={STOCK_TEXT.itemDetail.fields.itemName}
                                value={form.name}
                                onChangeText={t => setForm({ ...form, name: t })}
                                inputType="name"
                            />
                            <View style={styles.row}>
                                <AppInput
                                    label="Category"
                                    value={form.category}
                                    onChangeText={t => setForm({ ...form, category: t })}
                                    style={styles.halfInput}
                                    inputType="text"
                                />
                                <AppInput
                                    label="Subcategory"
                                    value={form.subcategory}
                                    onChangeText={t => setForm({ ...form, subcategory: t })}
                                    style={styles.halfInput}
                                    inputType="text"
                                />
                            </View>
                            {Boolean(form.imageUrl) && (
                                <View style={[styles.imagePreviewWrap, { borderColor: theme.colors.outline }]}>
                                    <Image
                                        source={{ uri: form.imageUrl }}
                                        resizeMode="cover"
                                        style={[styles.imagePreview, { backgroundColor: theme.colors.surfaceVariant }]}
                                    />
                                </View>
                            )}
                            <AppInput
                                label="Product Image URL"
                                value={form.imageUrl}
                                onChangeText={t => setForm({ ...form, imageUrl: t })}
                                placeholder="https://..."
                                inputType="url"
                            />
                            <View style={styles.row}>
                                <AppButton
                                    mode="contained-tonal"
                                    onPress={() => { void handlePickAndUploadImage(); }}
                                    loading={uploadingImage}
                                    style={styles.halfInput}
                                >
                                    Upload Product Image
                                </AppButton>
                                {Boolean(form.imageUrl) && (
                                    <AppButton
                                        mode="outlined"
                                        onPress={() => setForm((prev) => ({ ...prev, imageUrl: '' }))}
                                        style={styles.halfInput}
                                    >
                                        Remove Image
                                    </AppButton>
                                )}
                            </View>
                        </Section>

                        <Section title="Pricing & Tax">
                            <View style={styles.row}>
                                <AppInput
                                    label={STOCK_TEXT.itemDetail.fields.price}
                                    value={form.price}
                                    onChangeText={t => setForm({ ...form, price: t })}
                                    inputType="decimal"
                                    style={styles.halfInput}
                                />
                                <AppInput
                                    label="MRP"
                                    value={form.mrp}
                                    onChangeText={t => setForm({ ...form, mrp: t })}
                                    inputType="decimal"
                                    style={styles.halfInput}
                                />
                            </View>
                            <View style={styles.row}>
                                <AppInput
                                    label="Purchase Price"
                                    value={form.purchasePrice}
                                    onChangeText={t => setForm({ ...form, purchasePrice: t })}
                                    inputType="decimal"
                                    style={styles.halfInput}
                                />
                                <AppInput
                                    label="HSN Code"
                                    value={form.hsn}
                                    onChangeText={t => setForm({ ...form, hsn: t })}
                                    style={styles.halfInput}
                                    inputType="text"
                                />
                            </View>
                            <View style={styles.gstSection}>
                                <Text variant="bodySmall" style={styles.gstLabel}>GST Rate (%)</Text>
                                <SegmentedButtons
                                    value={form.gstPercentage.toString()}
                                    onValueChange={val => setForm({ ...form, gstPercentage: Number(val) })}
                                    buttons={Config.gstRates.map(rate => ({
                                        value: rate.toString(),
                                        label: `${rate}%`,
                                    }))}
                                    density="small"
                                />
                            </View>
                        </Section>

                        <Section title="Stock & Inventory">
                            <View style={styles.row}>
                                <AppInput
                                    label={STOCK_TEXT.itemDetail.fields.stock}
                                    value={form.stock}
                                    onChangeText={t => setForm({ ...form, stock: t })}
                                    inputType="number"
                                    style={styles.halfInput}
                                />
                                <AppInput
                                    label="Min Stock"
                                    value={form.minimumStock}
                                    onChangeText={t => setForm({ ...form, minimumStock: t })}
                                    inputType="number"
                                    style={styles.halfInput}
                                />
                            </View>
                            <View style={styles.row}>
                                <AppInput
                                    label="Unit"
                                    value={form.unit}
                                    onChangeText={t => setForm({ ...form, unit: t })}
                                    style={styles.halfInput}
                                    inputType="text"
                                />
                                <AppInput
                                    label="Location"
                                    value={form.location}
                                    onChangeText={t => setForm({ ...form, location: t })}
                                    style={styles.halfInput}
                                    inputType="text"
                                />
                            </View>
                        </Section>

                        <Section title="Identifiers">
                            <AppInput
                                label={STOCK_TEXT.itemDetail.fields.barcode}
                                value={form.barcode}
                                onChangeText={t => setForm({ ...form, barcode: t })}
                                inputType="text"
                                right={<TextInput.Icon icon="barcode-scan" onPress={() => router.push({
                                    pathname: '/scan',
                                    params: {
                                        target: 'item_detail',
                                        returnPath: isNew ? '/item/new' : `/item/${itemId}`
                                    }
                                })} />}
                            />
                        </Section>

                        <AppButton
                            mode="contained"
                            onPress={handleSubmit}
                            loading={loading}
                            style={styles.primaryAction}
                        >
                            {isNew ? STOCK_TEXT.itemDetail.actions.saveItem : STOCK_TEXT.itemDetail.actions.updateItem}
                        </AppButton>

                        {!isNew && (
                            <AppButton
                                mode="outlined"
                                onPress={handleDelete}
                                loading={loading}
                                style={styles.secondaryAction}
                                textColor={theme.colors.error}
                                icon="delete"
                            >
                                {STOCK_TEXT.itemDetail.actions.deleteItem}
                            </AppButton>
                        )}
                    </View>
                </ScrollView>
            )}
        </ScreenWrapper>
    );
};

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <AppCard style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>{title}</Text>
        {children}
    </AppCard>
);

const styles = StyleSheet.create({
    blockedContainer: {
        paddingTop: DesignSystem.layout.pageTop,
    },
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    section: { marginBottom: DesignSystem.spacing.xs },
    sectionTitle: { marginBottom: DesignSystem.spacing.sm, fontWeight: '700' },
    row: { flexDirection: 'row', gap: DesignSystem.spacing.sm },
    halfInput: { flex: 1 },
    gstSection: {
        marginBottom: DesignSystem.spacing.md,
    },
    gstLabel: {
        marginBottom: DesignSystem.spacing.xs,
    },
    imagePreviewWrap: {
        marginBottom: DesignSystem.spacing.sm,
        borderRadius: DesignSystem.radius.sm,
        overflow: 'hidden',
        borderWidth: 1,
    },
    imagePreview: {
        width: '100%',
        height: 160,
    },
    primaryAction: {
        marginTop: DesignSystem.spacing.sm,
    },
    secondaryAction: {
        marginTop: DesignSystem.spacing.xs,
    },
});
