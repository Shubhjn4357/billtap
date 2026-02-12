
import React, { useState, useMemo } from 'react';
import { View, FlatList, Alert } from 'react-native';
import { Text, Searchbar, Divider, useTheme } from 'react-native-paper';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { useStock } from '../../hooks/useStock';
import { useAuth } from '../../hooks/useAuth';
import { useCartStore } from '../../store/cartStore';
import { billService } from '../../api/billService';
import { shareBillPDF } from '../../utils/pdfGenerator';
import { formatCurrency } from '../../utils/formatters';

export const BillingScreen = () => {
    const { items } = useStock();
    const { user } = useAuth();
    const theme = useTheme();

    const { items: cart, total, addItem, updateQuantity, removeItem, clearCart } = useCartStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [checkoutLoading, setCheckoutLoading] = useState(false);

    const filteredItems = useMemo(() => {
        if (!searchQuery) return [];
        return items.filter(i =>
            i.nameLowercase.includes(searchQuery.toLowerCase()) ||
            (i.barcode && i.barcode.includes(searchQuery))
        );
    }, [items, searchQuery]);

    const handleCheckout = async () => {
        if (cart.length === 0) return;
        if (!user) return;
        setCheckoutLoading(true);
        try {
            const billData = {
                userId: user.uid,
                items: cart,
                total: total,
                createdAt: new Date(),
            };

            const billId = await billService.createBill(billData);

            Alert.alert(
                'Bill Created',
                'Share or Print Bill?',
                [
                    { text: 'Cancel', onPress: () => clearCart() },
                    {
                        text: 'Share PDF',
                        onPress: async () => {
                            await shareBillPDF({ ...billData, id: billId });
                            clearCart();
                        }
                    }
                ]
            );
        } catch (e: any) {
            Alert.alert('Error', e.message);
        } finally {
            setCheckoutLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <View style={{ paddingVertical: 10 }}>
                <Searchbar
                    placeholder="Search item to add..."
                    onChangeText={setSearchQuery}
                    value={searchQuery}
                />
            </View>

            {searchQuery.length > 0 && (
                <View style={{ maxHeight: 200, backgroundColor: theme.colors.elevation.level1, borderRadius: 8, marginBottom: 10 }}>
                    <FlatList
                        data={filteredItems}
                        keyExtractor={i => i.id}
                        renderItem={({ item }) => (
                            <AppButton
                                mode="text"
                                onPress={() => { addItem(item); setSearchQuery(''); }}
                                contentStyle={{ justifyContent: 'flex-start' }}
                            >
                                {item.name} - {formatCurrency(item.price)}
                            </AppButton>
                        )}
                    />
                </View>
            )}

            <Divider style={{ marginVertical: 10 }} />

            <View style={{ flex: 1 }}>
                <Text variant="titleMedium" style={{ marginBottom: 10 }}>Current Bill</Text>
                <FlatList
                    data={cart}
                    keyExtractor={i => i.id}
                    renderItem={({ item }) => (
                        <AppCard style={{ marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <View style={{ flex: 1 }}>
                                    <Text variant="bodyLarge" style={{ fontWeight: 'bold' }}>{item.name}</Text>
                                    <Text variant="bodyMedium">{formatCurrency(item.price)} x {item.quantity}</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                    <AppButton mode="text" onPress={() => updateQuantity(item.id, -1)} compact>-</AppButton>
                                    <Text>{item.quantity}</Text>
                                    <AppButton mode="text" onPress={() => updateQuantity(item.id, 1)} compact>+</AppButton>
                                    <AppButton mode="text" onPress={() => removeItem(item.id)} textColor={theme.colors.error} compact icon="delete"> </AppButton>
                                </View>
                            </View>
                        </AppCard>
                    )}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
            </View>

            <View style={{
                position: 'absolute',
                bottom: 80,
                left: 16,
                right: 16,
                backgroundColor: theme.colors.primaryContainer,
                padding: 16,
                borderRadius: 16,
                elevation: 4,
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center'
            }}>
                <View>
                    <Text variant="labelMedium" style={{ color: theme.colors.onPrimaryContainer }}>Total</Text>
                    <Text variant="headlineSmall" style={{ fontWeight: 'bold', color: theme.colors.onPrimaryContainer }}>{formatCurrency(total)}</Text>
                </View>
                <AppButton
                    mode="contained"
                    onPress={handleCheckout}
                    loading={checkoutLoading}
                    disabled={cart.length === 0}
                >
                    Checkout
                </AppButton>
            </View>
        </ScreenWrapper>
    );
};
