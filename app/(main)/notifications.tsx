import React, { useCallback, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { IconButton, Surface, Text, useTheme } from 'react-native-paper';
import { MaterialCommunityIcons } from '@expo/vector-icons';

import { DesignSystem } from '../../src/constants/DesignSystem';
import {
    getNotificationInbox,
    markAllNotificationsAsRead,
    markNotificationAsRead,
    type NotificationInboxEntry,
} from '../../src/services/notificationService';

export default function NotificationsScreen() {
    const theme = useTheme();
    const [alerts, setAlerts] = useState<NotificationInboxEntry[]>([]);
    const [loading, setLoading] = useState(false);

    const loadNotifications = useCallback(async () => {
        setLoading(true);
        try {
            const rows = await getNotificationInbox(300);
            setAlerts(rows);
        } catch (error) {
            console.error('Failed to load notifications', error);
        } finally {
            setLoading(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            void loadNotifications();
        }, [loadNotifications])
    );

    const markAsRead = async (id: string) => {
        try {
            await markNotificationAsRead(id);
            setAlerts((prev) => prev.map((entry) => (
                entry.id === id ? { ...entry, isRead: true } : entry
            )));
        } catch (error) {
            console.error('Failed to update notification', error);
        }
    };

    const markAllRead = async () => {
        try {
            await markAllNotificationsAsRead();
            setAlerts((prev) => prev.map((entry) => ({ ...entry, isRead: true })));
        } catch (error) {
            console.error('Failed to update notifications', error);
        }
    };

    const renderItem = ({ item }: { item: NotificationInboxEntry }) => (
        <Surface
            style={[
                styles.card,
                {
                    backgroundColor: item.isRead ? theme.colors.surface : theme.colors.primaryContainer,
                    borderColor: theme.colors.outlineVariant,
                },
            ]}
            elevation={item.isRead ? 1 : 2}
        >
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text
                        variant="titleMedium"
                        style={[
                            { fontWeight: '600', color: theme.colors.onSurface },
                            !item.isRead && { color: theme.colors.onPrimaryContainer },
                        ]}
                    >
                        {item.title}
                    </Text>
                    {!item.isRead ? (
                        <IconButton
                            icon="check"
                            size={18}
                            iconColor={theme.colors.primary}
                            onPress={() => { void markAsRead(item.id); }}
                            style={styles.checkBtn}
                        />
                    ) : null}
                </View>
                <Text variant="bodyMedium" style={[styles.message, { color: theme.colors.onSurfaceVariant }]}>
                    {item.message}
                </Text>
                <Text variant="labelSmall" style={[styles.time, { color: theme.colors.outline }]}>
                    {new Date(item.createdAt).toLocaleString()}
                </Text>
            </View>
        </Surface>
    );

    return (
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
            <View style={styles.topActions}>
                <Text variant="titleLarge" style={{ fontWeight: 'bold' }}>Notifications</Text>
                <IconButton icon="check-all" onPress={() => { void markAllRead(); }} iconColor={theme.colors.primary} size={24} />
            </View>

            <FlatList
                data={alerts}
                keyExtractor={(item) => item.id}
                renderItem={renderItem}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
                refreshing={loading}
                onRefresh={() => { void loadNotifications(); }}
                ListEmptyComponent={(
                    <View style={styles.emptyWrap}>
                        <MaterialCommunityIcons name="bell-off-outline" size={48} color={theme.colors.outline} />
                        <Text variant="bodyLarge" style={{ marginTop: 16, color: theme.colors.outline }}>
                            No notifications yet
                        </Text>
                    </View>
                )}
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
    message: {
        marginTop: 4,
    },
    time: {
        marginTop: 12,
    },
    emptyWrap: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 100,
    },
});
