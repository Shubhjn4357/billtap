
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, List, Switch, useTheme } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppButton } from '../../components/common/AppButton';

export const SettingsScreen = () => {
    const { user, signOut } = useAuth();
    const theme = useTheme();
    const [isDark, setIsDark] = React.useState(false); // Should come from global theme context

    return (
        <ScreenWrapper>
            <View style={{ marginBottom: 20 }}>
                <Text variant="headlineMedium" style={{ fontWeight: 'bold', marginBottom: 5 }}>Settings</Text>
                <Text variant="bodyMedium" style={{ color: theme.colors.outline }}>{user?.email || user?.phoneNumber || 'User'}</Text>
            </View>

            <List.Section>
                <List.Subheader>Appearance</List.Subheader>
                <List.Item
                    title="Dark Mode"
                    right={() => <Switch value={isDark} onValueChange={setIsDark} />}
                    left={props => <List.Icon {...props} icon="theme-light-dark" />}
                />
            </List.Section>

            <List.Section>
                <List.Subheader>Account</List.Subheader>
                <List.Item
                    title="Business Profile"
                    description="Manage company details"
                    left={props => <List.Icon {...props} icon="store" />}
                    onPress={() => {}}
                />
            </List.Section>

            <View style={{ flex: 1, justifyContent: 'flex-end', marginBottom: 20 }}>
                <AppButton mode="outlined" onPress={signOut} icon="logout">
                    Sign Out
                </AppButton>
            </View>
        </ScreenWrapper>
    );
};
