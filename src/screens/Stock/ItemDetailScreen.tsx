
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { COMMON_TEXT, STOCK_TEXT } from '../../constants/staticText';
import { useStock } from '../../hooks/useStock';

export const ItemDetailScreen = () => {
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const itemId = Array.isArray(params.id) ? params.id[0] : params.id;
    const isNew = itemId === 'new';
    const { addItem, updateItem, deleteItem, allItems, loading } = useStock();
    const router = useRouter();
    const theme = useTheme();

    const [form, setForm] = useState({
        name: '',
        price: '',
        stock: '',
        barcode: '',
    });

    useEffect(() => {
        if (!isNew && itemId) {
            const item = allItems.find(i => i.id === itemId);
            if (item) {
                setForm({
                    name: item.name,
                    price: item.price.toString(),
                    stock: item.stock.toString(),
                    barcode: item.barcode || '',
                });
            }
        }
    }, [itemId, isNew, allItems]);

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

        try {
            if (isNew) {
                await addItem({
                    name: form.name.trim(),
                    price: parsedPrice,
                    stock: parsedStock,
                    barcode: form.barcode.trim() || undefined,
                });
                Alert.alert(COMMON_TEXT.alerts.success, STOCK_TEXT.itemDetail.alerts.itemAdded);
                router.back();
            } else {
                if (!itemId) {
                    throw new Error(STOCK_TEXT.itemDetail.alerts.invalidItemId);
                }
                await updateItem(itemId, {
                    name: form.name.trim(),
                    price: parsedPrice,
                    stock: parsedStock,
                    barcode: form.barcode.trim() || undefined,
                });
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
            <ScrollView contentContainerStyle={{ paddingTop: 20 }}>
                <Text variant="headlineSmall" style={{ marginBottom: 20 }}>
                    {isNew ? STOCK_TEXT.itemDetail.addTitle : STOCK_TEXT.itemDetail.editTitle}
                </Text>

                <AppInput
                    label={STOCK_TEXT.itemDetail.fields.itemName}
                    value={form.name}
                    onChangeText={t => setForm({ ...form, name: t })}
                />
                
                <View style={{ flexDirection: 'row' }}>
                    <AppInput
                        label={STOCK_TEXT.itemDetail.fields.price}
                        value={form.price}
                        onChangeText={t => setForm({ ...form, price: t })}
                        keyboardType="numeric"
                        style={{ flex: 1, marginRight: 8 }}
                    />
                    <AppInput
                        label={STOCK_TEXT.itemDetail.fields.stock}
                        value={form.stock}
                        onChangeText={t => setForm({ ...form, stock: t })}
                        keyboardType="numeric"
                        style={{ flex: 1, marginLeft: 8 }}
                    />
                </View>

                <AppInput
                    label={STOCK_TEXT.itemDetail.fields.barcode}
                    value={form.barcode}
                    onChangeText={t => setForm({ ...form, barcode: t })}
                />

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
