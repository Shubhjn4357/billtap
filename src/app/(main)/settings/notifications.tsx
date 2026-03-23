import { router } from 'expo-router';
import {
    SettingsFieldCard,
    SettingsHeroCard,
    SettingsLinkRow,
    SettingsPageShell,
    SettingsSectionGroup,
    SettingsStatusPill,
} from '../../../components/settings/SettingsBlocks';
import { useSyncStatus } from '../../../hooks/useSyncStatus';
import { useSmartBack } from '../../../hooks/useSmartBack';

const getSyncLabel = (params: { blockedCount: number; pendingCount: number; isOnline: boolean }) => {
    if (params.blockedCount > 0) return `${params.blockedCount} blocked`;
    if (params.pendingCount > 0) return `${params.pendingCount} queued`;
    return params.isOnline ? 'Healthy' : 'Offline';
};

export default function NotificationsSettingsScreen() {
    const smartBack = useSmartBack('/(main)/settings');
    const syncStatus = useSyncStatus();
    const syncLabel = getSyncLabel(syncStatus);

    return (
        <SettingsPageShell
            title="Notifications"
            subtitle="Announcements, communication state, and sync health"
            onBackPress={smartBack}
            contextChip={{ label: syncLabel }}
        >
            <SettingsHeroCard
                title="Platform communication"
                subtitle="Notifications are simplified to announcements and operational status. SMS and WhatsApp surfaces are no longer part of the active product flow."
                primaryLabel={syncLabel}
                secondaryLabel={syncStatus.isOnline ? 'Online' : 'Offline'}
            />

            <SettingsSectionGroup
                title="Status"
                subtitle="See what is happening before opening a detailed screen."
            >
                <SettingsFieldCard
                    icon="cloud-sync-outline"
                    title="Sync state"
                    subtitle="Pending items, blocked cloud writes, and current connectivity status."
                >
                    <SettingsStatusPill label={`${syncStatus.pendingCount} queued`} tone="info" />
                    <SettingsStatusPill label={`${syncStatus.blockedCount} blocked`} tone="warning" />
                    <SettingsStatusPill label={syncStatus.isOnline ? 'Online' : 'Offline'} tone={syncStatus.isOnline ? 'success' : 'warning'} />
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Communication pages"
                subtitle="Use dedicated pages instead of hidden legacy communication forms."
            >
                <SettingsLinkRow
                    icon="bullhorn-outline"
                    title="Announcements"
                    subtitle="Offers, release notices, and in-app redirect cards."
                    onPress={() => router.push('/(main)/settings/announcements' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="cloud-sync-outline"
                    title="Sync diagnostics"
                    subtitle="Queue health, retries, blocked mutations, and local-storage sync state."
                    value={syncLabel}
                    onPress={() => router.push('/(main)/settings/sync' as Parameters<typeof router.push>[0])}
                />
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}
