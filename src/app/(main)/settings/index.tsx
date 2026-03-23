import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import {
    SettingsCategoryCard,
    SettingsHeroCard,
    SettingsPageShell,
    SettingsSectionGroup,
    SettingsToggleRow,
} from '../../../components/settings/SettingsBlocks';
import { SETTINGS_HOME_CATEGORIES } from '../../../constants/settingsNavigation';
import { useAppRuntime } from '../../../components/providers/AppRuntimeProvider';
import { useAuthStore } from '../../../store/authStore';
import { useSyncStatus } from '../../../hooks/useSyncStatus';

export default function SettingsHomeScreen() {
    const business = useAuthStore((state) => state.business);
    const subscription = useAuthStore((state) => state.subscription);
    const { localPreferences, biometricSupported, updateLocalPreferences } = useAppRuntime();
    const syncStatus = useSyncStatus();
    const [search, setSearch] = useState('');

    const filteredCategories = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return SETTINGS_HOME_CATEGORIES;
        return SETTINGS_HOME_CATEGORIES.filter((item) =>
            `${item.title} ${item.subtitle}`.toLowerCase().includes(needle)
        );
    }, [search]);

    const syncLabel = syncStatus.blockedCount > 0
        ? `${syncStatus.blockedCount} blocked`
        : syncStatus.pendingCount > 0
            ? `${syncStatus.pendingCount} queued`
            : syncStatus.isOnline
                ? 'Synced'
                : 'Offline';

    return (
        <SettingsPageShell
            title="Settings"
            subtitle="Account, appearance, notifications, billing, inventory, privacy, and support"
            contextChip={{ label: subscription?.tier ?? 'FREE' }}
        >
            <SettingsHeroCard
                title={business?.name ?? 'Business settings'}
                subtitle="Clear categories, direct controls, and one route owner for every settings destination."
                primaryLabel={subscription?.status ?? 'active'}
                secondaryLabel={syncLabel}
            />

            <AppSearchBar
                value={search}
                onChangeText={setSearch}
                placeholder="Search settings, privacy, billing, inventory..."
                showScanAction={false}
            />

            <SettingsSectionGroup
                title="Quick controls"
                subtitle="The settings people use most should be immediate and obvious."
            >
                <SettingsToggleRow
                    icon={localPreferences.themeMode === 'dark' ? 'weather-night' : 'white-balance-sunny'}
                    title="Dark mode"
                    subtitle="Switch the app theme instantly."
                    value={localPreferences.themeMode === 'dark'}
                    onValueChange={(next) => {
                        void updateLocalPreferences({ themeMode: next ? 'dark' : 'light' });
                    }}
                />
                <SettingsToggleRow
                    icon="gesture-swipe"
                    title="Gesture navigation"
                    subtitle="Keep back and forward gestures responsive inside the app."
                    value={localPreferences.gestureNavigationEnabled}
                    onValueChange={(next) => {
                        void updateLocalPreferences({ gestureNavigationEnabled: next });
                    }}
                />
                <SettingsToggleRow
                    icon="vibrate"
                    title="Haptics"
                    subtitle="Use subtle vibration feedback for confirmations and actions."
                    value={localPreferences.hapticsEnabled}
                    onValueChange={(next) => {
                        void updateLocalPreferences({ hapticsEnabled: next });
                    }}
                />
                <SettingsToggleRow
                    icon="fingerprint"
                    title="Biometric lock"
                    subtitle={biometricSupported ? 'Protect the app when returning from background.' : 'Biometric lock is not available on this device.'}
                    value={localPreferences.biometricLockEnabled}
                    disabled={!biometricSupported}
                    onValueChange={(next) => {
                        void updateLocalPreferences({ biometricLockEnabled: next });
                    }}
                />
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Categories"
                subtitle="Every destination appears under one clear category only."
            >
                {filteredCategories.map((category) => (
                    <SettingsCategoryCard
                        key={category.key}
                        icon={category.icon}
                        title={category.title}
                        subtitle={category.subtitle}
                        status={category.sections.length > 0 ? `${category.sections.length} sections` : 'Direct controls'}
                        onPress={() => router.push(category.route as Parameters<typeof router.push>[0])}
                    />
                ))}
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}
