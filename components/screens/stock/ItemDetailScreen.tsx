import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { TextInput, Button, HelperText, useTheme, Appbar, ActivityIndicator } from 'react-native-paper';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { doc, getDoc, setDoc, addDoc, collection, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { InventoryItem } from '../../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ItemDetailScreen() {
    const { id } = useLocalSearchParams();
    const router = useRouter();
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    
    const isNew = id === 'new' || !id;
    const [loading, setLoading] = useState(!isNew);
    const [saving, setSaving] = useState(false);
    
    const [name, setName] = useState('');
    const [price, setPrice] = useState('');
    const [stock, setStock] = useState('');
    const [barcode, setBarcode] = useState('');
    const [category, setCategory] = useState('');
    
    useEffect(() => {
        if (!isNew && typeof id === 'string') {
            const fetchItem = async () => {
                try {
                    const docRef = doc(db, 'items', id);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data() as InventoryItem;
                        setName(data.name);
                        setPrice(data.sellingPrice.toString());
                        setStock(data.stockQuantity.toString());
                        setBarcode(data.barcode || '');
                        setCategory(data.category || '');
                    } else {
                        Alert.alert('Error', 'Item not found');
                        router.back();
                    }
                } catch (e) {
                    console.error(e);
                    Alert.alert('Error', 'Failed to fetch item');
                } finally {
                    setLoading(false);
                }
            };
            fetchItem();
        }
    }, [id, isNew]);

    const handleSave = async () => {
        if (!name || !price || !stock) {
            Alert.alert('Error', 'Please fill in all required fields');
            return;
        }
        
        setSaving(true);
        try {
            const itemData = {
                name,
                sellingPrice: parseFloat(price),
                stockQuantity: parseInt(stock),
                barcode: barcode || null,
                category: category || null,
                updatedAt: Date.now(),
            };

            if (isNew) {
                await addDoc(collection(db, 'items'), {
                    ...itemData,
                    purchasePrice: 0, // Default or added field
                    mrp: parseFloat(price), // Default
                    lowStockThreshold: 5,
                    createdAt: Date.now(),
                });
            } else if (typeof id === 'string') {
                await updateDoc(doc(db, 'items', id), itemData);
            }
            router.back();
        } catch (e) {
            console.error(e);
            Alert.alert('Error', 'Failed to save item');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (typeof id !== 'string') return;
        
        Alert.alert('Delete Item', 'Are you sure you want to delete this item?', [
            { text: 'Cancel', style: 'cancel' },
            { 
                text: 'Delete', 
                style: 'destructive',
                onPress: async () => {
                    setSaving(true);
                    try {
                        await deleteDoc(doc(db, 'items', id));
                        router.back();
                    } catch (e) {
                        Alert.alert('Error', 'Failed to delete item');
                        setSaving(false);
                    }
                }
            }
        ]);
    };

    if (loading) {
        return (
            <View style={[styles.center, { backgroundColor: theme.colors.background }]}>
                <ActivityIndicator size="large" />
            </View>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
            <Appbar.Header>
                <Appbar.BackAction onPress={() => router.back()} />
                <Appbar.Content title={isNew ? 'New Item' : 'Edit Item'} />
                {!isNew && <Appbar.Action icon="delete" onPress={handleDelete} />}
            </Appbar.Header>
            
            <ScrollView contentContainerStyle={styles.content}>
                <TextInput
                    label="Item Name"
                    value={name}
                    onChangeText={setName}
                    mode="outlined"
                    style={styles.input}
                />
                
                <View style={styles.row}>
                    <TextInput
                        label="Selling Price"
                        value={price}
                        onChangeText={setPrice}
                        keyboardType="numeric"
                        mode="outlined"
                        style={[styles.input, { flex: 1, marginRight: 8 }]}
                    />
                    <TextInput
                        label="Stock Quantity"
                        value={stock}
                        onChangeText={setStock}
                        keyboardType="numeric"
                        mode="outlined"
                        style={[styles.input, { flex: 1, marginLeft: 8 }]}
                    />
                </View>

                <TextInput
                    label="Barcode"
                    value={barcode}
                    onChangeText={setBarcode}
                    mode="outlined"
                    style={styles.input}
                    right={<TextInput.Icon icon="barcode-scan" onPress={() => router.push('/scan')} />}
                />

                <TextInput
                    label="Category"
                    value={category}
                    onChangeText={setCategory}
                    mode="outlined"
                    style={styles.input}
                />

                <Button 
                    mode="contained" 
                    onPress={handleSave} 
                    loading={saving} 
                    style={styles.button}
                >
                    Save Item
                </Button>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    content: {
        padding: 16,
    },
    input: {
        marginBottom: 16,
    },
    row: {
        flexDirection: 'row',
    },
    button: {
        marginTop: 16,
    }
});
