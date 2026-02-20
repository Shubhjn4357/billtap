import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Text, Surface, useTheme, IconButton } from 'react-native-paper';
import { useSQLiteContext } from 'expo-sqlite';
import { eq, desc } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/expo-sqlite';
import * as schema from '../../src/db/schema';
import { DesignSystem } from '../../src/constants/DesignSystem';
import { MaterialCommunityIcons } from '@expo/vector-icons';

type NotificationRecord = typeof schema.notifications.$inferSelect;

export default function NotificationsScreen() {
    const theme = useTheme();
    const expoDb = useSQLiteContext();
    const db = drizzle(expoDb, { schema });
    const [alerts, setAlerts] = useState<NotificationRecord[]>([]);

    useEffect(() => {
        const loadNotifications = async () => {
            try {
                const results = await db.query.notifications.findMany({
                    orderBy: [desc(schema.notifications.createdAt)],
                });
                setAlerts(results);
            } catch (err) {
                console.error("Failed to load notifications", err);
            }
        };
        void loadNotifications();
    }, [db]);

    const markAsRead = async (id: string) => {
        try {
            await db.update(schema.notifications)
                .set({ isRead: true })
                .where(eq(schema.notifications.id, id));
            setAlerts(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch (e) {
            console.error("Failed to update notification", e);
        }
    };

    const markAllRead = async () => {
        try {
            await db.update(schema.notifications)
                .set({ isRead: true })
                .where(eq(schema.notifications.isRead, false));
            setAlerts(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch (e) {
            console.error("Failed to update notifications", e);
        }
    };

    const renderItem = ({ item }: { item: NotificationRecord }) => {
        return (
            <Surface
                style={[
                    styles.card,
                    {
                        backgroundColor: item.isRead ? theme.colors.surface : theme.colors.primaryContainer,
                        borderColor: theme.colors.outlineVariant,
                    }
                ]}
                elevation={item.isRead ? 1 : 2}
            >
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text variant="titleMedium" style={[{ fontWeight: '600', color: theme.colors.onSurface }, !item.isRead && { color: theme.colors.onPrimaryContainer }]}>
                            {item.title}
                        </Text>
                        {!item.isRead && (
                            <IconButton
                                icon="check"
                                size={18}
                                iconColor={theme.colors.primary}
                                onPress={() => markAsRead(item.id)}
                                style={styles.checkBtn}
                            />
                        )}
                    </View>
                    <Text variant="bodyMedium" style={[{ marginTop: 4, color: theme.colors.onSurfaceVariant }]}>
                        {item.message}
                    </Text>
                    <Text variant="labelSmall" style={[{ marginTop: 12, color: theme.colors.outline }]}>
                        {new Date(item.createdAt).toLocaleString()}
                    </Text>
                </View>
            </Surface>
        );
    };

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.topActions}>
                <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>Notifications</Text>
                <IconButton icon="check-all" onPress={markAllRead} iconColor={theme.colors.primary} size={24} />
            </View>

            <FlatList
                data={alerts}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                ListEmptyComponent={
                    <View style={styles.emptyWrap}>
                        <MaterialCommunityIcons name="bell-off-outline" size={48} color={theme.colors.outline} />
                        <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.outline }}>
                            No notifications yet
                        </Text>
                    </View>
                }
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: DesignSystem.spacing.lg,
        paddingTop: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.sm,
    },
    listContent: {
        padding: DesignSystem.spacing.lg,
        paddingBottom: 40,
    },
    card: {
        borderRadius: DesignSystem.radius.md,
        borderWidth: 1,
        overflow: 'hidden',
    },
    content: {
        padding: DesignSystem.spacing.md,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    checkBtn: {
        margin: 0,
        marginTop: -8,
        marginRight: -8,
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
    }
});
