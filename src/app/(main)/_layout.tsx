import { Tabs, type ErrorBoundaryProps, router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { VahiTabBar } from '../../components/VahiTabBar';
import { GoToPalette } from '../../components/navigation/GoToPalette';
import { AppDrawerLayout } from '../../components/layout/AppDrawerLayout';
import { DESIGN_SPACING } from '../../constants/designSystem';
import { Colors, Radius, Spacing, Typography } from '../../constants/theme';

export default function MainLayout() {
    return (
        
            <AppDrawerLayout>
                <Tabs
                    tabBar={(props) => <VahiTabBar {...props} />}
                    screenOptions={{
                        headerShown: false,
                    }}
                >
                    <Tabs.Screen
                        name="index"
                        options={{ title: 'Dashboard' }}
                    />
                    <Tabs.Screen
                        name="billing"
                        options={{ href: null, title: 'Billing', headerShown: false }}
                    />
                    <Tabs.Screen
                        name="inventory"
                        options={{ href: null, title: 'Inventory' }}
                    />
                    <Tabs.Screen
                        name="accounts"
                        options={{ href: null, title: 'Accounts' }}
                    />
                    <Tabs.Screen
                        name="reports"
                        options={{ href: null, title: 'Reports' }}
                    />
                    <Tabs.Screen
                        name="settings"
                        options={{ title: 'Settings', headerShown: false }}
                    />
                    <Tabs.Screen
                        name="parties"
                        options={{ href: null }}
                    />
                </Tabs>
                <GoToPalette />
            </AppDrawerLayout>
       
    );
}

export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
    return (
        <SafeAreaView style={s.errorSafe} edges={['top', 'bottom']}>
            <View style={s.errorWrap}>
                <Text style={s.errorTitle}>Main screen failed to load</Text>
                <Text style={s.errorText}>{error.message || 'Unexpected error in main navigation.'}</Text>
                <Pressable style={s.errorButton} onPress={retry}>
                    <Text style={s.errorButtonText}>Retry</Text>
                </Pressable>
                <Pressable style={s.errorSecondaryButton} onPress={() => router.replace('/(auth)/business-select')}>
                    <Text style={s.errorSecondaryText}>Back to Business Selection</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const s = StyleSheet.create({
    flex: {
        flex: 1,
    },
    errorSafe: {
        flex: 1,
        backgroundColor: Colors.light.background,
    },
    errorWrap: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: DESIGN_SPACING.screenX,
        gap: Spacing.sm,
    },
    errorTitle: {
        fontSize: Typography.title.size,
        fontWeight: '700',
        color: Colors.light.text,
        textAlign: 'center',
    },
    errorText: {
        fontSize: Typography.body.size,
        color: Colors.light.textSecondary,
        textAlign: 'center',
    },
    errorButton: {
        marginTop: Spacing.sm,
        minHeight: 44,
        minWidth: 140,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: Colors.light.primary,
    },
    errorButtonText: {
        color: Colors.light.onPrimary,
        fontSize: Typography.body.size,
        fontWeight: '700',
    },
    errorSecondaryButton: {
        minHeight: 44,
        minWidth: 200,
        paddingHorizontal: Spacing.md,
        borderRadius: Radius.pill,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: Colors.light.border,
        backgroundColor: Colors.light.surface,
    },
    errorSecondaryText: {
        color: Colors.light.text,
        fontSize: Typography.body.size,
        fontWeight: '600',
    },
});
