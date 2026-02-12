import React, { useState, useEffect } from 'react';
import { View, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import { Text, FAB, Searchbar, useTheme, Card, IconButton, ActivityIndicator } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { InventoryItem } from '../../../types';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function StockListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'items'), orderBy('updatedAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const inventory: InventoryItem[] = [];
      snapshot.forEach((doc) => {
        inventory.push({ id: doc.id, ...doc.data() } as InventoryItem);
      });
      setItems(inventory);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const filteredItems = items.filter(item => 
    item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    item.barcode?.includes(searchQuery)
  );

  const renderItem = ({ item }: { item: InventoryItem }) => (
    <Card 
      style={styles.card} 
      onPress={() => router.push({ pathname: '/(tabs)/stock-detail', params: { id: item.id } })}
    >
      <Card.Title
        title={item.name}
        subtitle={`Stock: ${item.stockQuantity} | Price: ₹${item.sellingPrice}`}
        right={(props) => <IconButton {...props} icon="chevron-right" />}
      />
    </Card>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
      <Searchbar
        placeholder="Search items..."
        onChangeText={setSearchQuery}
        value={searchQuery}
        style={styles.searchBar}
      />
      
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.center}>
              <Text>No items found</Text>
            </View>
          }
        />
      )}

      <FAB
        icon="plus"
        style={[styles.fab, { backgroundColor: theme.colors.primary }]}
        color={theme.colors.onPrimary}
        onPress={() => router.push({ pathname: '/(tabs)/stock-detail', params: { id: 'new' } })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchBar: {
    margin: 16,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  card: {
    marginBottom: 12,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 50,
  },
});
