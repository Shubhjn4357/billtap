import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList, Modal } from 'react-native';
import { Text, useTheme, Searchbar, IconButton, List } from 'react-native-paper';
import { DesignSystem } from '../../../constants/DesignSystem';
import { Party } from '../../../types';
import { AppCard } from '../../../components/common/AppCard';

interface BillingPartySelectorProps {
    visible: boolean;
    onDismiss: () => void;
    parties: Party[];
    selectedId?: string;
    onSelect: (party: Party | null) => void;
    onCreateNew: () => void;
}

export const BillingPartySelector = ({
    visible,
    onDismiss,
    parties,
    selectedId,
    onSelect,
    onCreateNew
}: BillingPartySelectorProps) => {
    const theme = useTheme();
    const [search, setSearch] = useState('');

    useEffect(() => {
        if (visible) {
            setSearch('');
        }
    }, [visible]);

    if (!visible) return null;

    const filtered = parties.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) || p.phone?.includes(search)
    );

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onDismiss}>
            <View style={styles.overlay}>
                <View style={[styles.container, { backgroundColor: theme.colors.elevation.level2 }]}>
                    <View style={styles.header}>
                        <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>Select Party</Text>
                        <IconButton icon="close" onPress={onDismiss} />
                    </View>

                    <View style={styles.searchContainer}>
                        <Searchbar
                            placeholder="Search by name or phone"
                            value={search}
                            onChangeText={setSearch}
                            style={{ backgroundColor: theme.colors.surface }}
                            elevation={0}
                        />
                    </View>

                    <FlatList
                        data={filtered}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.list}
                        ListHeaderComponent={
                            <List.Item
                                title="Walk-in Customer"
                                description="No party recorded"
                                left={(props) => <List.Icon {...props} icon="account-off-outline" />}
                                onPress={() => {
                                    onSelect(null);
                                    onDismiss();
                                }}
                                style={styles.listItem}
                            />
                        }
                        renderItem={({ item }) => (
                            <AppCard
                                style={{
                                    marginBottom: 8,
                                    borderColor: selectedId === item.id ? theme.colors.primary : 'transparent',
                                    borderWidth: 1
                                }}
                                onPress={() => {
                                    onSelect(item);
                                    onDismiss();
                                }}
                            >
                                <List.Item
                                    title={item.name}
                                    description={(item.phone || 'No phone') + (item.gstNumber ? ` | GST: ${item.gstNumber}` : '')}
                                    left={(props) => <List.Icon {...props} icon="account" />}
                                    right={(props) => (
                                        selectedId === item.id
                                            ? <List.Icon {...props} icon="check-circle" color={theme.colors.primary} />
                                            : null
                                    )}
                                />
                            </AppCard>
                        )}
                        ListEmptyComponent={
                            <View style={{ padding: 32, alignItems: 'center' }}>
                                <Text variant="bodyLarge">No party found.</Text>
                            </View>
                        }
                    />

                    <View style={[styles.footer, { borderTopColor: theme.colors.outlineVariant }]}>
                        <List.Item
                            title="Add New Party"
                            titleStyle={{ color: theme.colors.primary, fontWeight: 'bold' }}
                            left={(props) => <List.Icon {...props} icon="plus-circle" color={theme.colors.primary} />}
                            onPress={() => {
                                onDismiss();
                                onCreateNew();
                            }}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    container: {
        height: '80%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: DesignSystem.spacing.md,
    },
    searchContainer: {
        paddingHorizontal: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.md,
    },
    list: {
        padding: DesignSystem.spacing.md,
    },
    listItem: {
        marginBottom: 8,
        borderRadius: DesignSystem.radius.md,
    },
    footer: {
        borderTopWidth: 1,
        paddingBottom: DesignSystem.spacing.lg,
    }
});
