
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert, StyleSheet } from 'react-native';
import { Text, useTheme, SegmentedButtons, TextInput } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { COMMON_TEXT, STOCK_TEXT } from '../../constants/staticText';
import { useStock } from '../../hooks/useStock';
import { Config } from '../../constants/Config';

export const ItemDetailScreen = () => {
    const params = useLocalSearchParams<{ id?: string | string[]; barcode?: string | string[]; scanned?: string }>();
    const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
    const isNew = itemId === 'new';
    const { addItem, updateItem, deleteItem, allItems, loading } = useStock();
    const router = useRouter();
    const theme = useTheme();

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

        const payload = {
            name: form.name.trim(),
            category: form.category.trim() || undefined,
            subcategory: form.subcategory.trim() || undefined,
            price: parsedPrice,
            purchasePrice: form.purchasePrice ? Number(form.purchasePrice) : undefined,
            mrp: form.mrp ? Number(form.mrp) : undefined,
            hsn: form.hsn.trim() || undefined,
            gstPercentage: form.gstPercentage,
            stock: parsedStock,
            minimumStock: form.minimumStock ? Number(form.minimumStock) : undefined,
            unit: form.unit,
            location: form.location.trim() || undefined,
            barcode: form.barcode.trim() || undefined,
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
            <ScrollView contentContainerStyle={{ paddingTop: 20, paddingBottom: 40 }}>
                <PageHeaderCard
                    title={isNew ? STOCK_TEXT.itemDetail.addTitle : STOCK_TEXT.itemDetail.editTitle}
                    subtitle="Configure pricing, stock controls, tax and identifiers."
                />

                <Section title="Basic Details">
                    <AppInput
                        label={STOCK_TEXT.itemDetail.fields.itemName}
                        value={form.name}
                        onChangeText={t => setForm({ ...form, name: t })}
                    />
                    <View style={styles.row}>
                        <AppInput
                            label="Category"
                            value={form.category}
                            onChangeText={t => setForm({ ...form, category: t })}
                            style={styles.halfInput}
                        />
                        <AppInput
                            label="Subcategory"
                            value={form.subcategory}
                            onChangeText={t => setForm({ ...form, subcategory: t })}
                            style={styles.halfInput}
                        />
                    </View>
                </Section>

                <Section title="Pricing & Tax">
                    <View style={styles.row}>
                        <AppInput
                            label={STOCK_TEXT.itemDetail.fields.price}
                            value={form.price}
                            onChangeText={t => setForm({ ...form, price: t })}
                            keyboardType="numeric"
                            style={styles.halfInput}
                        />
                        <AppInput
                            label="MRP"
                            value={form.mrp}
                            onChangeText={t => setForm({ ...form, mrp: t })}
                            keyboardType="numeric"
                            style={styles.halfInput}
                        />
                    </View>
                    <View style={styles.row}>
                        <AppInput
                            label="Purchase Price"
                            value={form.purchasePrice}
                            onChangeText={t => setForm({ ...form, purchasePrice: t })}
                            keyboardType="numeric"
                            style={styles.halfInput}
                        />
                        <AppInput
                            label="HSN Code"
                            value={form.hsn}
                            onChangeText={t => setForm({ ...form, hsn: t })}
                            style={styles.halfInput}
                        />
                    </View>
                    <View style={{ marginBottom: 16 }}>
                        <Text variant="bodySmall" style={{ marginBottom: 8 }}>GST Rate (%)</Text>
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
                            keyboardType="numeric"
                            style={styles.halfInput}
                        />
                        <AppInput
                            label="Min Stock"
                            value={form.minimumStock}
                            onChangeText={t => setForm({ ...form, minimumStock: t })}
                            keyboardType="numeric"
                            style={styles.halfInput}
                        />
                    </View>
                    <View style={styles.row}>
                        <AppInput
                            label="Unit"
                            value={form.unit}
                            onChangeText={t => setForm({ ...form, unit: t })}
                            style={styles.halfInput}
                        />
                        <AppInput
                            label="Location"
                            value={form.location}
                            onChangeText={t => setForm({ ...form, location: t })}
                            style={styles.halfInput}
                        />
                    </View>
                </Section>

                <Section title="Identifiers">
                    <AppInput
                        label={STOCK_TEXT.itemDetail.fields.barcode}
                        value={form.barcode}
                        onChangeText={t => setForm({ ...form, barcode: t })}
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
                    style={{ marginTop: 20 }}
                >
                    {isNew ? STOCK_TEXT.itemDetail.actions.saveItem : STOCK_TEXT.itemDetail.actions.updateItem}
                </AppButton>

                {!isNew && (
                    <AppButton
                        mode="outlined"
                        onPress={handleDelete}
                        loading={loading}
                        style={{ marginTop: 10 }}
                        textColor={theme.colors.error}
                        icon="delete"
                    >
                        {STOCK_TEXT.itemDetail.actions.deleteItem}
                    </AppButton>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};

const Section = ({ title, children }: { title: string, children: React.ReactNode }) => (
    <View style={styles.section}>
        <Text variant="titleMedium" style={styles.sectionTitle}>{title}</Text>
        {children}
    </View>
);

const styles = StyleSheet.create({
    section: { marginBottom: 24 },
    sectionTitle: { marginBottom: 12, fontWeight: 'bold' },
    row: { flexDirection: 'row', gap: 12 },
    halfInput: { flex: 1 },
});
