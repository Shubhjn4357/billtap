
import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { Text, useTheme, ActivityIndicator } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { useStock } from '../../hooks/useStock';
import { Item } from '../../types';

export const ItemDetailScreen = () => {
    const { id } = useLocalSearchParams();
    const isNew = id === 'new';
    const { addItem, items, loading } = useStock();
    const router = useRouter();
    const theme = useTheme();

    const [form, setForm] = useState({
        name: '',
        price: '',
        stock: '',
        barcode: '',
    });

    useEffect(() => {
        if (!isNew && id) {
            const item = items.find(i => i.id === id);
            if (item) {
                setForm({
                    name: item.name,
                    price: item.price.toString(),
                    stock: item.stock.toString(),
                    barcode: item.barcode || '',
                });
            }
        }
    }, [id, isNew, items]);

    const handleSubmit = async () => {
        if (!form.name || !form.price || !form.stock) {
            return Alert.alert('Error', 'Please fill required fields');
        }

        try {
            if (isNew) {
                await addItem({
                    name: form.name,
                    price: parseFloat(form.price),
                    stock: parseInt(form.stock),
                    barcode: form.barcode,
                });
                Alert.alert('Success', 'Item added');
                router.back();
            } else {
                // Update logic... (Need to implement update in useStock/itemService)
                // updateItem(...)
                Alert.alert('Info', 'Update not implemented in this demo phase');
            }
        } catch (e: any) {
            Alert.alert('Error', e.message);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 20 }}>
                <Text variant="headlineSmall" style={{ marginBottom: 20 }}>
                    {isNew ? 'Add New Item' : 'Edit Item'}
                </Text>

                <AppInput
                    label="Item Name"
                    value={form.name}
                    onChangeText={t => setForm({ ...form, name: t })}
                />
                
                <View style={{ flexDirection: 'row' }}>
                    <AppInput
                        label="Price"
                        value={form.price}
                        onChangeText={t => setForm({ ...form, price: t })}
                        keyboardType="numeric"
                        style={{ flex: 1, marginRight: 8 }}
                    />
                    <AppInput
                        label="Stock"
                        value={form.stock}
                        onChangeText={t => setForm({ ...form, stock: t })}
                        keyboardType="numeric"
                        style={{ flex: 1, marginLeft: 8 }}
                    />
                </View>

                <AppInput
                    label="Barcode (Optional)"
                    value={form.barcode}
                    onChangeText={t => setForm({ ...form, barcode: t })}
                />

                <AppButton 
                    mode="contained" 
                    onPress={handleSubmit} 
                    loading={loading}
                    style={{ marginTop: 20 }}
                >
                    {isNew ? 'Save Item' : 'Update Item'}
                </AppButton>
            </ScrollView>
        </ScreenWrapper>
    );
};
