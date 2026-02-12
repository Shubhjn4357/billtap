import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, Alert, Keyboard, TouchableOpacity } from 'react-native';
import { Text, Searchbar, FAB, useTheme, Card, IconButton, Button, TextInput, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { collection, query, getDocs, limit, where, addDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { InventoryItem, CartItem } from '../../../types';
import { useCartStore } from '../../../store/cartStore';
import { useUserStore } from '../../../store';
import * as Haptics from 'expo-haptics';
import { openWhatsApp } from '../../../lib/linking';

export default function BillingScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { items, addItem, removeItem, updateQuantity, total, clearCart, customerName, customerPhone, setCustomerDetails } = useCartStore();
    const { user } = useUserStore();

    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<InventoryItem[]>([]);
    const [isCheckoutMode, setCheckoutMode] = useState(false);

    // Search Logic
    useEffect(() => {
        if (searchQuery.length > 2) {
            const search = async () => {
                const q = query(collection(db, 'items'), limit(10));
                const snap = await getDocs(q);
                const results: InventoryItem[] = [];
                snap.forEach(doc => {
                    const data = doc.data() as Omit<InventoryItem, 'id'>;
                    if (data.name.toLowerCase().includes(searchQuery.toLowerCase()) || data.barcode?.includes(searchQuery)) {
                        results.push({ id: doc.id, ...data });
                    }
                });
                setSearchResults(results);
            }
            search();
        } else {
            setSearchResults([]);
        }
    }, [searchQuery]);

    const handleAddItem = (item: InventoryItem) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        addItem(item);
        setSearchQuery('');
        Keyboard.dismiss();
    };

    const handleCheckout = async () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

        if (!items.length) return;

        try {
            // 1. Save Transaction into Firestore
            // Note: In real app, batch write to update stock as well
            const transaction = {
                userId: user?.uid,
                type: 'SALE',
                items,
                totalAmount: total,
                taxAmount: 0, // Calculate if needed
                discountAmount: 0,
                paymentMethod: 'CASH',
                customerName,
                customerPhone,
                createdAt: Date.now(),
            };

            await addDoc(collection(db, 'transactions'), transaction);

            Alert.alert('Success', 'Transaction Completed', [
                {
                    text: 'Share Invoice',
                    onPress: () => {
                        // WhatsApp Share
                        if (customerPhone) {
                            const message = `Invoice from ${user?.businessName || 'BillTap'}.\nTotal: ₹${total}`;
                            openWhatsApp(message, customerPhone);
                        }
                    }
                },
                { text: 'OK' }
            ]);

            clearCart();
            setCheckoutMode(false);

        } catch (error) {
            console.error(error);
            Alert.alert('Error', 'Transaction failed');
        }
    };

    if (isCheckoutMode) {
        return (
            <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
                <Button mode="text" icon="arrow-left" onPress={() => setCheckoutMode(false)} style={{ alignSelf: 'flex-start' }}>Back</Button>
                <Text variant="headlineMedium" style={{ padding: 16 }}>Checkout</Text>

                <Card style={{ margin: 16 }}>
                    <Card.Content>
                        <TextInput
                            label="Customer Name"
                            value={customerName}
                            onChangeText={(t) => setCustomerDetails(t, customerPhone)}
                            style={styles.input}
                        />
                        <TextInput
                            label="Phone Number"
                            value={customerPhone}
                            onChangeText={(t) => setCustomerDetails(customerName, t)}
                            keyboardType="phone-pad"
                            style={styles.input}
                        />
                        <Divider style={{ marginVertical: 10 }} />
                        <Text variant="titleLarge">Total: ₹ {total}</Text>
                    </Card.Content>
                    <Card.Actions>
                        <Button mode="contained" onPress={handleCheckout} style={{ flex: 1 }}>Confirm Sale</Button>
                    </Card.Actions>
                </Card>
            </View>
        );
    }

    return (
        <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.colors.background }]}>
            <Searchbar
                placeholder="Scan or Search Item"
                onChangeText={setSearchQuery}
                value={searchQuery}
                style={styles.searchBar}
                icon="barcode-scan"
                onIconPress={() => router.push('/scan')}
            />

            {searchResults.length > 0 && (
                <View style={styles.searchResults}>
                    {searchResults.map(item => (
                        <TouchableOpacity key={item.id} onPress={() => handleAddItem(item)} style={styles.searchItem}>
                            <Text>{item.name} - ₹{item.sellingPrice}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            )}

            <FlatList
                data={items}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                    <Card style={styles.cartItem}>
                        <Card.Content style={styles.cartItemContent}>
                            <View style={{ flex: 1 }}>
                                <Text variant="titleMedium">{item.name}</Text>
                                <Text variant="bodyMedium">₹ {item.sellingPrice}</Text>
                            </View>
                            <View style={styles.quantityControl}>
                                <IconButton icon="minus" size={20} onPress={() => updateQuantity(item.id, item.quantity - 1)} />
                                <Text>{item.quantity}</Text>
                                <IconButton icon="plus" size={20} onPress={() => updateQuantity(item.id, item.quantity + 1)} />
                            </View>
                            <IconButton icon="delete" iconColor={theme.colors.error} onPress={() => removeItem(item.id)} />
                        </Card.Content>
                    </Card>
                )}
                contentContainerStyle={{ paddingBottom: 100 }}
            />

            {items.length > 0 && (
                <View style={[styles.footer, { paddingBottom: insets.bottom + 80, backgroundColor: theme.colors.elevation.level2 }]}>
                    <View>
                        <Text variant="labelMedium">Total Items: {items.length}</Text>
                        <Text variant="headlineSmall" style={{ fontWeight: 'bold' }}>₹ {total}</Text>
                    </View>
                    <Button mode="contained" onPress={() => setCheckoutMode(true)} icon="check">Checkout</Button>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    searchBar: { margin: 16 },
    searchResults: {
        position: 'absolute', top: 80, left: 16, right: 16, zIndex: 100, backgroundColor: 'white', elevation: 4, borderRadius: 8, padding: 8
    },
    searchItem: { padding: 12, borderBottomWidth: 0.5, borderBottomColor: '#ccc' },
    cartItem: { marginHorizontal: 16, marginVertical: 4 },
    cartItemContent: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    quantityControl: { flexDirection: 'row', alignItems: 'center' },
    input: { marginBottom: 12, backgroundColor: 'transparent' },
    footer: {
        position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderTopWidth: 1, borderTopColor: '#eee'
    }
});
