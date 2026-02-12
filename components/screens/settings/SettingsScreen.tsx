import React from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { List, Switch, Text, useTheme, Button, Divider, Avatar } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettingsStore, useUserStore } from '../../../store';
import { useRouter } from 'expo-router';
import { auth } from '../../../lib/firebase';

export default function SettingsScreen() {
    const theme = useTheme();
    const insets = useSafeAreaInsets();
    const router = useRouter();
    const { isBiometricEnabled, toggleBiometric, themeMode, setThemeMode } = useSettingsStore();
    const { user, logout } = useUserStore();

    const handleLogout = async () => {
        try {
            await auth.signOut();
            logout();
            router.replace('/login');
        } catch (error) {
            Alert.alert('Error', 'Failed to logout');
        }
    };

    return (
        <ScrollView style={[styles.container, { backgroundColor: theme.colors.background, paddingTop: insets.top }]}>
            <View style={styles.header}>
                <Avatar.Text size={64} label={user?.displayName?.[0] || 'U'} />
                <View style={{ marginLeft: 16 }}>
                    <Text variant="titleLarge">{user?.displayName || 'User Name'}</Text>
                    <Text variant="bodyMedium">{user?.email}</Text>
                </View>
            </View>

            <List.Section>
                <List.Subheader>Appearance</List.Subheader>
                <List.Item
                    title="Dark Mode"
                    right={() => (
                        <Switch
                            value={themeMode === 'dark'}
                            onValueChange={(val) => setThemeMode(val ? 'dark' : 'light')}
                        />
                    )}
                    left={props => <List.Icon {...props} icon="theme-light-dark" />}
                />
            </List.Section>

            <Divider />

            <List.Section>
                <List.Subheader>Security</List.Subheader>
                <List.Item
                    title="Biometric Login"
                    description="FaceID / Fingerprint"
                    right={() => (
                        <Switch
                            value={isBiometricEnabled}
                            onValueChange={toggleBiometric}
                        />
                    )}
                    left={props => <List.Icon {...props} icon="face-recognition" />}
                />
            </List.Section>

            <Divider />

            <View style={{ padding: 16 }}>
                <Button mode="outlined" onPress={handleLogout} textColor={theme.colors.error}>
                    Log Out
                </Button>
                <Text style={{ textAlign: 'center', marginTop: 20, color: theme.colors.secondary }}>Version 1.0.0</Text>
            </View>
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1 },
    header: { flexDirection: 'row', alignItems: 'center', padding: 20 }
});
