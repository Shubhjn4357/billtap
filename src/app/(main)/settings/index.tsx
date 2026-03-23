import { useMemo, useState } from 'react';
import { router } from 'expo-router';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import {
    SettingsCategoryCard,
    SettingsHeroCard,
    SettingsLinkRow,
    SettingsPageShell,
    SettingsSectionGroup,
    SettingsToggleRow,
} from '../../../components/settings/SettingsBlocks';
import { SETTINGS_HOME_CATEGORIES } from '../../../constants/settingsNavigation';
import { useAppRuntime } from '../../../components/providers/AppRuntimeProvider';
import { useAuthStore } from '../../../store/authStore';
import { useSyncStatus } from '../../../hooks/useSyncStatus';

const QUICK_LINKS = [
    {
        key: 'printing',
        title: 'Printing & templates',
        subtitle: 'Invoice layouts, thermal profiles, and business card preview.',
        icon: 'printer-outline' as const,
        route: '/(main)/settings/printing',
    },
    {
        key: 'subscription',
        title: 'Subscription',
        subtitle: 'Plan, billing status, and cloud-sync access.',
        icon: 'crown-outline' as const,
        route: '/(main)/settings/subscription',
    },
    {
        key: 'sync',
        title: 'Sync diagnostics',
        subtitle: 'Offline queue, retries, blocked items, and health state.',
        icon: 'cloud-sync-outline' as const,
        route: '/(main)/settings/sync',
    },
    {
        key: 'switch-business',
        title: 'Switch business',
        subtitle: 'Change the active firm quickly without digging into the drawer.',
        icon: 'domain-switch' as const,
        route: '/(auth)/business-select',
    },
];

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

    const filteredQuickLinks = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return QUICK_LINKS;
        return QUICK_LINKS.filter((item) =>
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
            subtitle="Account, appearance, privacy, help, and business controls"
            contextChip={{ label: subscription?.tier ?? 'FREE' }}
        >
            <SettingsHeroCard
                title={business?.name ?? 'Business settings'}
                subtitle="Grouped, direct controls with auto-save status. No old hidden forms, no scattered More hub."
                primaryLabel={subscription?.status ?? 'active'}
                secondaryLabel={syncLabel}
            />

            <AppSearchBar
                value={search}
                onChangeText={setSearch}
                placeholder="Search settings, privacy, billing, inventory…"
                showScanAction={false}
            />

            <SettingsSectionGroup
                title="Quick controls"
                subtitle="The switches people use most should be immediate and obvious."
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
                    subtitle="Keep back/forward gestures responsive inside the app."
                    value={localPreferences.gestureNavigationEnabled}
                    onValueChange={(next) => {
                        void updateLocalPreferences({ gestureNavigationEnabled: next });
                    }}
                />
                <SettingsToggleRow
                    icon="vibrate"
                    title="Haptics"
                    subtitle="Use subtle vibration feedback for actions and confirmations."
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
                subtitle="Everything is grouped under clear, findable labels."
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

            <SettingsSectionGroup
                title="Shortcuts"
                subtitle="Important utility pages stay reachable without reviving the old More tab."
            >
                {filteredQuickLinks.map((item) => (
                    <SettingsLinkRow
                        key={item.key}
                        icon={item.icon}
                        title={item.title}
                        subtitle={item.subtitle}
                        value={item.key === 'subscription' ? (subscription?.tier ?? 'FREE') : undefined}
                        onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                    />
                ))}
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Support"
                subtitle="Legal, product help, and release details stay one tap away."
            >
                <SettingsLinkRow
                    icon="bullhorn-outline"
                    title="Announcements"
                    subtitle="Check new product notices and active communication cards."
                    onPress={() => router.push('/(main)/settings/announcements' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="file-document-outline"
                    title="Legal center"
                    subtitle="Privacy policy, terms, changelog, and about."
                    onPress={() => router.push('/legal' as Parameters<typeof router.push>[0])}
                />
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}
