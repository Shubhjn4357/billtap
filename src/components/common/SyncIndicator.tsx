import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, useTheme, ActivityIndicator, IconButton } from 'react-native-paper';
import { useNetworkStore } from '../../store';
import { formatDistanceToNow } from 'date-fns';

export const SyncIndicator = () => {
    const theme = useTheme();
    const { syncStatus, lastSyncTime, isConnected } = useNetworkStore();
    const [label, setLabel] = useState('');

    useEffect(() => {
        if (!isConnected) {
            setLabel('Offline');
            return;
        }
        if (syncStatus === 'SYNCING') {
            setLabel('Syncing...');
            return;
        }
        if (syncStatus === 'ERROR') {
            setLabel('Sync Error');
            return;
        }
        if (lastSyncTime) {
            setLabel(`Synced ${formatDistanceToNow(new Date(lastSyncTime))} ago`);
        } else {
            setLabel('Online');
        }
    }, [isConnected, syncStatus, lastSyncTime]);

    if (syncStatus === 'IDLE' && isConnected && !lastSyncTime) return null;

    let icon = 'check-circle-outline';
    let color = theme.colors.primary;

    if (!isConnected) {
        icon = 'wifi-off';
        color = theme.colors.error;
    } else if (syncStatus === 'SYNCING') {
        icon = 'loading'; // Placeholder logic
        color = theme.colors.secondary;
    } else if (syncStatus === 'ERROR') {
        icon = 'alert-circle-outline';
        color = theme.colors.error;
    }

    return (
        <View style={styles.container}>
             {syncStatus === 'SYNCING' ? (
                 <ActivityIndicator size={12} color={color} style={{ marginRight: 6 }} />
             ) : (
                 <IconButton icon={icon} size={14} iconColor={color} style={{ margin: 0, padding: 0, width: 16, height: 16 }} />
             )}
            <Text variant="labelSmall" style={{ color: theme.colors.outline, marginLeft: 4 }}>
                {label}
            </Text>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
    }
});
